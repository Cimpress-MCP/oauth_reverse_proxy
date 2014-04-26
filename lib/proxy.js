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

AuthenticatingProxy.prototype._loadKeys = function(cb) {
  var this_obj = this;
  fs.readdir(this_obj.key_directory, function(err, list) {
    if (err) return this_obj.logger.error("Failed to read key directory %s", this_obj.key_store);
    list.forEach(function(consumer_token) {
      var key_file = this_obj.key_directory + '/' + consumer_token;
      fs.stat(key_file, function(err, stat) {
        if (err) return this_obj.logger.error("Failed to stat key file %s for %s", key_file, this_obj.proxy_id);
        if (stat && stat.isFile()) {
          fs.readFile(key_file, {'encoding':'utf8'}, function(err, consumer_secret) {
            if (err) return this_obj.logger.error("Failed to read key file %s for %s", key_file, this_obj.proxy_id);
            this_obj.keys[consumer_token] = consumer_secret.trim();
          });
        }
      });
    });
    
    cb();
  });
};

AuthenticatingProxy.prototype.start = function() {
  var this_obj = this;
  this_obj._loadKeys(function(err) {
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
      });
      
    // Set up listener for key changes
    fs.watch(this_obj.key_directory, function() {
      // We don't care what type of event happened in the key directory.  We do a full reload of the
      // keystore regardless.
    });

    this_obj.server.listen(this_obj.from_port);
  });
};

exports.AuthenticatingProxy = AuthenticatingProxy;