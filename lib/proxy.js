var _ = require('underscore');
var fs = require('fs');
var http = require('http');
var path = require('path');
var connect = require('connect');
var httpProxy = require('http-proxy');
var util = require('util');

var authenticator = require('./authenticator.js');
var encoding = require('../utils/encoding.js');
var header_modifier = require('./header_modifier.js');

var apply_xforwarded_headers = header_modifier.applyXForwardedHeaders();
var url_parser = authenticator.urlParser();

var logger = require('../utils/logger.js').getLogger('proxy');

var MAXIMUM_URL_LENGTH = 16*1024;
var VALID_SECRET_PATTERN = /^[-_.=a-zA-Z0-9]+$/;
var CONFIG_FILE_NAME = 'config.json';

// Increase the maxSockets managed by this process to ensure that we can keep up with many
// concurrent connections under load.  Also, node-http-proxy uses this agent to manage
// connection keep-alives.  If no agent is provided, node-http-proxy will return a connection: close.
var HTTP_AGENT = http.globalAgent;
HTTP_AGENT.maxSockets = 1000;

function authenticatingProxy(from_port, to_port, key_directory) {
  this.keys = {};
  this.from_port = from_port;
  this.to_port = to_port;
  this.key_directory = key_directory;

  var gather_env_variables = function(env_var) {
    /* istanbul ignore else */
    if (env_var) {
      if (env_var.indexOf(',') !== -1) {
        return env_var.split(',');
      } else {
        return [ env_var ];
      }
    }
  };

  // An optional list of allowed Host header or URI path parameters can be specified as environment
  // variables.  Each of these is a substring match with no wildcards.  A string that matches the
  // substring is allowed.  All others are rejected.  Multiple of either setting can be provided.
  this.required_uris = gather_env_variables(process.env.REQUIRED_URIS);
  this.required_hosts = gather_env_variables(process.env.REQUIRED_HOSTS);
}

/**
 * Walk through the keys directory for this proxy, reading the keys and secrets into a hash
 * that will be passed to the caller as the second parameter of the callback.  If a fatal
 * error occurs, that will be the first parameter of the callback.
 */
authenticatingProxy.prototype._loadProxy = function(cb) {
  var this_obj = this;
  var current_keys = {};
  var config = {};
  
  fs.readdir(this_obj.key_directory, function(err, list) {
    if (err) {
      logger.error("Failed to read key directory %s", this_obj.key_directory);
      return cb("Failed to read key directory " + this_obj.key_directory + " due to " + err);
    }

    // Process every keyfile in key_directory.  Since this is an uncommon operation and the
    // total number of key files will never be huge, we handle all of these as synchronous
    // operations and return via callback once all files have been read.
    list.forEach(function(file_name) {
      try {
        var file_path = this_obj.key_directory + path.sep + file_name;
        var stat = fs.statSync(file_path);

        // For code-coverage purposes, ignore this check.  I'm not sure how to test a file
        // that can not be statted, and it would likely wind up in the catch block.
        /* istanbul ignore if */
        if (!stat) {
          return logger.error("Failed to stat key file %s", file_path);
        }

        /* istanbul ignore else */
        if (stat.isFile()) {
          var file_contents = fs.readFileSync(file_path, {'encoding':'utf8'});
          /* istanbul ignore next */
          if (!file_contents) {
            return logger.error("Failed to read key file %s", file_path);
          }

          if(file_name === CONFIG_FILE_NAME) {
            config = JSON.parse(file_contents);
            return logger.info("Loaded configuration data!");;
          }
		  
          // Validate consumer secret
          if (!VALID_SECRET_PATTERN.test(file_contents)) {
            return logger.error("Invalid consumer secret pattern");
          }

          // If we've read a valid consumer_secret from the consumer_key file, add it to
          // the current hash of keys we're tracking.  These will be returned to the caller
          // on completion and will replace the object's keys object in an atomic swap.
          current_keys[file_name] = encoding.encodeData(file_contents);
		  
        } else {
          /* istanbul ignore next */
          logger.error("Key inode %s is not a directory.  Ignoring.", file_path);
        }
      } catch(e) {
        // For code-coverage purposes, ignore this check.  I'm not sure how to test an uncaught
        // exception in this block.
        /* istanbul ignore next */
        logger.error("Caught exception while reading %s: %s", file_path, e);
      }
    });

    cb(null, current_keys, config);
  });
};

/**
 * Replace all properties in keys with the values in new_keys.  We need to do this because
 * the keys reference used by oauthValidator is set at proxy create time, so we can't just
 * point this_obj.keys to the new key store and expect things to work.
 */
function keySwap(keys, new_keys) {
  _.each(keys, function(value, key) {
    delete keys[key];
  });

  // Copy the new keys into the existing keys object.
  _.extend(keys, new_keys);
}

function configSwap(config, new_config) {
  _.each(config.whitelist.methods, function(value, key) {
    delete config[key];
  });
  
  _.each(config.whitelist.paths, function(value, key) {
    delete config[key];
  });
	
  // Copy the new keys into the existing keys object.
  _.extend(config.whitelist, new_config.whitelist);
}

/**
 * Setup a file watch on the key directory for this proxy.  Because of chattiness in the
 * fs.watch API, we add a 5 second quiet period between noticing the file change and
 * loading the keys.
 */
authenticatingProxy.prototype._setupKeyWatcher = function() {
  var this_obj = this;
  // Set up listener for key changes
  logger.info("Setting up watcher for directory %s", this_obj.key_directory);
  var keystore_reload_pending = false;
  fs.watch(this_obj.key_directory, function() {
    if (!keystore_reload_pending) {
      // Do not allow more file updates to be queued during the 5 seconds we're waiting for
      // the timeout function to run.
      keystore_reload_pending = true;
      logger.debug("Entering quiet period for file updates in %s", this_obj.key_directory);
      setTimeout(function() {
        // Once the settimeout has fired, allow keystore reloads to be queued again.
        keystore_reload_pending = false;
        // We don't care what type of event happened in the key directory.  We do a full
        // reload of the keystore regardless.
        this_obj._loadProxy(function(err, current_keys, current_config) {
          /* istanbul ignore next */
          if (err) {
            return logger.error("Failed to load keys.  %s", err);
          }
          logger.info("Reloaded keys due to change.");
          keySwap(this_obj.keys, current_keys);
          configSwap(this_obj.config, current_config);
        });
      }, 5000);
    }
  });

};

/**
 * Initialize the proxy by loading its keys and wiring up a connect pipeline to route
 * the keys and necessary metadata through the oauthValidator before forwarding the
 * request to the target port.
 */
authenticatingProxy.prototype.start = function(cb) {
  var this_obj = this;

  this_obj._loadProxy(function(err, current_keys, config) {
    // If we could not load keys, fail proxy creation.
    if (err) {
      return cb(err);
    }
	
    this_obj.keys = current_keys;
    this_obj.config = config;

    var apply_whitelist = authenticator.applyWhitelist(this_obj.config.whitelist);
    var oauth_validator = authenticator.oauthValidator(this_obj.keys);
    var modify_host_header = header_modifier.modifyHostHeaders(this_obj.from_port, this_obj.to_port);

    var restreamer = require('connect-restreamer')({stringify:require('querystring').stringify});
    var proxy = httpProxy.createProxyServer({});
    this_obj.server = connect.createServer(
      // Test for minimum viable sanity for an inbound request.  Pass in the proxy object so that
      // the URI and Host header can be matched against the expected values, if provided.
      authenticator.requestValidator(this_obj),
      // Unpack the body of POSTs so we can use them in signatures.  Note that this
      // will implicitly limit POST size to 1mb.  We may wish to add configuration around
      // this in the future.
      connect.urlencoded(),
      // Reject request with URLs longer than 16kb
      function(req, res, next) {
        if (req.originalUrl.length < MAXIMUM_URL_LENGTH) {
          return next();
        }

        res.writeHead(413, "URL exceeds maximum allowed length for Auspice");
        res.end();
      },
      // Parse query string
      connect.query(),
      // Parse url once so that it's available in a clean format for the oauth validator
      url_parser,
      // Modify the request headers to add x-forwarded-*
      apply_xforwarded_headers,
      // Add our oauth validator in front of the proxy
      apply_whitelist,
	  
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
        proxy.web(req, res, {agent: HTTP_AGENT, target: { 'host' : 'localhost', 'port' : this_obj.to_port }});
      }
    );

    // Handle connection errors to the underlying service.  Normal errors returned by the
    // service (like 404s) will get proxied through without any tampering.
    proxy.on('error', function(err, req, res) {
      logger.info("Got error %s communicating with underlying server.", util.inspect(err));
      res.writeHead(500, "Connection to " + process.env.AUSPICE_SERVICE_NAME + " failed");
      res.end();
    });

    // Start watching the key directory for changes
    this_obj._setupKeyWatcher();

    // Begin listening for incoming requests
    this_obj.server.listen(this_obj.from_port);

    cb(null, this_obj);
  });
};

// Expose AuthenticatingProxy class to auspice, to be used by clients such as the proxy_manager
// to create proxies based on some provided configuration.  Currently, configuration is loaded
// from disk.
exports.AuthenticatingProxy = authenticatingProxy;
