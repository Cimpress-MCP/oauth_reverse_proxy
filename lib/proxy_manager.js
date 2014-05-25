var fs = require('fs');
var path = require('path');

var authenticator = require('./authenticator.js');
var proxy_class = require('./proxy.js').AuthenticatingProxy;

var logger = require('../utils/logger.js').getLogger('proxy_manager');

/**
 * Create an authenticating proxy listening on from_port and forwarding to
 * to_port.  The keys are assumed to be files within proxy_path.
 */
function createProxy(proxy_path, from_port, to_port) {

  try {
    logger.info("Adding proxy from %s to %s", from_port, to_port);
    
    var proxy = new proxy_class(from_port, to_port, proxy_path);
    logger.debug("Starting proxy on port %s", from_port);
    proxy.start();
    
  } catch(e) {
    logger.error("Failed to create proxy on port %s due to %s", from_port, e)
  }
}

/**
 * We need to do this twice in almost exactly the same way, so stuff all the boilerplate
 * logic here and throw the special-case handling in the next function.
 */
function traverseDirectory(root_dir, next) {
  
  var handle_directory = function(port) {
    if (isNaN(parseInt(port)))
      return logger.error("port path values must be ints.  Value %s will be ignored.", port);
    var file = root_dir + path.sep + port;
    fs.stat(file, function(err, stat) {
      if (err) return next(err);
      
      if (stat && stat.isDirectory()) {
        next(null, file, port);
      } else {
        next("Unreadable or non-directory path " + file);
      }
    });
  };
  
  // Walk all host directories
  fs.readdir(root_dir, function(err, list) {
    if (err) return logger.fatal("Failed to interrogate directory %s", root_dir);
    list.forEach(function(port) {
      handle_directory(port);
    });
  });
}

/**
 * Each proxy is defined by a directory structure convention:
 *    /root_dir/from_port/to_port/
 *
 * Within the to_port directory is a series of files, each of which is a consumer
 * key authorized to access the proxy.  The filename is the key, and the contents
 * are the consumer secret.
 */
function interrogateRootDirectory(root_dir) {  
  traverseDirectory(root_dir, function(err, proxy_from_path, from_port) {
    if (err) return logger.error("Failed to traverse proxy from path %s due to %s", root_dir, err);
    
    traverseDirectory(proxy_from_path, function(err, proxy_to_path, to_port) {
      if (err) return logger.error("Failed to traverse proxy to path %s due to %s", proxy_to_path, err);
      
      // Once we get here, we know we have a valid from and to port for a proxy, so we can
      // traverse into that directory and create a new proxy object.
      createProxy(proxy_to_path, from_port, to_port);
    });
  });
}

exports.init = function(root_dir) {
  
  if (root_dir == undefined || !fs.existsSync(root_dir)) {
    logger.error("Failed to open directory %s", root_dir);
    process.exit(1);
  }
  
  // TODO: Validate permissions of directory
  
  // Add listeners for all hosts in directory
  interrogateRootDirectory(root_dir);
};
