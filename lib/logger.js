var util = require('util');

var path = require('path');

var bunyan = require('bunyan');

var default_config = {
  name: 'oauth_reverse_proxy',
  streams: [{
    level: process.env.OAUTH_REVERSE_PROXY_LOG_LEVEL || "warn",
    stream: process.stdout
  }]
};

// Create a default logger to use if all else fails.
var default_logger = bunyan.createLogger(default_config);

/* istanbul ignore next */
module.exports.setLogDir = function(dir) {
  default_config.streams.push({
    "level": process.env.OAUTH_REVERSE_PROXY_LOG_LEVEL || "info",
    "type": "rotating-file",
    "path": dir + path.sep + "proxy.log"
  });

  default_logger = bunyan.createLogger(default_config);
};

// Init the logger with a configuration object
/* istanbul ignore next */
module.exports.getLogger = function(config) {

  // If no logger config is provided, there's nothing more to do.  We'll just continue using the
  // default logger.
  if (!config) return default_logger;

  return default_logger.child(config);
};
