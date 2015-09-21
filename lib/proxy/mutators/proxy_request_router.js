var encoding = require('../../encoding.js');

var oauth_constants = require('../oauth/constants.js');

var url = require('url');

var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
* The proxy_request_router gathers information from the inbound request to decide where it should
* ultimately be sent.  The request is then rewritten to contain the new host and URL and to remove
* the control information from the request.  The post-condition should be a request that looks
* accurate and well-formed to a third-party, without containing any oauth_proxy-specific detail.
*/

/**
* Go through the auth headers, the query params, and the post body (if applicable) to build the
* set of values that form the signature.
*/
module.exports = function(proxy) {
  return function(req, res, next) {
    req.original_url = req.url;
    req.parsed_original_url = url.parse(req.url, true);

    // Grab the desired consumer key and url from the query string and populate the request.
    req.oauth_params = {};
    req.argument_pairs = [];
    var consumer_key = req.parsed_original_url.query['oauth_proxy_consumer_key'];
    req.argument_pairs[0] = [oauth_constants.OAUTH_CONSUMER_KEY, consumer_key];
    req.oauth_params[oauth_constants.OAUTH_CONSUMER_KEY] = consumer_key;
    req.target_url = req.parsed_original_url.query['oauth_proxy_url'];
    req.parsed_url = url.parse(req.target_url);
    req.url = req.parsed_url.path;

    req.headers['host'] = req.parsed_url.host;
    req.parsed_url.hostname = req.parsed_url.host;
    var idx;
    if ((idx = req.parsed_url.hostname.indexOf(':')) != -1) {
      req.parsed_url.hostname = req.parsed_url.hostname.substring(0, idx);
    }

    proxy.logger.trace(module_tag, "Updated URL to %s", req.url);
    proxy.logger.trace(module_tag, 'headers: %s', require('util').inspect(req.headers));

    next();
  }
};
