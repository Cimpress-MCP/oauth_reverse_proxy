var util = require('util');

/**
 * If we're running as a Windows service, we'll have an environment variable
 * pointing to the correct working dir for the app.  Update the working dir
 * before doing anything involving relative paths.
 */
if (process.env.AUSPICE_HOME) {
  console.log("Changing home directory to " + process.env.AUSPICE_HOME);
  process.chdir(process.env.AUSPICE_HOME);
}

var proxy_manager = require('./lib/proxy_manager.js');

var logger = require('./utils/logger.js').getLogger('auspice');

if (!process.env.AUSPICE_CONFIG) {
  logger.error("No config file defined for Auspice.");
  process.exit(1);
}

if (!process.env.AUSPICE_SERVICE_NAME) {
  logger.error("No service name defined for Auspice.");
  process.exit(2);
}

if (!process.env.AUSPICE_VERSION) {
  logger.error("No version defined for Auspice.");
  process.exit(3);
}

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

// We use string trimming throughout the application, so update the prototype here.
if (typeof(String.prototype.trim) === "undefined") {
  // Add a strip command to make input parsing cleaner.
  String.prototype.trim = function() {
    return String(this).replace(/^\s+|\s+$/g, '');
  };
}

// Create a proxy manager at our configured root dir.  All the real work happens
// in there.
proxy_manager.init(config.root_dir);
