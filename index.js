/**
 * If we're running as a Windows service, we'll have an environment variable
 * pointing to the correct working dir for the app.  Update the working dir
 * before doing anything involving relative paths.
 */
if (process.env.AUSPICE_HOME) {
  console.log("Changing home directory to " + process.env.AUSPICE_HOME);
  process.chdir(process.env.AUSPICE_HOME);
}

var auspice = require('./lib');
var logger = require('./lib/logger.js');

/**
 * The config path can be provided as an environemnt variable.  If not rpvoided, we chose
 * sane defaults for Windows and non-Windows.
 */
var config_path = process.env.AUSPICE_CONFIG_PATH;
if (!config_path) {
  var os = require('os').type().toLowerCase();
  if (os.indexOf('windows') !== -1 || os.indexOf('cygwin') !== -1) {
    config_path = "C:\\ProgramData\\auspice\\config.d\\";
  } else {
    config_path = "/etc/auspice.d/";
  }
}

// Create an auspice instance at our configured root dir.
auspice.init(config_path, function(err, proxy) {
  // If we caught a fatal error creating the proxies, log it and pause briefly before exiting
  // to give Bunyan a chance to flush this error message.
  if (err) {
    logger.fatal("Failed to create proxy due to %s:\n", err, err.stack);
    setTimeout(function() {
      process.exit(1);
    }, 2000);
  }
});
