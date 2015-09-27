var util = require('util');

var path = require('path');

var bunyan = require('bunyan');

var default_config = {
  name: 'oauth_reverse_proxy',
  streams: [{
    level: process.env.OAUTH_REVERSE_PROXY_LOG_LEVEL || "trace",
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
    "path": path.join(dir, "proxy.log")
  });

  default_logger = bunyan.createLogger(default_config);
};

// Init the logger with a configuration object
/* istanbul ignore next */
module.exports.getLogger = function(config) {

  // If a module was provided, trim it down to just the relative path.
  if (config && config.module)
    config.module = getModulePath(config.module);

  // If no logger config is provided, there's nothing more to do.  We'll just continue using the
  // default logger.
  if (!config) return default_logger;

  return default_logger.child(config);
};

/**
 * Convenience to get the relative path (that is lib/proxy/index.js or the like) from the full path
 * (/Users/wrb/code/oauth_reverse_proxy/lib/proxy/index.js).  Tagging the logger with the current
 * module is helpful for debugging.
 */
var getModulePath = module.exports.getModulePath = function(module_file) {
  var dirs = module_file.split(path.sep);
  var module_path = [];
  for (var i = dirs.length-1; i >= 0; --i) {
    module_path.unshift(dirs[i]);
    if (dirs[i] === 'lib') break;
  }

  // We always assume Unix-style path delimiters just to keep the format consistent for logging.
  return module_path.join('/');
};
