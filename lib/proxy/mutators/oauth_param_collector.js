 var encoding = require('../../encoding.js');

 var oauth_constants = require('../oauth/constants.js');

/**
 * This mutator is responsible for scouring an inbound request and gathering OAuth parameters.  These
 * parameters are cached in the request in an efficient format for processing by validators later in
 * the pipeline.
 */

/**
 * Query strings and post contents might be parsed by connect as arrays if there are name
 * collisions.  Unpack these into individual entries in the argument_pairs array.
 */
function safelyAddValues(argument_pairs, name, value) {
  value = value || /* istanbul ignore next */ "";
  if (Array.isArray(value)) {
    for (var i=0; i<value.length; ++i) {
      safelyAddValues(argument_pairs, name, value[i]);
    }
  } else {
    argument_pairs.push([name, encoding.encodeData(value)]);
  }
}

/**
 * Loop over the collection and add entries to oauth_params and/or argument_pairs.
 */
function collectParams(req, collection) {

  for (var param_name in collection) {
    // Ignore realm.  It is not used in signing.
    if (param_name === 'realm') {
      continue;
    }
    // For any parameter other than the oauth signature, add it to the argument pairs array.  This array
    // is used for signing, and we don't want to re-sign the signature.
    if (param_name !== oauth_constants.OAUTH_SIGNATURE) {
      safelyAddValues(req.argument_pairs, param_name, collection[param_name]);
    }
    // If the parameter is an oauth param, track it in the oauth_params object for easy lookup.
    if (param_name.indexOf('oauth_') === 0) {
      req.oauth_params[param_name] = encoding.encodeData(collection[param_name]);
    }
  }
}

/**
 * Go through the auth headers, the query params, and the post body (if applicable) to build the
 * set of values that form the signature.
 */
module.exports = function() {
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
    collectParams(req, req.query);

    // Add POST body params.  This will noop if the request is not a POST or is not form urlencoded.
    // If the parameter is an oauth param, track it in the oauth_params object for easy lookup.  Note that
    // it's seriously non-standard to send oauth parameters in the POST body, but DotNetOpenAuth does it
    // in some circumstances.
    collectParams(req, req.body);

    next();
  }
};
