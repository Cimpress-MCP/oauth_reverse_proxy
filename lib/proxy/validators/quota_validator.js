/**
 * Create a quota validator.  If the request does not exceed our requests per second threshold, allow the request
 * through.  If it does, fail with a 403 error.
 */
module.exports = function(proxy) {

  // If the quota has an interval, convert it from seconds to ms.  Otherwise, default to hits-per-second.
  var clear_interval = proxy.keystore.quotas.interval;
  if (clear_interval) clear_interval *= 1000;
  else clear_interval = 1000;

  setInterval(function() {
    // clear all counters for this quota
    for (var key_name in proxy.keystore.keys) {
      var key = proxy.keystore.keys[key_name];
      // if the counter was exceeded, log an error
      if (key.threshold && key.hits > key.threshold) {
        logger.error("%s had %s hits in the current interval, greater than the threshold of %s", key, current_val);
      }

      key.hits = 0;
    }
  }, clear_interval);

  return function(req, res, next) {

    // If this request has already passed a whitelist check, short-circuit this set of validations.
    if (req.whitelist_passed) {
      return next();
    }

    // TODO: Implement quota validation logic
    next();
  };
};