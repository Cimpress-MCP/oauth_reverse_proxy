var bad_request = require('../messages/bad_request.js');
var unauthorized = require('../messages/unauthorized.js');

/**
 * Create a request sanity validator.  If the request does not pass these tests, it is a failed request and
 * shouldn't make it to any of the other phases of validation.
 */
module.exports = function(proxy) {

  var keys = proxy.keys;

  return function(req, res, next) {
    if (!req || !req.headers || !req.method || !req.url) {
      return bad_request(proxy.logger, req, res, 'Invalid request');
    }

    var check_collection = function(coll, comparison_string, error_message) {
      for (var i=0; i<coll.length; ++i) {
        var val = coll[i];
        if (comparison_string.indexOf(val) !== -1) {
          return true;
        }
      }

      return unauthorized(proxy.logger, req, res, error_message);
    };

    /* istanbul ignore else */
    if (proxy.config.required_uris && !check_collection(proxy.config.required_uris, req.url, 'Unmatched URI')) {
      return bad_request(proxy.logger, req, res, 'Invalid request');
    }

    /* istanbul ignore else */
    if (proxy.config.required_hosts && !check_collection(proxy.config.required_hosts, req.headers.host, 'Unmatched Host header')) {
      return bad_request(proxy.logger, req, res, 'Invalid request');
    }

    next();
  };
};
