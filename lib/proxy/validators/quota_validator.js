var oauth_constants = require('../oauth/constants.js');

var quota_exceeded = require('../messages/quota_exceeded.js');

var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
 * Create a quota validator.  If the request does not exceed our requests per second threshold, allow the request
 * through.  If it does, fail with a 400 error.
 */
module.exports = function(proxy) {

  // If the quota has an interval, convert it from seconds to ms.  Otherwise, default to hits-per-minute.  Note that
  // this interval loop will run every minute, regardless of whether any quotas exist.  It's too tiny a bit of
  // overhead to care about, though.
  var clear_interval = proxy.keystore.quotas.interval;
  if (clear_interval) clear_interval *= 1000;
  else clear_interval = 60*1000;

  setInterval(function() {
    // clear all counters for this quota
    for (var key_name in proxy.keystore.keys) {
      var key = proxy.keystore.keys[key_name];
      // if the counter was exceeded, log an error
      if (key.threshold && key.hits > key.threshold) {
        proxy.logger.error(module_tag, "%s had %s hits in the current interval, greater than the threshold of %s", key_name, key.hits, key.threshold);
      }

      key.hits = 0;
    }
  }, clear_interval);

  return function(req, res, next) {

    // If this request has already passed a whitelist check, short-circuit this set of validations.
    if (req.whitelist_passed) {
      return next();
    }

    // Because this validtor runs after oauth_param_sanity_validator, we know that the consumer key is present in
    // our keystore.  Otherwise, this request would already have been rejected.
    var key = proxy.keystore.keys[req.oauth_params[oauth_constants.OAUTH_CONSUMER_KEY]];

    // Inccrement hit counter for key.
    key.hits += 1;

    // If we've exceeded the threshold for this key, fail the request.
    if (key.threshold && key.hits > key.threshold) {
      return quota_exceeded(proxy.logger, req, res, 'Quota exceeded for consumer_key');
    }

    next();
  };
};
