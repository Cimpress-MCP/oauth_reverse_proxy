var proxy_manager = require('./proxy_manager.js');

var logger = require('./logger.js').getLogger();

/**
 * An oauth_reverse_proxy instance is initialized around a configuration directory.  Each proxy
 * is represented by a JSON configuration file in this directory.
 *
 * The directory is loaded once on startup.  There is currently no provision for polling configuration
 * files and restarting proxies.  TODO: Should there be?
 */
exports.init = function(config_dir, cb) {
  proxy_manager.init(config_dir, cb);
};

// Register the catch-all exception handler.  We want to ignore this line for code coverage purposes,
// which the instanbul ignore line accomplishes.
process.on('uncaughtException', /* istanbul ignore next */ function(err) {
  // If an exception blew up a function, log it.  We'll want to audit these via logstash and address the
  // root cause.
  logger.error(err);
});
