var fs = require('fs');
var path = require('path');

var Proxy = require('./proxy');
var ProxyConfig = require('./proxy/config.js');

var logger = require('./logger.js');

/**
 * An Auspice instance is initialized around a configuration directory.  Each Auspice proxy
 * is represented by a JSON configuration file in this directory.
 *
 * The directory is loaded once on startup.  There is currently no provision for polling configuration
 * files and restarting proxies.  TODO: Should there be?
 */
exports.init = function(config_dir, cb) {

  fs.stat(config_dir, function(err, stat) {
    /* istanbul ignore next */
    if (err) return cb(err);

    if (!stat.isDirectory()) return cb('Auspice config dir is not a directory');

    // Load all proxy configurations.
    loadConfigFiles(config_dir, cb);
  });
};

/**
 * Each proxy is defined by a JSON file that stores the configuration of the proxy.
 */
function loadConfigFiles(config_dir, cb) {

  fs.readdir(config_dir, function(err, files) {
    if (err) return cb(err);

    files.forEach(function(file) {
      logger.info('Loading proxy configuration file %s', file); 
      fs.readFile(config_dir + path.sep + file, {'encoding':'utf8'}, function(err, data) {
        try {
          // Parse the configuration into an object, create a ProxyConfig around it, and validate
          // that the configuration meets our viability requirements.
          var config = JSON.parse(data);
          var proxy_config = new ProxyConfig(config);
          if (!proxy_config.isValid()) {
            return logger.warn("Failed to load proxy %s", config.name);
          }
        } catch(e) {
          logger.error("Failed to parse configuration for proxy:\n%s", data);
        }

        try {
          // Create and start a proxy around a validated config.
          var proxy = new Proxy(proxy_config);
          proxy.start(function(err) {
            if (err) return logger.error("Failed to start proxy %s due to %s", proxy_config.service_name, err);

            logger.info("Started proxy %s", proxy_config.service_name);
          });
        } catch(e) {
          cb(e);
        }
      });
    });
  });
}

// Register the catch-all exception handler.  We want to ignore this line for code coverage purposes,
// which the instanbul ignore line accomplishes.
process.on('uncaughtException', /* istanbul ignore next */ function(err) {
  // If an exception blew up a function, log it.  We'll want to audit these via logstash and address the
  // root cause.
  logger.error(err);
});
