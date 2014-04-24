var util = require('util');

var proxy_manager = require('./lib/proxy_manager.js');

var logger = require('./utils/logger.js').getLogger('auspice');

// We use string trimming throughout the application, so update the prototype here.
if (typeof(String.prototype.trim) === "undefined") {
  // Add a strip command to make input parsing cleaner.
  String.prototype.trim = function() {
    return String(this).replace(/^\s+|\s+$/g, '');
  };
}

try {
  var config = require('./utils/config_loader.js').getState('config.json');
} catch(e) {
  logger.error('Failed to load auspice config due to %s', e);
  process.exit(1);
}

process.on('uncaughtException', function(err) {
  // handle the error safely
  logger.error(err);
});

proxy_manager.init(config.root_dir);
