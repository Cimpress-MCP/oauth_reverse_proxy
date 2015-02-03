var _ = require('underscore');
var fs = require('fs');
var path = require('path');

var Proxy = require('./proxy');
var ProxyConfig = require('./proxy/config.js');

var logger = require('./logger.js').getLogger();

// There should only be one proxy_manager, so we want this config_dir to be private
// but global to the module.  Note that this is all-caps, unlike the proxies object,
// to indicate that it is a global value, set at load time and never changed.
var CONFIG_DIR;

// The proxies object on the module stores and exposes all proxies created from configuration
// files in CONFIG_DIR.  If a proxy can not be loaded, the config file name will map to the error
// message instead of a proxy object.
// 
// The properties of this object are updated by the loadConfigFiles method, but this object
// and its contents are externally immutable.
Object.defineProperty(module.exports, 'proxies', { value: {}, enumerable: true } );

module.exports.init = function(config_dir, cb) {
  if (!config_dir) throw new Error("config_directory invalid");

  CONFIG_DIR = config_dir;

  var stat = fs.statSync(CONFIG_DIR);

  if (!stat.isDirectory()) throw new Error('oauth_reverse_proxy config dir is not a directory');

  loadConfigFiles(function(err) {
    // Note, if there is an error loading configuration files, we still setup the directory watcher.
    // This is a rare case where we don't return from an if (err) block.
    if (err) logger.error("Failed initial load of proxy config files: %s", err);

    // Setup the file watcher responsible for loading proxies.
    setupWatcher();

    cb(err);
  });
};

/**
 * Setup a file watch on the directory containing all proxy configurations.  Because of
 * chattiness in the fs.watch API, we add a 5 second quiet period between noticing the file
 * change and loading the proxy configs.
 */
 var setupWatcher = function() {
  var this_obj = this;
  // Set up listener for proxy config changes
  logger.info("Setting up proxy config watcher for directory %s", CONFIG_DIR);
  var config_reload_pending = false;
  fs.watch(CONFIG_DIR, function() {
    if (!config_reload_pending) {
      // Do not allow more file updates to be queued during the 5 seconds we're waiting for
      // the timeout function to run.
      config_reload_pending = true;
      logger.debug("Entering quiet period for file updates in %s", CONFIG_DIR);
      setTimeout(function() {
        // Once the setTimeout has fired, allow keystore reloads to be queued again.
        config_reload_pending = false;
        // We don't care what type of event happened in the config directory.  We do a full
        // reload of the config regardless.
        loadConfigFiles(function(err) {
          /* istanbul ignore next */
          if (err) {
            return logger.error("Failed to load config.  %s", err);
          }
          logger.info("Reloaded proxy config due to change.");
        });
      }, 5000);
    }
  });

};

function startProxy(proxy, cb) {

  proxy.start(function(err) {
    /* istanbul ignore if */
    if (err) {
      // CONTROVERSIAL STATEMENT ALERT: we do not consider a startup error with a
      // proxy to be a fatal error for oauth_reverse_proxy.  As long as at least 1
      // proxy starts properly, we will proceed with proxy creation.  This is to prevent
      // a single busted configuration file from DOSing any other proxies by preventing
      // their startup.
      return cb("Failed to start proxy " + proxy.config.service_name + " due to " + err);
    }

    logger.info("Started proxy %s", proxy.config.service_name);
    cb();
  });
};

/**
 * This is a convenience method to keep the property definition for proxy values a bit
 * more terse.  Note that we use defineProperty with defaults because we want the created
 * to be configurable (that is, deleteable) but not assignable.
 */
function setProxyValue(proxy_config_file, value) {
  Object.defineProperty(module.exports.proxies, proxy_config_file, {value: value, enumerable: true, configurable: true});
}

/**
 * Each proxy is defined by a JSON file that stores the configuration of the proxy.
 */
function loadConfigFiles(cb) {

  logger.info("Config dir is %s", CONFIG_DIR);

  // Keep track of proxies that are either new or have updated configuration.  These will need
  // to be started after the previous instances have stopped.
  var start_me = {};

  // Keep track of the proxies that were registered as of now so that we can compare against
  // the list we're about to load.  Anything that remains in stop_me needs to be stopped before
  // starting any new proxies.
  var stop_me = {};
  _.each(module.exports.proxies, function(proxy, proxy_config_file) {
    stop_me[proxy_config_file] = proxy;
  });

  fs.readdir(CONFIG_DIR, function(err, files) {
    /* istanbul ignore if */
    if (err) return cb(err);

    // Fire a callback only once all config files have been processed.
    var required_calls = 0;
    var wrapped_cb = function() {
      ++required_calls;
      if (required_calls >= files.length) {

        logger.trace('stop_me:\n%s', require('util').inspect(stop_me));
        logger.trace('start_me:\n%s', require('util').inspect(start_me));

        // All configuration files have been processed, so stop and start proxies as needed.
        _.each(stop_me, function(proxy, proxy_config_file) {
          if (proxy && proxy.stop) proxy.stop();
          delete module.exports.proxies[proxy_config_file];
        });

        var total_to_start = _.size(start_me);

        // If there's nothing to start, cb immediately.
        if (total_to_start === 0) return cb();

        var total_started = 0;
        _.each(start_me, function(proxy, proxy_config_file) {
          setProxyValue(proxy_config_file, proxy);
          startProxy(proxy, function() {
            total_started += 1;

            if (total_started === total_to_start) cb();
          });
        });
      }
    };

    files.forEach(function(file) {
      logger.info('Loading proxy configuration file %s', file);
      fs.readFile(CONFIG_DIR + path.sep + file, {'encoding':'utf8'}, function(err, data) {

        try {
          // Parse the configuration into an object, create a ProxyConfig around it, and validate
          // that the configuration meets our viability requirements.
          var config = JSON.parse(data);
          var proxy_config = new ProxyConfig(config);

          // If the proxy configuration is incorrect, consider the proxy failed.
          // CONTROVERSIAL STATEMENT ALERT: we do not consider a configuration error with a
          // proxy to be a fatal error for oauth_reverse_proxy.  As long as at least 1 configuration
          // file is valid, we will proceed with proxy creation.  This is to prevent a single
          // busted configuration file from DOSing any other proxies by preventing their startup.
          var proxy_error = proxy_config.isInvalid();
          if (proxy_error) {
            logger.error("Failed to load proxy %s due to %s", file, proxy_error);
            setProxyValue(file, proxy_error);
            return wrapped_cb();
          }
        } catch(e) {
          logger.error("Failed to load proxy %s due to %s", file, e);
          setProxyValue(file, e.message);
          return wrapped_cb();
        }

        try {

          var existing_proxy = module.exports.proxies[file];
          if (existing_proxy && existing_proxy.config) {
            if (existing_proxy.config.equals(proxy_config)) {
              // If this proxy is already running with identical config, make no changes.
              delete stop_me[file];
              return wrapped_cb();
            } else {
              // If this proxy is already running with different config, stop it.
              stop_me[file] = existing_proxy;
            }
          }

          // Create and start a proxy around a validated config.
          var proxy = new Proxy(proxy_config);
          start_me[file] = proxy;
          wrapped_cb();
        } catch(e) {
          /* istanbul ignore next */
          setProxyValue(file, "Uncaught exception starting proxy " + proxy_config.service_name + ": " + e + "\n" + e.stack);
          /* istanbul ignore next */
          wrapped_cb();
        }
      });
    });
  });
}