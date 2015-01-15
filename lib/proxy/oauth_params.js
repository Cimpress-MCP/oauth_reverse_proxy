
var badrequest = require('./messages.js').badrequest;
var unauthorized = require('./messages.js').unauthorized;

var encoding = require('../encoding.js');

var OAUTH_CONSUMER_KEY = exports.OAUTH_CONSUMER_KEY = 'oauth_consumer_key';
var OAUTH_NONCE = exports.OAUTH_NONCE = 'oauth_nonce';
var OAUTH_SIGNATURE = exports.OAUTH_SIGNATURE = 'oauth_signature';
var OAUTH_SIGNATURE_METHOD = exports.OAUTH_SIGNATURE_METHOD = 'oauth_signature_method';
var OAUTH_TIMESTAMP = exports.OAUTH_TIMESTAMP = 'oauth_timestamp';
var OAUTH_VERSION = exports.OAUTH_VERSION = 'oauth_version';

/**
 * All of these parameters must be present in a valid oauth header or query string.
 */
var REQUIRED_OAUTH_PARAMS = exports.REQUIRED_OAUTH_PARAMS = [
  OAUTH_CONSUMER_KEY,
  OAUTH_NONCE,
  OAUTH_SIGNATURE,
  OAUTH_SIGNATURE_METHOD,
  OAUTH_TIMESTAMP
];

var REQUIRED_OAUTH_PARAMS_COUNT = exports.REQUIRED_OAUTH_PARAMS_COUNT = REQUIRED_OAUTH_PARAMS.length;

// Only allow requests within 5 minutes.
var MAX_AGE = 5*60*1000;

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
    if (param_name !== OAUTH_SIGNATURE) {
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
exports.collectOAuthParams = function(req, res, next) {
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
      if (param_name !== OAUTH_SIGNATURE) {
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
};

function validateTimestamp(req) {
  // Check date
  var timestamp_str = req.oauth_params[OAUTH_TIMESTAMP];
  // Pad out timestamp string if it's given in seconds, not ms.  Yes, seconds are in the RFC spec, but some
  // clients will provide ms and ms is the format used within JS.
  if (timestamp_str.length < 11) {
    timestamp_str += '500';
  }
  var timestamp = parseInt(timestamp_str);
  if (isNaN(timestamp)) {
    return false;
  }
  // Grab current epoch ms time.
  var now = Date.now();
  // We don't want timestamps that are declared far into the future to be considered valid, so treat the
  // allowable delta as an absolute value.
  var valid = (Math.abs(now - timestamp) < MAX_AGE);
  return valid;
};

exports.oauthParamValidator = function(proxy) {
  // Run a series of validations on the request.  If any of the validations fail, an error response will be
  // written to the client, and this method will terminate with error.
  return function(req, res, next) {

    // If this request has already passed a whitelist check, short-circuit this set of validations.
    if (req.whitelist_passed) return next();

    // If we receive an auth header, fail if the auth header is not OAuth
    if (req.headers.authorization && req.headers.authorization.indexOf('OAuth') !== 0) {
      return badrequest(proxy.logger, req, res, 'Authorization type is not OAuth');
    }

    // Only HMAC-SHA1 is supported, per the spec.
    if (req.oauth_params[OAUTH_SIGNATURE_METHOD] !== 'HMAC-SHA1') {
      return badrequest(proxy.logger, req, res, 'Only OAuth 1.0a with HMAC-SHA1 is supported');
    }

    // Loop over all require oauth parameters and fail if any are missing.
    for (var i=0; i<REQUIRED_OAUTH_PARAMS_COUNT; ++i) {
      // This test will fail if the parameter is either missing or an empty string
      if (!req.oauth_params[REQUIRED_OAUTH_PARAMS[i]]) {
        return badrequest(proxy.logger, req, res, 'Incomplete OAuth headers');
      }
    }

    // If a version is provided, it must equal '1.0'
    if (req.oauth_params.hasOwnProperty(OAUTH_VERSION) && req.oauth_params[OAUTH_VERSION] !== '1.0') {
      return badrequest(proxy.logger, req, res, 'Incorrect OAuth version');
    }

    // Validate that the signature was generated within the last 5 minutes.
    if (!validateTimestamp(req, res)) {
      return unauthorized(proxy.logger, req, res, 'Request expired');
    }

    // If this consumer key is not present in our keystore, reject the request.
    if (!proxy.keys.hasOwnProperty(req.oauth_params[OAUTH_CONSUMER_KEY])) {
      return unauthorized(proxy.logger, req, res, 'Invalid consumer key');
    }

    // If we got here, all critical validations passed.
    next();
  };
};
