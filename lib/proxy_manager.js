var fs = require('fs');
var path = require('path');

var authenticator = require('./authenticator.js');
var proxy_class = require('./proxy.js').AuthenticatingProxy;

var logger = require('../utils/logger.js').getLogger('proxy_manager');

/**
 * An instance of Auspice is initialized around a keystore on the filesystem,
 * provided in the root_dir variable.  Within root_dir directory is a tree that contains
 * the configuration of the Auspice instance.  In the currently suported instantiation,
 * where an instance of Auspice proxies a single port, the keystore directory tree would
 * look like this on Unix:
 *
 *    /keystore/from_port/to_port
 *
 * And like this on Windows:
 * 
 *    C:\keystore\from_port\to_port
 *
 * As a concrete example, a proxy from port 8000 to 80 where root_dir is /var/auspice/
 * would be represented by the following directory tree:
 *
 *    /var/auspice/8000/80
 *
 * The keys used for authenticating requests are stored in the innermost directory.  Each
 * file in this directory is treated as an OAuth credential pair, with the filename being
 * the consumer key and the contents of the file being the consumer secret.
 *
 * The above proxy configured with a single consumer key named 'test-key' and consumer secret
 * of 'terrible-consumer-secret' would contain the following as the sole entry in the
 * innermost keystore directory:
 *
 *    /var/auspice/8000/80/test-key
 *
 * The contents of this file would be 'terrible-consumer-secret'
 *
 * An Auspice proxy will manage its keystore and watch for changes to the filesystem.  As
 * keys are added, removed, or changed, the proxy will dynamically reconfigure to reflect the
 * new set of credentials.  This is handled within an AuthenticatingProxy object exposed by the
 * proxy module and instantiated by proxy_manager.
 */
exports.init = function(root_dir) {
  
  if (root_dir == undefined || !fs.existsSync(root_dir)) {
    logger.error("Failed to open directory %s", root_dir);
    process.exit(1);
  }
  
  // Traverse the key directory, validating the correct layout.
  interrogateRootDirectory(root_dir);
};

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
 * Each proxy is defined by a directory structure convention:
 *    /root_dir/from_port/to_port/
 *
 * Within the to_port directory is a series of files, each of which is a consumer
 * key authorized to access the proxy.  The filename is the key, and the contents
 * are the consumer secret.
 * 
 * We know based on the AUSPICE_PROXY_PORT which from_port directory to open.  If
 * this directory is not found, an exception will be logged and proxy startup
 * will fail. 
 * 
 * If there is more than one file in the from_port directory, we log an error.  The
 * first numeric directory found is used as the to_port.
 */
function interrogateRootDirectory(root_dir) {
  
  try {
    var from_port = process.env.AUSPICE_PROXY_PORT;
    var from_port_path = root_dir + path.sep + from_port;
    var to_port_list = fs.readdirSync(from_port_path);
    if (to_port_list.length > 1) {
      logger.error("There is more than 1 entry in %s.  Defaulting to first numeric directory", from_port_path);
    }
  
    // Use a standard for loop here rather than forEach because we want to terminate
    // on the first match.
    for (var i=0; i<to_port_list.length; ++i) {
      var to_port = to_port_list[i];
      if (isNaN(parseInt(to_port)))
        return logger.error("port path values must be ints.  Value %s will be ignored.", to_port);
      var to_port_path = from_port_path + path.sep + to_port;
      var stat = fs.statSync(to_port_path);
      if (stat.isDirectory()) {
        // Once we get here, we know we have a valid from and to port for a proxy, so we can
        // traverse into that directory and create a new proxy object.  We also know that we
        // don't need to loop anymore because multiple proxies with the same inbound port
        // doesn't make any kind of sense.
        return createProxy(to_port_path, from_port, to_port);
      }
    }
  } catch (e) {
    logger.error("Failed to create proxy due to %s", e);
  }
  
  // If we got here, we know that the directories for Auspice are misconfigured because
  // we failed in some synchronous operation or were unable to find a numeric to_port directory.
  logger.fatal("No proxy created.  Auspice startup aborted.");
}

