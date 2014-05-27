/**
 * If we're running as a Windows service, we'll have an environment variable
 * pointing to the correct working dir for the app.  Update the working dir
 * before doing anything involving relative paths.
 */
if (process.env.AUSPICE_HOME) {
  console.log("Changing home directory to " + process.env.AUSPICE_HOME);
  process.chdir(process.env.AUSPICE_HOME);
}

// Including this module validates that the environment variables are correctly configured.
// Any failure will terminate this process with an error.
require('./utils/environment_validator.js');

var proxy_manager = require('./lib/proxy_manager.js');
var logger = require('./utils/logger.js').getLogger('auspice');

try {
  var config = require('./utils/config_loader.js').getState(process.env.AUSPICE_CONFIG);
} catch(e) {
  logger.error('Failed to load auspice config due to %s', e);
  process.exit(4);
}

process.on('uncaughtException', function(err) {
  // If an exception blew up a function, log it.  We'll want to audit these via
  // logstash and address the root cause.
  logger.error(err);
});

// Create a proxy manager at our configured root dir.  It is responsible for traversing
// the key store and creating proxies on the configured ports.
proxy_manager.init(config.root_dir);
