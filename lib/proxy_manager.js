var _ = require('underscore');
var fs = require('fs');
var path = require('path');

var Proxy = require('./proxy');
var ProxyConfig = require('./proxy/config.js');

var logger = require('./logger.js').getLogger({'module': __filename});

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

  CONFIG_DIR = path.resolve(config_dir);

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

/**
 * Given a proxy, start it and fire the callback once complete.
 */
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
 * Create a callback handler for loadConfigFiles.  This will wait until it has been called
 * required_calls times.  Any proxies in the stop_me object will be stopped and any in
 * start_me will be started.  Once this is done, cb is called.
 */
function create_proxy_config_finalizer(stop_me, start_me, cb) {

  return function() {

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

    // If we have proxies to start, only call cb once all proxies have been started.
    var deferred_cb = _.after(total_to_start, cb);

    var total_started = 0;
    _.each(start_me, function(proxy, proxy_config_file) {
      setProxyValue(proxy_config_file, proxy);
      startProxy(proxy, function() {
        deferred_cb();
      });
    });
  };
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

  // TODO (@theopak): Consider rewriting this to make it recursive.
  fs.readdir(CONFIG_DIR, function(err, files) {
    /* istanbul ignore if */
    if (err) return cb(err);

    // Require a '.json' file ending and reject dotfiles
    var config_files = [];
    files.forEach(function(file) {
      if (path.basename(file)[0] === '.') {
        return;
      } else if (!/^.*\.(json)$/i.test(file)) {
        return;
      } else {
        config_files.push(file);
      }
    });

    // Create a callback that must be invoked once per file before actually firing.  This callback
    // is responsible for stopping and starting all proxies that have changed state.
    var wrapped_cb = _.after(config_files.length, create_proxy_config_finalizer(stop_me, start_me, cb));

    // If there are no pending files, call wrapped_cb immediately.
    if (config_files.length === 0) return wrapped_cb();

    config_files.forEach(function(file) {
      logger.info('Loading proxy configuration file %s', file);
      fs.readFile(path.resolve(CONFIG_DIR, file), {'encoding': 'utf8'}, function(err, data) {

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

            // If this configuration has failed with the same error as last time we synced, remove
            // it from the list of proxies to stop.
            if (module.exports.proxies[file] === proxy_error) delete stop_me[file];

            return wrapped_cb();
          }
        } catch(e) {
          logger.error("Failed to load proxy %s due to %s", file, e);

          // If this configuration has failed with the same error as last time we synced, remove
          // it from the list of proxies to stop.
          if (module.exports.proxies[file] === e.message) delete stop_me[file]

          setProxyValue(file, e.message);
          return wrapped_cb();
        }

        try {

          // Check for a previously loaded proxy for this configuration file.  If the file was
          // already loaded, we need to decide whether the loaded configuration is still valid.
          var existing_proxy = module.exports.proxies[file];
          if (existing_proxy && existing_proxy.config) {

            // If this proxy is already running with identical config, make no changes to the proxy
            // delete it from stop_me so that it continues running, and return with the callback
            // since we don't want to start a new proxy instance.
            if (existing_proxy.config.equals(proxy_config)) {
              delete stop_me[file];
              return wrapped_cb();
            }
          }

          // If we got here, we know that we either have a proxy with new configuration or we have
          // a brand new proxy.  Either way, we need to add the proxy to the collection of pending
          // proxies to start.
          var proxy = new Proxy(proxy_config);
          start_me[file] = proxy;
          wrapped_cb();
        } catch(e) {
          /* istanbul ignore next */
          var msg = "Uncaught exception starting proxy " + proxy_config.service_name + ": " + e + "\n" + e.stack;

          // If this configuration has failed with the same error as last time we synced, remove
          // it from the list of proxies to stop.
          /* istanbul ignore next */
          if (module.exports.proxies[file] === msg) {
            delete stop_me[file];
          }

          /* istanbul ignore next */
          setProxyValue(file, msg);
          /* istanbul ignore next */
          wrapped_cb();
        }
      });
    });
  });
}
