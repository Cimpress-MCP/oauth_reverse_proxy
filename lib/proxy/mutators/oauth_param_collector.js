var encoding = require('../../encoding.js');

var oauth_constants = require('../oauth/constants.js');

var oauth1a_signature_utils = require('../oauth/signatures/oauth1a.js');
var util = require("util");

var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
 * This mutator is responsible for scouring an inbound request and gathering OAuth parameters.  These
 * parameters are cached in the request in an efficient format for processing by validators later in
 * the pipeline.
 */

/**
 * Go through the auth headers, the query params, and the post body (if applicable) to build the
 * set of values that form the signature.
 */
module.exports = function(proxy) {
  return function(req, res, next) {
    req.oauth_params = {};
    req.argument_pairs = [];
    if (req.headers.authorization) {
      // If the OAuth creds are provided as an auth header, enumerate them here and add them to the
      // list of things we need to sign.
      var auth_header = req.headers.authorization;
      auth_header = auth_header.substring(6);

      var auth_header_parts = auth_header.split(/[=,\,,"]/);

      // Terminate this loop early if the list of header parts isn't cleanly divisble by 4.  This can happen
      // if a client sends us parameters with a trailing comma, and we don't want to fail to authenticate
      // those clients due to an exception accessing auth_header_parts[i+2] even if those clients suck.
      for (var i=0; i < auth_header_parts.length-2; i+=4) {
        var param_name = auth_header_parts[i].trim();
        if (param_name === 'realm') {
          continue;
        }
        var param_value = auth_header_parts[i+2].trim();
        // For any auth header param other than the oauth signature, add it to the argument pairs array.  This array
        // is used for signing, and we don't want to re-sign the signature.
        if (param_name !== oauth_constants.OAUTH_SIGNATURE) {
          req.argument_pairs.push([param_name, param_value]);
        }

        // Add all non-realm and non oauth_signature parameters from the auth header to our oauth_params object
        // for easy lookup.
        req.oauth_params[param_name] = param_value;
      }
    }

    // Add query params
    proxy.logger.trace(module_tag, "Collecting OAuth params: req.query", util.inspect(req.query));
    oauth1a_signature_utils.collectParams(req, req.query);

    // Add POST body params.  This will noop if the request is not a POST or is not form-urlencoded.
    // If the parameter is an oauth param, track it for easy lookup.  Note that it's seriously non-standard
    // to send oauth parameters in the POST body, but DotNetOpenAuth does it in some circumstances.
    proxy.logger.trace(module_tag, "Collecting OAuth params: req.body", util.inspect(req.body));
    oauth1a_signature_utils.collectParams(req, req.body);

    next();
  }
};
