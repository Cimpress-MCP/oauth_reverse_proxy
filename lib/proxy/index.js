var _ = require('underscore');
var connect = require('connect');
var fs = require('fs');
var http = require('http');
var https = require('https');
var qs = require('qs');
var url = require('url');
var http_proxy = require('http-proxy');
var querystring = require('querystring');
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

var HTTPS_AGENT = https.globalAgent;
HTTPS_AGENT.maxSockets = 100;

// Ignore invalid SSL certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * Ordered list of mutators, validators, parsers, and other middleware for a proxy or reverse proxy.
 * @param {Object} this_obj – A `this` Object to bind to.
 * @param {Boolean} is_reverse_proxy - A falsey value (default) results in only forward proxy middleware being
 * returned. A truthy value results in only reverse proxy middleware being returned.
 * @returns {Object[]} middleware_list - Array of anonymous objects with `Object.value` containing an object evaluated
 * using the passed in parameters. `Object.(forward|reverse)_proxy === true` iff the middleware should be used for a
 * forward or reverse proxy, respectively. Order matters!
 */
function getMiddlewareList(this_obj, is_reverse_proxy) {
  // is_reverse_proxy = (is_reverse_proxy === true) || false;
  var middleware_list = [
    {
      name: 'request_sanity_validator',
      desc: 'Test for minimum viable sanity for an inbound request. Pass in the proxy object so that the URI and Host header can be matched against the expected values, if provided.',
      forward_proxy: true,
      reverse_proxy: true,
      value: require('./validators/request_sanity_validator.js')(this_obj)
    }, {
      name: 'url_length_validator',
      desc: 'Reject request with URLs longer than 16kb.',
      forward_proxy: true,
      reverse_proxy: true,
      value: require('./validators/url_length_validator.js')(this_obj)
    }, {
      name: 'form_parser',
      desc: 'Unpack the body of POSTs so we can use them in signatures. Note that this will implicitly limit POST size to 1mb. We may wish to add configuration around this in the future.',
      forward_proxy: true,
      reverse_proxy: true,
      value: require('./mutators/urlencoded_bodyparser.js')(this_obj)
    }, {
      name: 'proxy_request_router',
      desc: 'Parse the inbound request to figure out its destination and desired key.  Rewrite the request to include that information before signing and remove any control information sent to the proxy.',
      forward_proxy: true,
      reverse_proxy: false,
      value: require('./mutators/proxy_request_router.js')(this_obj)
    }, {
      name: 'query_string_parser',
      desc: 'Parse query string',
      forward_proxy: true,
      reverse_proxy: true,
      value: require('./mutators/query_parser.js')(this_obj)
    }, {
      name: 'url_parser',
      desc: 'Parse url once so that its available in a clean format for the oauth validator.',
      forward_proxy: false,
      reverse_proxy: true,
      value: require('./mutators/url_parser.js')(this_obj)
    }, {
      name: 'oauth_param_collector',
      desc: 'Gather the oauth params from the request',
      forward_proxy: false,
      reverse_proxy: true,
      value: require('./mutators/oauth_param_collector.js')(this_obj)
    }, {
      name: 'forward_header_mutator',
      desc: 'Parse url once so that its available in a clean format for the oauth param generator. \
      Modify the request headers to add x-forwarded-*',
      forward_proxy: true,
      reverse_proxy: true,
      value: require('./mutators/forward_header_mutator.js')(this_obj)
    }, {
      name: 'whitelist_validator',
      desc: 'Check the request against our path/verb whitelist.',
      forward_proxy: false,
      reverse_proxy: true,
      value: require('./validators/whitelist_validator.js')(this_obj)
    }, {
      name: 'oauth_param_sanity_validator',
      desc: 'Validate that the oauth params pass a set of viability checks (existence, version, etc).',
      forward_proxy: false,
      reverse_proxy: true,
      value: require('./validators/oauth_param_sanity_validator.js')(this_obj)
    }, {
      name: 'quota_validator',
      desc: 'Validate that the request is within quota.',
      forward_proxy: true,
      reverse_proxy: true,
      value: require('./validators/quota_validator.js')(this_obj)
    }, {
      name: 'oauth_timestamp_validator',
      desc: 'Validate that the timestamp of the request is legal.',
      forward_proxy: false,
      reverse_proxy: true,
      value: require('./validators/oauth_timestamp_validator.js')(this_obj)
    }, {
      name: 'oauth_signature_validator',
      desc: 'Perform the oauth signature validation.',
      forward_proxy: false,
      reverse_proxy: true,
      value: require('./validators/oauth_signature_validator.js')(this_obj)
    }, {
      name: 'oauth_param_generator',
      desc: 'Validate that the timestamp of the request is legal',
      forward_proxy: true,
      reverse_proxy: false,
      value: require('./mutators/oauth_param_generator.js')(this_obj)
    }, {
      name: 'host_header_mutator',
      desc: 'Update the host header.',
      forward_proxy: false,
      reverse_proxy: true,
      value: require('./mutators/host_header_mutator.js')(this_obj)
    }, {
      name: 'auth_header_remover',
      desc: 'We have no need for the auth header and dont want to proxy it on to the target host, so strip it.',
      forward_proxy: false,
      reverse_proxy: true,
      value: require('./mutators/auth_header_remover.js')(this_obj)
    }, {
      name: 'restreamer',
      desc: 'Since connect messes with the input parameters and we want to pass them through unadulterated to the target, we need to add restreamer to the chain.',
      forward_proxy: true,
      reverse_proxy: true,
      value: require('./mutators/restreamer.js')({stringify: querystring.stringify})
    },


  ];

  return _.filter(middleware_list, function(m) {
    if (is_reverse_proxy === true)
      return (m.reverse_proxy === true);
    else
      return (m.forward_proxy === true);
  });
}

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

  this.logger = require('../logger.js').getLogger({'service_name': this.config.service_name});

  this.logger.debug(module_tag, "Starting proxy on port %s", this.config.from_port);
}

/**
 * Returns a connect() pipeline for evaluating inbound requests and handing OAuth signatures.
 * In the case of a forward proxy (default), an OAuth signature is applied to each request before it's forwarded on.
 */
Proxy.prototype.getConnectApp = function() {
  var this_obj = this;

  // Handle connection errors to the underlying service. Normal errors returned
  // by the service (like 404s) will get proxied through without any tampering.
  var proxy = http_proxy.createProxyServer({});
  proxy.on('error', function(err, req, res) {
    // HACK: fix via https://github.com/nodejitsu/node-http-proxy/issues/867
    if (!res.finished) {
      this_obj.logger.info(module_tag, 'Got error %s communicating with underlying server.', util.inspect(err));
      res.writeHead(500, 'Connection to ' + this_obj.config.service_name + ' failed');
      res.end();
    }
  });

  // Apply the appropriate middleware to `connect()`.
  var app = connect();
  var is_reverse_proxy = this.config.isReverseProxy();
  var middleware_list = getMiddlewareList(this, is_reverse_proxy);
  _.each(middleware_list, function(middleware) {
    app.use(middleware.value);
  });

  if (is_reverse_proxy) {
    // Reverse proxy a web request to the target port on the target host using the provided agent.
    // If no agent is provided, node-http-proxy will return a connection: close.
    app.use(function(req, res) {
      var https = this_obj.config.to_port === 443 || this_obj.config.to_port_is_https;
      var agent = https ? HTTPS_AGENT : HTTP_AGENT;
      var secure = https && this_obj.config.validate_target_cert;

      proxy.web(req, res, {
        agent: agent,
        target: {
          'host': this_obj.config.target_host,
          'port': this_obj.config.to_port
        },
        secure: secure
      });
    });
  } else {
    // Forward proxy a web request to the target url using the provided agent.
    // If no agent is provided, node-http-proxy will return a connection: close.
    app.use(function(req, res) {

      var agent = req.parsed_url.protocol === 'https:' ? HTTPS_AGENT : HTTP_AGENT;

      this_obj.logger.debug(module_tag, 'headers:\n%s', require('util').inspect(req.headers));
      this_obj.logger.debug(module_tag, 'target_url: %s', req.target_url);

      // This logic is really annoying due to the way node-http-proxy is designed.  We need
      // precise control of the proxy path because it's part of the signature, but node-http-proxy
      // will slap a / on the end of a path if it's not there.  To get around this, we need to
      // use the prependPath and toProxy params and set the request of the proxy request to ''.
      // The logic inside node-http-proxy will take this combination of parameters and values to
      // mean that the proxied path should be req.url + target.path, that is, '' + target.path.
      // NOTE: Any time we upgrade node-http-proxy, we'll probably need to revisit this.
      req.url = '';
      proxy.web(req, res, {
        prependPath: true,
        toProxy: true,
        agent: agent,

        target: url.parse(req.target_url),
        secure: this_obj.config.validate_target_cert
      });
    });
  }

  // Return the configured `connect()` instance, which owns the `http-proxy.proxy()` instance.
  return app;
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
        try {
          return https.createServer({
            key: fs.readFileSync(this_obj.config.https_key_file),
            cert: fs.readFileSync(this_obj.config.https_cert_file)
          }, app);
        } catch(e) {
          logger.error('Failed to start https server due to %s', e);
        }
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
    /* istanbul ignore next */
    backup_server.on('listening', function(err) {
      if (err) return this_obj.logger.debug("Not listening on backup server due to error: %s", err);

      Object.defineProperty(this_obj, 'backup_server', { 'value': backup_server, writable: false, enumerable: true });
    });
    backup_server.on('error', function(err) {
      if (err) return this_obj.logger.debug("Backup server init error: %s", err);
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

  /* istanbul ignore if */
  if (this.backup_server) {
    this.backup_server.close();
  }
};

// Expose Proxy class.
module.exports = Proxy;
