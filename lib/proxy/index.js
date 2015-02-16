var _ = require('underscore');
var fs = require('fs');
var http = require('http');
var https = require('https');
var connect = require('connect');
var httpProxy = require('http-proxy');
var util = require('util');

var ProxyKeystore = require('./keystore.js');

var module_tag = {
  module: require('../logger.js').getModulePath(__filename)
};

// Increase the maxSockets managed by this process to ensure that we can keep up with many
// concurrent connections under load.  Also, node-http-proxy uses this agent to manage
// connection keep-alives.  If no agent is provided, node-http-proxy will return a connection: close.
var HTTP_AGENT = http.globalAgent;
HTTP_AGENT.maxSockets = 1000;

/**
 * An oauth_reverse_proxy is initialized around a JSON value that defines the necessary components
 * of any proxy, such as the from and to ports as well as the directory in which OAuth secrets
 * are stored.
 *
 * In the keystore, each file is treated as an OAuth credential pair, with the filename being
 * the consumer key and the contents of the file being the consumer secret.
 *
 * An example proxy configured with a single consumer key named 'test-key' and consumer secret
 * of 'terrible-consumer-secret' would contain the following as the sole entry in the
 * a keystore directory of /var/oauth_reverse_proxy/8000/80:
 *
 *    /var/oauth_reverse_proxy/8000/80/test-key
 *
 * The contents of this file would be 'terrible-consumer-secret'
 *
 * An oauth_reverse_proxy will manage its keystore and watch for changes to the filesystem.  As
 * keys are added, removed, or changed, the proxy will dynamically reconfigure to reflect the
 * new set of credentials.
 */
function Proxy(proxy_config) {
  this.config = proxy_config;
  this.keystore = new ProxyKeystore(this.config);

  this.logger = require('../logger.js').getLogger({'service_name':this.config.service_name});

  this.logger.debug(module_tag, "Starting proxy on port %s", this.config.from_port);
}

Proxy.prototype.getConnectApp = function() {

  var this_obj = this;

  // Validators
  var oauth_param_sanity_validator = require('./validators/oauth_param_sanity_validator.js')(this_obj);
  var oauth_signature_validator = require('./validators/oauth_signature_validator.js')(this_obj);
  var oauth_timestamp_validator = require('./validators/oauth_timestamp_validator.js')(this_obj);
  var quota_validator = require('./validators/quota_validator.js')(this_obj);
  var request_sanity_validator = require('./validators/request_sanity_validator.js')(this_obj);
  var url_length_validator = require('./validators/url_length_validator.js')(this_obj);
  var whitelist_validator = require('./validators/whitelist_validator.js')(this_obj);

  // Mutators
  var form_parser = connect.urlencoded();
  var forward_header_mutator = require('./mutators/forward_header_mutator.js')(this_obj);
  var host_header_mutator = require('./mutators/host_header_mutator.js')(this_obj);
  var oauth_param_collector = require('./mutators/oauth_param_collector.js')(this_obj);
  var query_string_parser = connect.query();
  var restreamer = require('./mutators/restreamer.js')({stringify:require('querystring').stringify});
  var url_parser = require('./mutators/url_parser.js')(this_obj);

  var proxy = httpProxy.createProxyServer({});

  // Handle connection errors to the underlying service.  Normal errors returned by the
  // service (like 404s) will get proxied through without any tampering.
  proxy.on('error', function(err, req, res) {
    this_obj.logger.info(module_tag, "Got error %s communicating with underlying server.", util.inspect(err));
    res.writeHead(500, "Connection to " + this_obj.config.service_name + " failed");
    res.end();
  });

  // Return an all-singing, all-dancing OAuth validating connect pipeline.
  return connect(
    // Test for minimum viable sanity for an inbound request.  Pass in the proxy object so that
    // the URI and Host header can be matched against the expected values, if provided.
    request_sanity_validator,
    // Reject request with URLs longer than 16kb
    url_length_validator,
    // Unpack the body of POSTs so we can use them in signatures.  Note that this
    // will implicitly limit POST size to 1mb.  We may wish to add configuration around
    // this in the future.
    form_parser,
    // Parse query string
    query_string_parser,
    // Parse url once so that it's available in a clean format for the oauth validator
    url_parser,
    // Gather the oauth params from the request
    oauth_param_collector,
    // Modify the request headers to add x-forwarded-*
    forward_header_mutator,
    // Check the request against our path/verb whitelist
    whitelist_validator,
    // Validate that the oauth params pass a set of viability checks (existence, version, etc)
    oauth_param_sanity_validator,
    // Validate that the request is within quota
    quota_validator,
    // Validate that the timestamp of the request is legal
    oauth_timestamp_validator,
    // Perform the oauth signature validation
    oauth_signature_validator,
    // Update the host header
    host_header_mutator,
    // Since connect messes with the input parameters and we want to pass them through
    // unadulterated to the target, we need to add restreamer to the chain.  But we only
    // need to do this if we're given a formencoded request.
    restreamer,
    // Whew.  After all of that, we're ready to proxy the request.
    function(req, res) {
      // Proxy a web request to the target port on localhost using the provided agent.
      // If no agent is provided, node-http-proxy will return a connection: close.
      proxy.web(req, res, {agent: HTTP_AGENT, target: { 'host' : 'localhost', 'port' : this_obj.config.to_port }});
    }
  );
};

/**
 * Initialize the proxy by loading its keys and wiring up a connect pipeline to route
 * the request through a set of mutators and validators that determine whether the
 * request should be allowed.
 */
Proxy.prototype.start = function(cb) {
  var this_obj = this;

  this_obj.keystore.load(function(err) {
    // If we could not load keys, fail proxy creation.
    if (err) {
      return cb(err);
    }

    // The express server is wired up with a list of mutators and validators that are applied to
    // each inbound request.
    var app = this_obj.getConnectApp.apply(this_obj);

    // Start watching the key directory for changes
    this_obj.keystore.setupWatcher();

    // Begin listening for incoming requests
    this_obj.logger.info(module_tag, "Listening on port %s", this_obj.config.from_port);

    var create_http_server = function() {
      // If the proxy config specifically asks for https, use https.  Otherwise, use http.
      if (this_obj.config.https) {
        return https.createServer({
          key: fs.readFileSync(this_obj.config.https_key_file),
          cert: fs.readFileSync(this_obj.config.https_cert_file)
        }, app);
      } else {
        return http.createServer(app);
      }
    };

    Object.defineProperty(this_obj, 'server', { 'value': create_http_server(), writable: false, enumerable: true });

    // Listen on our server.
    this_obj.server.listen(this_obj.config.from_port, '::');

    // Try to create a server listening on ipv4.  On some platforms, the listen '::' above maps only to IPv6 requests.
    // In that case, we need to open up an IPv4 server.  Note that if this backup server fails to start, we treat it
    // as an ignorable error.
    var backup_server = create_http_server();
    backup_server.on('listening', function(err) {
      if (err) return this_obj.logger.info("Not listening on backup server due to error: %s", err);

      Object.defineProperty(this_obj, 'backup_server', { 'value': backup_server, writable: false, enumerable: true });
    });
    backup_server.on('error', function(err) {
      if (err) return this_obj.logger.info("Backup server init error: %s", err);
    });
    backup_server.listen(this_obj.config.from_port, '0.0.0.0');

    cb(null, this_obj);
  });
};

/**
 * Stop this proxy, shutting down its servers.  Note that the server will continue to hold existing connections until
 * they complete: we make no effort to forcibly terminate connections.
 */
Proxy.prototype.stop = function() {
  if (this.server) {
    this.server.close();
  }

  if (this.backup_server) {
    this.backup_server.close();
  }
};

// Expose Proxy class.
module.exports = Proxy;
