var fs = require('fs');
var path = require('path');

var Proxy = require('./proxy');
var ProxyConfig = require('./proxy/config.js');

var logger = require('./logger.js');

/**
 * An oauth_reverse_proxy instance is initialized around a configuration directory.  Each proxy
 * is represented by a JSON configuration file in this directory.
 *
 * The directory is loaded once on startup.  There is currently no provision for polling configuration
 * files and restarting proxies.  TODO: Should there be?
 */
exports.init = function(config_dir, cb) {

  if (!config_dir) return cb("Failed to open directory " + config_dir);

  fs.stat(config_dir, function(err, stat) {
    /* istanbul ignore next */
    if (err) return cb("Failed to open directory " + config_dir);

    if (!stat.isDirectory()) return cb('oauth_reverse_proxy config dir is not a directory');

    // Load all proxy configurations.
    loadConfigFiles(config_dir, cb);
  });
};

/**
 * Each proxy is defined by a JSON file that stores the configuration of the proxy.
 */
function loadConfigFiles(config_dir, cb) {

  logger.info("Config dir is %s", config_dir);

  // Stores all proxies created from configuration files in config_dir.  If a proxy can not be loaded
  // the config file name will map to the error message instead of a proxy object.
  var proxies = {};

  fs.readdir(config_dir, function(err, files) {
    if (err) return cb(err);

    // Fire a callback only once all config files have been processed.
    var countdown = files.length;
    var wrapped_cb = function() {
      --countdown;
      if (countdown <= 0) return cb(null, proxies);
    };

    files.forEach(function(file) {
      logger.info('Loading proxy configuration file %s', file); 
      fs.readFile(config_dir + path.sep + file, {'encoding':'utf8'}, function(err, data) {
        try {
          // Parse the configuration into an object, create a ProxyConfig around it, and validate
          // that the configuration meets our viability requirements.
          var config = JSON.parse(data);
          var proxy_config = new ProxyConfig(config);
          if (!proxy_config.isValid()) {
            proxies[file] = "Failed to load proxy " + config.service_name;
            return wrapped_cb();
          }
        } catch(e) {
          proxies[file] = "Failed to parse configuration for proxy:\n" + data;
          return wrapped_cb();
        }

        try {
          // Create and start a proxy around a validated config.
          var proxy = new Proxy(proxy_config);
          proxy.start(function(err) {
            if (err) {
              proxies[file] = "Failed to start proxy " + proxy_config.service_name + " due to " + err;
              return wrapped_cb();
            }

            logger.info("Started proxy %s", proxy_config.service_name);
            proxies[file] = proxy;
            wrapped_cb();
          });
        /* istanbul ignore next */
        } catch(e) {
          proxies[file] = "Uncaught exception starting proxy " + proxy_config.service_name + ": " + e + "\n" + e.stack;
          wrapped_cb();
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
