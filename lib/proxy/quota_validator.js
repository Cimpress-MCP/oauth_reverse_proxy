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

    // Prebuild the tracker for quotas.

    return function(req,res,next) {
        req.whitelist_passed = whitelist.applyWhitelist(req);

        if(req.whitelist_passed) {
            proxy.logger.info("Proxying URL %s %s%s WHITELIST", req.method, req.headers.host, req.url);
        }

        return next();
    };
};