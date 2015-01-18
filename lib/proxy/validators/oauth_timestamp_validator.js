var unauthorized = require('../messages/unauthorized.js');

var OAUTH_TIMESTAMP = require('../oauth_constants.js').OAUTH_TIMESTAMP;
var OAUTH_TIMESTAMP_MAX_AGE = require('../oauth_constants.js').OAUTH_TIMESTAMP_MAX_AGE;

module.exports = function(proxy) {
  return function(req, res, next) {

    // If this request has already passed a whitelist check, short-circuit this set of validations.
    if (req.whitelist_passed) {
      return next();
    }

    // Check date
    var timestamp_str = req.oauth_params[OAUTH_TIMESTAMP];
    // Pad out timestamp string if it's given in seconds, not ms.  Yes, seconds are in the RFC spec, but some
    // clients will provide ms and ms is the format used within JS.
    if (timestamp_str.length < 11) {
      timestamp_str += '500';
    }
    var timestamp = parseInt(timestamp_str);
    if (isNaN(timestamp)) {
      return unauthorized(proxy.logger, req, res, 'Request expired');
    }

    // Grab current epoch ms time.
    var now = Date.now();
    // We don't want timestamps that are declared far into the future to be considered valid, so treat the
    // allowable delta as an absolute value.
    if (Math.abs(now - timestamp) > OAUTH_TIMESTAMP_MAX_AGE) {
      return unauthorized(proxy.logger, req, res, 'Request expired');
    }

    // If we got here, we know the timestamp is valid and we can move on with our lives.
    next();
  };
};
