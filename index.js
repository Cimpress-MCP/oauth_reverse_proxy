var oauth_reverse_proxy = require('./lib');

/**
 * The config path can be provided as an environemnt variable.  If not provided,
 * we choose sane defaults for Windows and non-Windows.
 */
var config_dir = process.env.OAUTH_REVERSE_PROXY_CONFIG_DIR;
if (!config_dir) {
  var os = require('os').type().toLowerCase();
  if (os.indexOf('windows') !== -1 || os.indexOf('cygwin') !== -1) {
    config_dir = "C:\\ProgramData\\oauth_reverse_proxy\\config.d\\";
  } else {
    config_dir = "/etc/oauth_reverse_proxy.d/";
  }
}

/**
 * The logging directory can be provided as an environment variable.  If not provided,
 * we choose sane defaults for Windows and non-Windows.
 */
var log_dir = process.env.OAUTH_REVERSE_PROXY_LOG_DIR;
if (!log_dir) {
  var os = require('os').type().toLowerCase();
  if (os.indexOf('windows') !== -1 || os.indexOf('cygwin') !== -1) {
    log_dir = "C:\\ProgramData\\oauth_reverse_proxy\\logs\\";
  } else {
    log_dir = "/var/log/oauth_reverse_proxy/";
  }
}

try {
  var logger = require('./lib/logger.js').setLogDir(log_dir);
} catch(e) {
  console.err("Failed to initialize logger pointing at %s", log_dir);
  process.exit(1);
}

// Create an oauth_reverse_proxy instance at our configured root dir.
oauth_reverse_proxy.init(config_dir, function(err, proxy) {
  // If we caught a fatal error creating the proxies, log it and pause briefly before exiting
  // to give Bunyan a chance to flush this error message.
  if (err) {
    logger.fatal("Failed to create proxy due to %s:\n", err, err.stack);
    setTimeout(function() {
      process.exit(2);
    }, 2000);
  }
});
