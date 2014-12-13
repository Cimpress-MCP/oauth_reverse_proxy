var _ = require('underscore');
var http = require('http');
var connect = require('connect');
var httpProxy = require('http-proxy');
var util = require('util');

var whitelist = require('./whitelist.js');
var authenticator = require('./authenticator.js');
var header_modifier = require('./header_modifier.js');
var ProxyKeys = require('./keys.js');

var apply_xforwarded_headers = header_modifier.applyXForwardedHeaders();
var url_parser = authenticator.urlParser();

var MAXIMUM_URL_LENGTH = 16*1024;

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
  this.keys = new ProxyKeys(this.config);

  this.logger = require('../logger.js').getLogger({'service_name':this.config.service_name});


  this.logger.debug("Starting proxy on port %s", this.config.from_port);
}

/**
 * Initialize the proxy by loading its keys and wiring up a connect pipeline to route
 * the keys and necessary metadata through the oauthValidator before forwarding the
 * request to the target port.
 */
Proxy.prototype.start = function(cb) {
  var this_obj = this;

  this_obj.keys.load(function(err) {
    // If we could not load keys, fail proxy creation.
    if (err) {
      return cb(err);
    }

    var whitelist_validator = authenticator.whitelistValidator(this_obj);
    var oauth_validator = authenticator.oauthValidator(this_obj);
    var request_validator = authenticator.requestValidator(this_obj);
    var modify_host_header = header_modifier.modifyHostHeaders(this_obj.config.from_port, this_obj.config.to_port);

    var restreamer = require('connect-restreamer')({stringify:require('querystring').stringify});
    var proxy = httpProxy.createProxyServer({});
    this_obj.server = connect.createServer(
      // Test for minimum viable sanity for an inbound request.  Pass in the proxy object so that
      // the URI and Host header can be matched against the expected values, if provided.
      request_validator,
      // Unpack the body of POSTs so we can use them in signatures.  Note that this
      // will implicitly limit POST size to 1mb.  We may wish to add configuration around
      // this in the future.
      connect.urlencoded(),
      // Reject request with URLs longer than 16kb
      function(req, res, next) {
        if (req.originalUrl.length < MAXIMUM_URL_LENGTH) {
          return next();
        }

        res.writeHead(413, "URL exceeds maximum allowed length for oauth_reverse_proxy");
        res.end();
      },
      // Parse query string
      connect.query(),
      // Parse url once so that it's available in a clean format for the oauth validator
      url_parser,
      // Modify the request headers to add x-forwarded-*
      apply_xforwarded_headers,
      // Check the request against our path/verb whitelist
      whitelist_validator,
      // Add our oauth validator in front of the proxy
      oauth_validator,
      // Update the host header
      modify_host_header,
      // Since connect messes with the input parameters and we want to pass them through
      // unadulterated to the target, we need to add restreamer to the chain.  But we only
      // need to do this if we're given a formencoded request.
      function(req, res, next) {
        if (req.headers && req.headers['content-type'] &&
            req.headers['content-type'].indexOf('application/x-www-form-urlencoded') === 0) {
          // Reconstitute form body only if necessary.
          restreamer(req, res, next);
        } else {
          next();
        }
      },
      function(req, res) {
        // Proxy a web request to the target port on localhost using the provided agent.
        // If no agent is provided, node-http-proxy will return a connection: close.
        proxy.web(req, res, {agent: HTTP_AGENT, target: { 'host' : 'localhost', 'port' : this_obj.config.to_port }});
      }
    );

    // Handle connection errors to the underlying service.  Normal errors returned by the
    // service (like 404s) will get proxied through without any tampering.
    proxy.on('error', function(err, req, res) {
      this_obj.logger.info("Got error %s communicating with underlying server.", util.inspect(err));
      res.writeHead(500, "Connection to " + this_obj.config.service_name + " failed");
      res.end();
    });

    // Start watching the key directory for changes
    this_obj.keys.setupWatcher();

    // Begin listening for incoming requests
    this_obj.logger.info("Listening on port %s", this_obj.config.from_port);
    this_obj.server.listen(this_obj.config.from_port);

    cb(null, this_obj);
  });
};

// Expose Proxy class.
module.exports = Proxy;
