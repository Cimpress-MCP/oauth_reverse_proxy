var fs = require('fs');
var connect = require('connect');
var httpProxy = require('http-proxy');
var util = require('util');

var urlParser = require('./authenticator.js').urlParser;
var oauthValidator = require('./authenticator.js').oauthValidator;

var sprintf = require('../utils/sprintf').sprintf;

function AuthenticatingProxy(from_port, to_port, key_directory) {
  this.keys = {};
  this.from_port = from_port;
  this.to_port = to_port;
  this.key_directory = key_directory;
  this.proxy_id = sprintf("%s:%s proxy", this.from_port, this.to_port);
  this.logger = require('../utils/logger.js').getLogger(this.proxy_id);
}

/**
 * Walk through the keys directory for this proxy, reading the keys and secrets into a hash
 * that will be passed to the caller as the second parameter of the callback.  If a fatal
 * error occurs, that will be the first parameter of the callback.
 */
AuthenticatingProxy.prototype._loadKeys = function(cb) {
  var this_obj = this;
  var current_keys = {};
  fs.readdir(this_obj.key_directory, function(err, list) {
    if (err) {
      this_obj.logger.error("Failed to read key directory %s", this_obj.key_store);
      return cb("Failed to read key directory " + this_obj.key_store + " due to " + err);
    }
    
    // Process every keyfile in key_directory.  Since this is an uncommon operation and the
    // total number of key files will never be huge, we handle all of these as synchronous
    // operations and return via callback once all files have been read.
    list.forEach(function(consumer_key) {
      try {
        var key_file = this_obj.key_directory + '/' + consumer_key;
        var stat = fs.statSync(key_file);
        if (!stat) {
          return this_obj.logger.error("Failed to stat key file %s for %s", key_file, this_obj.proxy_id);
        }
      
        if (stat.isFile()) {
          var consumer_secret = fs.readFileSync(key_file, {'encoding':'utf8'});
          if (!consumer_secret) return this_obj.logger.error("Failed to read key file %s for %s", key_file, this_obj.proxy_id);
          
          // If we've read a valid consumer_secret from the consumer_key file, add it to
          // the current hash of keys we're tracking.  These will be returned to the caller
          // on completion and will replace the object's keys object in an atomic swap.
          current_keys[consumer_key] = consumer_secret.trim();
        }
      } catch(e) {
        this_obj.logger.error("Caught exception while reading %s: %s", key_file, e);
      } 
    });
    
    cb(null, current_keys);
  });
};

/**
 * Replace all properties in keys with the values in new_keys.  We need to do this because
 * the keys reference used by oauthValidator is set at proxy create time, so we can't just
 * point this_obj.keys to the new key store and expect things to work.
 */
function keySwap(keys, new_keys) {
  for (var key_name in keys) {
    delete keys[key_name];
  }
  
  for (var key_name in new_keys) {
    keys[key_name] = new_keys[key_name];
  }
}

/**
 * Setup a file watch on the key directory for this proxy.  Because of chattiness in the
 * fs.watch API, we add a 5 second quiet period between noticing the file change and
 * loading the keys.
 */
AuthenticatingProxy.prototype._setupKeyWatcher = function() {
  var this_obj = this;
  // Set up listener for key changes
  this_obj.logger.info("Setting up watcher for directory %s", this_obj.key_directory);
  var keystore_reload_pending = false;
  fs.watch(this_obj.key_directory, function(event, filename) {
    if (!keystore_reload_pending) {
      // Do not allow more file updates to be queued during the 5 seconds we're waiting for
      // the timeout function to run.
      keystore_reload_pending = true;
      this_obj.logger.debug("Entering quiet period for file updates in %s", this_obj.key_directory);
      setTimeout(function() {
        // Once the settimeout has fired, allow keystore reloads to be queued again.
        keystore_reload_pending = false;
        // We don't care what type of event happened in the key directory.  We do a full
        // reload of the keystore regardless.
        this_obj._loadKeys(function(err, current_keys) {
          if (err) return this_obj.logger.error("Failed to load keys at proxy startup.  %s", err);
          this_obj.logger.info("Reloaded keys due to change.");
          keySwap(this_obj.keys, current_keys);
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
AuthenticatingProxy.prototype.start = function() {
  var this_obj = this;
  this_obj._loadKeys(function(err, current_keys) {
    if (err) this_obj.logger.error("Failed to load keys at proxy startup.  %s", err);
    this_obj.keys = current_keys;
    var proxy = httpProxy.createProxyServer({});
    this_obj.server = connect.createServer(
      // Unpack the body of POSTs so we can use them in signatures.  Note that this
      // will implicitly limit POST size to 1mb.  We may wish to add configuration around
      // this in the future.
      connect.urlencoded(),
      // Parse query string
      connect.query(),
      // Parse url once so that it's available in a clean format for the oauth validator
      urlParser(),
      // Add our oauth validator in front of the proxy
      oauthValidator(this_obj.keys),
      // Since connect messes with the input parameters and we want to pass them through
      // unadulterated to the proxy, we need to add restreamer to the chain.
      require('connect-restreamer')({stringify:require('querystring').stringify}),
      function(req, res, next) {
        proxy.web(req, res, {target: { 'host' : 'localhost', 'port' : this_obj.to_port }});
      }
    );
    
    this_obj._setupKeyWatcher();

    // Begin listening for incoming requests
    this_obj.server.listen(this_obj.from_port);
  });
};

// Expose AuthenticatingProxy class to auspice, to be used by clients such as the proxy_manager
// to create proxies based on some provided configuration.  Currently, configuration is loaded
// from disk.
exports.AuthenticatingProxy = AuthenticatingProxy;
