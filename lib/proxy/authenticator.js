var util = require('util');

var sprintf = require('../sprintf.js').sprintf;
var encoding = require('../encoding.js');

var crypto = require('crypto');

var Whitelist = require('./whitelist.js');

// Only allow requests within 5 minutes.
var MAX_AGE = 5*60*1000;

var OAUTH_CONSUMER_KEY = 'oauth_consumer_key';
var OAUTH_NONCE = 'oauth_nonce';
var OAUTH_SIGNATURE = 'oauth_signature';
var OAUTH_SIGNATURE_METHOD = 'oauth_signature_method';
var OAUTH_TIMESTAMP = 'oauth_timestamp';
var OAUTH_VERSION = 'oauth_version';

var CONSUMER_KEY_HEADER = exports.CONSUMER_KEY_HEADER = 'x-oauth-reverse-proxy-consumer-key';

/**
 * All of these parameters must be present in a valid oauth header or query string.
 */
var REQUIRED_OAUTH_PARAMS = [
  OAUTH_CONSUMER_KEY,
  OAUTH_NONCE,
  OAUTH_SIGNATURE,
  OAUTH_SIGNATURE_METHOD,
  OAUTH_TIMESTAMP
];

var REQUIRED_OAUTH_PARAMS_COUNT = REQUIRED_OAUTH_PARAMS.length;

/**
 * Utility method for returning a bad request failure message.
 */
function badrequest(logger, req, res, message) {
  if (req && req.headers) {
    logger.info("Rejecting %s %s%s, error %s", req.method, req.headers.host, req.url, message);
  } else {
    logger.warn('Rejecting malformed request');
  }

  process.nextTick(function() {
    res.writeHead(400, message);
    res.end();
  });

  // Return false from this method so it can signal to a calling function that the request failed.
  return false;
};

/**
 * Utility method for returning an authentication failure message.
 */
function unauthorized(logger, req, res, message) {
  logger.info("Rejecting %s %s%s, error %s", req.method, req.headers.host, req.url, message);
  process.nextTick(function() {
    res.writeHead(401, message);
    res.end();
  });

  // Return false from this method so it can signal to a calling function that the request failed.
  return false;
};

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
function collectParams(oauth_params, argument_pairs, collection) {

  for (var param_name in collection) {
    // Ignore realm.  It is not used in signing.
    if (param_name === 'realm') {
      continue;
    }
    // For any parameter other than the oauth signature, add it to the argument pairs array.  This array
    // is used for signing, and we don't want to re-sign the signature.
    if (param_name !== OAUTH_SIGNATURE) {
      safelyAddValues(argument_pairs, param_name, collection[param_name]);
    }
    // If the parameter is an oauth param, track it in the oauth_params object for easy lookup.
    if (param_name.indexOf('oauth_') === 0) {
      oauth_params[param_name] = encoding.encodeData(collection[param_name]);
    }
  }
}

/**
 * Go through the auth headers, the query params, and the post body (if applicable) to build the
 * set of values that form the signature.
 */
function gatherSignableParams(req, oauth_params) {
  var argument_pairs = [];
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
        argument_pairs.push([param_name, param_value]);
      }

      // Add all non-realm and non oauth_signature parameters from the auth header to our oauth_params object
      // for easy lookup.
      oauth_params[param_name] = param_value;
    }
  }

  // Add query params
  collectParams(oauth_params, argument_pairs, req.query);

  // Add POST body params.  This will noop if the request is not a POST or is not form urlencoded.
  // If the parameter is an oauth param, track it in the oauth_params object for easy lookup.  Note that
  // it's seriously non-standard to send oauth parameters in the POST body, but DotNetOpenAuth does it
  // in some circumstances.
  collectParams(oauth_params, argument_pairs, req.body);

  return argument_pairs;
}

/**
 * Sorts the encoded key value pairs by encoded name, then encoded value
 */
function sortRequestParams(argument_pairs) {
  // Sort by name, then value.
  return argument_pairs.sort(function(a,b) {
      if ( a[0] === b[0] )  {
        return a[1] < b[1] ? -1 : 1;
      } else {
        return a[0] < b[0] ? -1 : 1;
      }
  });
}

function normaliseRequestParams(argument_pairs) {

  var i;

  // First encode them http://tools.ietf.org/html/rfc5849#section-3.4.1.3.2 .1
  for(i=0;i<argument_pairs.length;i++) {
    argument_pairs[i][0] = encoding.encodeData(argument_pairs[i][0]);
    argument_pairs[i][1] = encoding.encodeData(argument_pairs[i][1]);
  }

  // Then sort them http://tools.ietf.org/html/rfc5849#section-3.4.1.3.2 .2
  argument_pairs = sortRequestParams(argument_pairs);

  // Then concatenate together http://tools.ietf.org/html/rfc5849#section-3.4.1.3.2 .3 & .4
  var args= "";
  for(i=0;i<argument_pairs.length;i++) {
    // wrb: If this array element is identical to the one after it, skip it.  This is because most
    // implementations do not duplicate parameters in the case of an exact match.  However, this doesn't
    // match up with anything in the RFC, so I'm going to leave it commented out for now.
    /**
    if (i < argument_pairs.length-1 &&
      argument_pairs[i][0] === argument_pairs[i+1][0] && argument_pairs[i][1] === argument_pairs[i+1][1]) {
      continue;
    }
    **/
    args += sprintf("%s=%s", argument_pairs[i][0], argument_pairs[i][1]);
    if (i < argument_pairs.length-1) {
      args+= "&";
    }
  }

  return args;
}

// Create signable base strings starting with https and http, if necessary.  Ideally, we only want to create the
// https signature, but we take the pessimistic approach that upstream proxies can not be trusted to set the headers
// we need.  We will return an http-based string unless we see an x-forwarded-proto header that starts with https.
function constructStringsToSign(req, argument_pairs) {
  var parameters = encoding.encodeData(normaliseRequestParams(argument_pairs));
  var method = req.method.toUpperCase();

  // Optimistically assume we will only need to sign an https string.
  var signable_strings =  [
    sprintf("%s&%s&%s", method, encoding.encodeData(sprintf("https://%s%s", req.headers.host, req.parsed_url.pathname)), parameters)
  ];

  // If x-forwarded-proto is present and starts with https, we know that the original request was for an https url and
  // can return the signable_strings array with a single entry.
  if (req.headers['x-forwarded-proto'] && (req.headers['x-forwarded-proto'].toLowerCase().indexOf('https') === 0)) {
    return signable_strings;
  }

  // If we don't know whether the inbound request was https or http, return both.
  signable_strings.push(sprintf("%s&%s&%s", method, encoding.encodeData(sprintf("http://%s%s", req.headers.host, req.parsed_url.pathname)), parameters));

  return signable_strings;
};

function validateTimestamp(oauth_params) {
  // Check date
  var timestamp_str = oauth_params[OAUTH_TIMESTAMP];
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

/**
 * Parse the input url once and cache the parsed value in the request object.
 */
exports.urlParser = function() {
  return function(req, res, next) {
    req.parsed_url = require('url').parse(req.url, false);
    next();
  };
};

/**
 * Create a request sanity validator.  If the request does not pass these tests, it is a failed request and
 * shouldn't make it to any of the other phases of validation.
 */
exports.requestValidator = function(proxy) {
  return function(req, res, next) {
    if (!req || !req.headers || !req.method || !req.url) {
      return badrequest(proxy.logger, req, res, 'Invalid request');
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
      return false;
    }

    /* istanbul ignore else */
    if (proxy.config.required_hosts && !check_collection(proxy.config.required_hosts, req.headers.host, 'Unmatched Host header')) {
      return false;
    }

    next();
  };
};

/**
 * Create a whitelist validator.  If the request passes the whitelist, it is automatically proxied through.
 */
exports.whitelistValidator = function(proxy){

    var whitelist = new Whitelist(proxy.config.whitelist);

    return function(req,res,next) {
        req.whitelist_passed = whitelist.applyWhitelist(req);

        if(req.whitelist_passed) {
            proxy.logger.info("Proxying URL %s %s%s WHITELIST", req.method, req.headers.host, req.url);
        }

        return next();
    };
};

// Run a series of validations on the request.  If any of the validations fail, an error response will be
// written to the client, and this method will terminate with error.
function validateOauthParams(logger, oauth_params, keys, req, res) {

  // If we receive an auth header, fail if the auth header is not OAuth
  if (req.headers.authorization && req.headers.authorization.indexOf('OAuth') !== 0) {
    return badrequest(logger, req, res, 'Authorization type is not OAuth');
  }

  // Only HMAC-SHA1 is supported, per the spec.
  if (oauth_params[OAUTH_SIGNATURE_METHOD] !== 'HMAC-SHA1') {
    return badrequest(logger, req, res, 'Only OAuth 1.0a with HMAC-SHA1 is supported');
  }

  // Loop over all require oauth parameters and fail if any are missing.
  for (var i=0; i<REQUIRED_OAUTH_PARAMS_COUNT; ++i) {
    // This test will fail if the parameter is either missing or an empty string
    if (!oauth_params[REQUIRED_OAUTH_PARAMS[i]]) {
      return badrequest(logger, req, res, 'Incomplete OAuth headers');
    }
  }

  // If a version is provided, it must equal '1.0'
  if (oauth_params.hasOwnProperty(OAUTH_VERSION) && oauth_params[OAUTH_VERSION] !== '1.0') {
    return badrequest(logger, req, res, 'Incorrect OAuth version');
  }

  // Validate that the signature was generated within the last 5 minutes.
  if (!validateTimestamp(oauth_params, req, res)) {
    return unauthorized(logger, req, res, 'Request expired');
  }

  // If this consumer key is not present in our keystore, reject the request.
  if (!keys.hasOwnProperty(oauth_params[OAUTH_CONSUMER_KEY])) {
    return unauthorized(logger, req, res, 'Invalid consumer key');
  }

  // If we got here, all critical validations passed.
  return true;
}

/**
 * Create an oauth validator using the provided keys.
 */
exports.oauthValidator = function(proxy) {

  var keys = proxy.keys;

  return function(req, res, next) {
    try {
      if (req.whitelist_passed === true) {
        return next();
      }

      proxy.logger.trace("req.body:\n%s", util.inspect(req.body));
      proxy.logger.trace("req.headers:\n%s", util.inspect(req.headers));

      var oauth_params = {};
      var argument_pairs = gatherSignableParams(req, oauth_params);

      proxy.logger.trace("Parsed auth header into:\n%s", util.inspect(oauth_params));

      if (!validateOauthParams(proxy.logger, oauth_params, keys, req, res)) {
        // If oauth param validation fails, we can trust that an error response has already been
        // written to the client.
        return;
      }

      // Append & to consumer secret since we'll always have an empty string as the token secret
      var consumer_secret = keys[oauth_params[OAUTH_CONSUMER_KEY]] + '&';

      // Retrieve two signature bases, the first assuming the scheme is https, and the second assuming http.
      // Process them in this order under the assumption that most services should be going over https.
      var signature_bases = constructStringsToSign(req, argument_pairs, consumer_secret);

      // Because python (and possibly) some other libraries do not encode the signature, we can avoid spurious
      // validation failures by comparing decoded signatures against the hash value computed by oauth_reverse_proxy.
      oauth_params[OAUTH_SIGNATURE] = encoding.decodeData(oauth_params[OAUTH_SIGNATURE]);

      while (signature_bases.length > 0) {

        var signature_base = signature_bases.shift();
        proxy.logger.debug("Got signature_base\n%s", signature_base);

        var hash = crypto.createHmac("sha1", consumer_secret).update(signature_base).digest("base64");

        proxy.logger.trace("Hash\t%s", hash);
        proxy.logger.trace("Sig\t%s", oauth_params[OAUTH_SIGNATURE]);

        if (oauth_params[OAUTH_SIGNATURE] === hash) {
          // Update the headers of the message to include the consumer key before proxying.
          var consumer_key = oauth_params[OAUTH_CONSUMER_KEY];
          req.headers[CONSUMER_KEY_HEADER] = consumer_key;
          proxy.logger.info("Proxying %s %s%s, consumer key %s", req.method, req.headers.host, req.url, consumer_key);
          return next();
        }
      }

      // If we got here, neither of the signatures (http or https) matched, so we must return a 401.
      return unauthorized(proxy.logger, req, res, "Signature mismatch");
    } catch (e) {
      /* istanbul ignore else */
      if (proxy && proxy.logger) proxy.logger.error("Failed to handle request %s %s%s due to %s:\n%s", req.method, req.headers.host, req.url, e, e.stack);
      res.writeHead(500, 'Internal error');
      return res.end();
    }
  };
};
