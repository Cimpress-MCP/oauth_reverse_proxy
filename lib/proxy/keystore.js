var _ = require('underscore');
var fs = require('fs');
var path = require('path');

var encoding = require('../encoding.js');
var logger = require('../logger.js').getLogger({'module': __filename});

var ProxyQuotas = require('./quotas.js');

var VALID_SECRET_PATTERN = /^[-_.=a-zA-Z0-9]+$/;

/**
 * This object is responsible for managing the keys for a proxy.
 */
function ProxyKeystore(config) {
  // Define this property so it doesn't show up as enumerable or writable.
  Object.defineProperty(this, 'oauth_secret_dir', { value: config.oauth_secret_dir });

  // The count property will keep count of the valid keys exposed by this object.
  Object.defineProperty(this, 'count', { value: 0, writable: true });

  // The quota property stores the configured quota for this project.  This is used to validate
  // that keys do not exceed defined usage thresholds.
  Object.defineProperty(this, 'quotas', { value: new ProxyQuotas(config) });

  // Store the keys managed by this object.
  Object.defineProperty(this, 'keys', { value: {}, enumerable: true });
}

/**
 * Walk through the keys directory for this proxy, reading the keys and secrets into a hash
 * that will be passed to the caller as the second parameter of the callback.  If a fatal
 * error occurs, that will be the first parameter of the callback.
 */
ProxyKeystore.prototype.load = function(cb) {
  var this_obj = this;

  // Keep track of the keys that were registered as of now so that we can compare against
  // the list we're about to load.  Anything that remains in delete_me should be, like, deleted.
  var delete_me = {};

  _.each(this_obj.keys, function(value, key) {
    delete_me[key] = true;
  });

  var key_count = 0;

  fs.readdir(this_obj.oauth_secret_dir, function(err, list) {
    if (err) {
      logger.error("Failed to read key directory %s:", this_obj.oauth_secret_dir, err);
      return cb("Failed to read key directory " + this_obj.oauth_secret_dir + " due to " + err);
    }

    // Process every keyfile in key_directory.  Since this is an uncommon operation and the
    // total number of key files will never be huge, we handle all of these as synchronous
    // operations and return via callback once all files have been read.
    list.forEach(function(file_name) {

      // Reject dotfiles
      if (file_name[0] === '.') return;

      try {
        var file_path = path.join(this_obj.oauth_secret_dir, file_name);
        var stat = fs.statSync(file_path);

        // For code-coverage purposes, ignore this check.  I'm not sure how to test a file
        // that can not be statted, and it would likely wind up in the catch block.
        /* istanbul ignore if */
        if (!stat) {
          return logger.error("Failed to stat key file %s", file_path);
        }

        /* istanbul ignore else */
        if (stat.isFile()) {
          var file_contents = fs.readFileSync(file_path, {'encoding':'utf8'}).trim();
          /* istanbul ignore next */
          if (!file_contents) {
            return logger.error("Failed to read key file %s", file_path);
          }

          // Validate consumer secret
          if (!VALID_SECRET_PATTERN.test(file_contents)) {
            return logger.warn("Invalid consumer secret pattern in file %s", file_name);
          }

          // If we've read a valid consumer_secret from the consumer_key file, add it as a property
          // of the current object.  These properties are enumerable and configurable, so future runs
          // of the load command will be able to delete and re-add these properties as necessary.
          Object.defineProperty(this_obj.keys, file_name, { value: {}, configurable: true, enumerable: true });

          // Set the secret associated with the key
          Object.defineProperty(this_obj.keys[file_name], 'secret', { value: encoding.encodeData(file_contents) });

          // Set the threshdold for this key
          var key_threshold = this_obj.quotas.thresholds[file_name] || this_obj.quotas.default_threshold;
          Object.defineProperty(this_obj.keys[file_name], 'threshold', { value: key_threshold });

          // Initialize a quota counter for this key
          Object.defineProperty(this_obj.keys[file_name], 'hits', { value: 0, writable: true });

          // We don't want to delete this property, so delete it from delete_me.
          delete delete_me[file_name];

          // Increment the key count
          ++key_count;

        } else {
          /* istanbul ignore next */
          logger.error("Key inode %s is not a directory.  Ignoring.", file_path);
        }
      } catch(e) {
        // For code-coverage purposes, ignore this check.  I'm not sure how to test an uncaught
        // exception in this block.
        /* istanbul ignore next */
        logger.error("Caught exception while reading %s: %s", file_path, e);
      }
    });

    for (var key_to_delete in delete_me) {
      logger.info("Deleting key %s", key_to_delete);
      delete this_obj.keys[key_to_delete];
    }

    // Set the count property of this object.
    this_obj.count = key_count;

    cb(null);
  });
};

/**
 * Setup a file watch on the key directory for this proxy.  Because of chattiness in the
 * fs.watch API, we add a 5 second quiet period between noticing the file change and
 * loading the keys.
 */
ProxyKeystore.prototype.setupWatcher = function() {
  var this_obj = this;
  // Set up listener for key changes
  logger.info("Setting up watcher for directory %s", this_obj.oauth_secret_dir);
  var keystore_reload_pending = false;
  fs.watch(this_obj.oauth_secret_dir, function() {
    if (!keystore_reload_pending) {
      // Do not allow more file updates to be queued during the 5 seconds we're waiting for
      // the timeout function to run.
      keystore_reload_pending = true;
      logger.debug("Entering quiet period for file updates in %s", this_obj.oauth_secret_dir);
      setTimeout(function() {
        // Once the setTimeout has fired, allow keystore reloads to be queued again.
        keystore_reload_pending = false;
        // We don't care what type of event happened in the key directory.  We do a full
        // reload of the keystore regardless.
        this_obj.load(function(err) {
          /* istanbul ignore next */
          if (err) {
            return logger.error("Failed to load keys.  %s", err);
          }
          logger.info("Reloaded keys due to change.");
        });
      }, 5000);
    }
  });

};

module.exports = ProxyKeystore;
