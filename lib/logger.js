var util = require('util');

var bunyan = require('bunyan');

// Create a default logger to use if all else fails.
var default_logger = bunyan.createLogger({name: 'oauth_reverse_proxy'});

// TODO: Wire up file logging

// Init the logger with a configuration object
/* istanbul ignore next */
module.exports.getLogger = function(config) {

  // If no logger config is provided, there's nothing more to do.  We'll just continue using the
  // default logger.
  if (!config) return default_logger;

  return default_logger.child(config);
};
