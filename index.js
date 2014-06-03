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

var auspice = require('./lib');
var logger = require('./utils/logger.js').getLogger('auspice');

try {
  var config = require('./utils/config_loader.js').getState(process.env.AUSPICE_CONFIG);
} catch(e) {
  logger.error('Failed to load Auspice config due to %s', e);
  process.exit(4);
}

process.on('uncaughtException', function(err) {
  // If an exception blew up a function, log it.  We'll want to audit these via
  // logstash and address the root cause.
  logger.error(err);
});

// Create an auspice instance at our configured root dir.
auspice.init(config.root_dir, function(err, proxy) {
  // If we caught a fatal error creating the proxy, log it and pause briefly before exiting
  // to give logstash a chance to flush this error message.
  if (err) {
    logger.fatal("Failed to create proxy due to " + err);
    setTimeout(function() {
      process.exit(1);
    }, 2000);
  }
});
