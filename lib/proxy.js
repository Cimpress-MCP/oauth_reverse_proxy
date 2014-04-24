var fs = require('fs');
var http = require('http');
var httpProxy = require('http-proxy');
var util = require('util');

var authenticator = require('./authenticator.js');

var sprintf = require('../utils/sprintf').sprintf;

function AuthenticatingProxy(from_port, to_port, key_directory) {
  this.keys = {};
  this.from_port = from_port;
  this.to_port = to_port;
  this.key_directory = key_directory;
  this.proxy_id = sprintf("%s:%s proxy", this.from_port, this.to_port);
  this.logger = require('../utils/logger.js').getLogger(this.proxy_id);
  
  this.target_url = 'http://localhost:' + this.to_port + '/';
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
} 

AuthenticatingProxy.prototype.start = function() {
  var this_obj = this;
  this_obj._loadKeys(function(err) {
    var proxy = httpProxy.createProxyServer({});
    this_obj.server = http.createServer(function(req, res) {
      try {
        this_obj.logger.info("Got req url:\n%s", util.inspect(req.url));
        this_obj.logger.info("Got req auth:\n%s", util.inspect(req.headers.authorization));
        authenticator.authenticateRequest(req, this_obj.keys, function(err) {
          if (err) {
            res.writeHead(401);
            res.write(err);
            return res.end();
          }
          proxy.web(req, res, {target: this_obj.target_url});
        });
      
      } catch(e) {
        this_obj.logger.error("Failed to handle request due to %s", e);
        res.writeHead(500);
        return res.end();
      }

    });
      
    // TODO: Set up listener for key changes

    this_obj.server.listen(this_obj.from_port);
  });
}

exports.AuthenticatingProxy = AuthenticatingProxy;