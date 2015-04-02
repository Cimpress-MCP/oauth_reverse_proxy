var bad_request = require('../messages/bad_request.js');
var unauthorized = require('../messages/unauthorized.js');

var oauth_constants = require('../oauth/constants.js');

module.exports = function(proxy) {

  var keys = proxy.keystore.keys;

  // Run a series of validations on the request.  If any of the validations fail, an error response will be
  // written to the client, and this method will terminate with error.
  return function(req, res, next) {

    // If this request has already passed a whitelist check, short-circuit this set of validations.
    if (req.whitelist_passed) {
      return next();
    }

    // If we receive an auth header, fail if the auth header is not OAuth
    if (req.headers.authorization && req.headers.authorization.indexOf('OAuth') !== 0) {
      return bad_request(proxy.logger, req, res, 'Authorization type is not OAuth');
    }

    // Only HMAC-SHA1 is supported, per the spec.
    if (req.oauth_params[oauth_constants.OAUTH_SIGNATURE_METHOD] !== oauth_constants.OAUTH_1A_SIGNATURE_METHOD) {
      return bad_request(proxy.logger, req, res, 'Only OAuth 1.0a with HMAC-SHA1 is supported');
    }

    proxy.logger.trace(require('util').inspect(req.oauth_params));

    // Loop over all require oauth parameters and fail if any are missing.
    for (var i=0; i<oauth_constants.REQUIRED_OAUTH_PARAMS_COUNT; ++i) {
      // This test will fail if the parameter is either missing or an empty string
      if (!req.oauth_params[oauth_constants.REQUIRED_OAUTH_PARAMS[i]]) {
        proxy.logger.warn(oauth_constants.REQUIRED_OAUTH_PARAMS[i]);
        return bad_request(proxy.logger, req, res, 'Incomplete OAuth headers');
      }
    }

    // If a version is provided, it must equal '1.0'
    if (req.oauth_params.hasOwnProperty(oauth_constants.OAUTH_VERSION) && req.oauth_params[oauth_constants.OAUTH_VERSION] !== '1.0') {
      return bad_request(proxy.logger, req, res, 'Incorrect OAuth version');
    }

    // If this consumer key is not present in our keystore, reject the request.
    if (!keys.hasOwnProperty(req.oauth_params[oauth_constants.OAUTH_CONSUMER_KEY])) {
      return unauthorized(proxy.logger, req, res, 'Invalid consumer key');
    }

    // If we got here, all critical validations passed.
    next();
  };
};
