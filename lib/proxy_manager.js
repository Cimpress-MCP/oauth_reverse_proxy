var fs = require('fs');

var authenticator = require('./authenticator.js');
var proxy_class = require('./proxy.js').AuthenticatingProxy;

var config_loader = require('../utils/config_loader.js');
var logger = require('../utils/logger.js').getLogger('proxy_manager');

var PROXY_CACHE = {};

function createProxy(path, from_port) {

  try {
    logger.info("Adding proxy on port %s", from_port);
    var config_path = path + '/config.json';
    if (!fs.existsSync(config_path)) return logger.error("No config path for proxy on port %s", from_port);
    var config = config_loader.getState(config_path);
  
    if (config.to_port == undefined) return logger.error("The configuration must contain a to_port value");
    if (isNaN(parseInt(config.to_port))) return logger.error("The to_port configuration value must be an int");
    
    var key_path = path + '/keys';
    if (!fs.existsSync(key_path)) return logger.error("No keys directory for proxy on port %s", from_port);
    var stats = fs.statSync(key_path);
    if (!fs.statSync(key_path).isDirectory()) 
      return logger.error("Keys path %s for proxy on port %s is not a directory", key_path, from_port);
    
    var proxy = new proxy_class(from_port, config.to_port, key_path);
    logger.debug("Starting proxy on port %s", from_port);
    proxy.start();
    
    PROXY_CACHE[from_port] = proxy;
    
  } catch(e) {
    logger.error("Failed to create proxy on port %s due to %s", from_port, e)
  }
}

function interrogateRootDirectory(path) {
  // Walk all host directories
  fs.readdir(path, function(err, list) {
    if (err) return logger.fatal("Failed to interrogate root directory %s", path);
    list.forEach(function(hostname) {
      file = path + '/' + hostname;
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          createProxy(file, hostname);
        }
      });
    });
  });
}

exports.init = function(root_dir) {
  
  if (root_dir == undefined || !fs.existsSync(root_dir)) {
    logger.error("Failed to open directory %s", root_dir);
    Process.exit(1);
  }
  
  // TODO: Validate permissions of directory
  
  // Add listeners for all hosts in directory
  interrogateRootDirectory(root_dir);
  
  // TODO: Add monitor for addition and deletion of directories
  // fs.watch(root_dir, interrogateRootDirectory);
};