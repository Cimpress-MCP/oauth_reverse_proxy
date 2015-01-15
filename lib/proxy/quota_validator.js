/**
 * Create a quota validator.  If the request does not exceed our requests per second threshold, allow the request
 * through.  If it does, fail with a 403 error.
 */
exports.quotaValidator = function(proxy){

  var quota = new proxy.config.quota;

  // If the quota has an interval, convert it from seconds to ms.
  var clear_interval = quota.interval;
  if (clear_interval) clear_interval *= 1000;
  // Otherwise default to a requests-per-second quota.
  else clear_interval = 1000;

  var counters = {};

  try {
    var catch_all_threshold = parseInt(quota['default']);
  } catch(e) {
    logger.error("Failed to parse default quota threshold %s", quota['default']);
  }

  // Make sure all thresholds are ints so that conversion cost is paid up-front.
  for (var key in quota.thresholds) {
    try {
      var threshold = parseInt(quota.thresholds);
      quota.thresholds[key] = threshold;
      logger.trace("The quota for %s is %s", key, threshold);
    } catch(e) {
      logger.error('Failed to parse quota threshold %s for key %s', quota.threshold, key);
    }
  }

  setInterval(function() {
    // clear all counters for this quota
    for (var key in counters) {
      // if the counter was exceeded, log an error
      var threshold = quota.thresholds[key] || catch_all_threshold;
      var current_val = counters[key]
      if (threshold && current_val > threshold) {
        logger.error("%s had %s hits in the current interval, greater than the threshold of %s", key, current_val);
      }

      counters[key] = 0;
    }
  }, clear_interval);

  return function(req,res,next) {
    req.whitelist_passed = whitelist.applyWhitelist(req);

    if(req.whitelist_passed) {
      proxy.logger.info("Proxying URL %s %s%s WHITELIST", req.method, req.headers.host, req.url);
    }

    return next();
  };
};