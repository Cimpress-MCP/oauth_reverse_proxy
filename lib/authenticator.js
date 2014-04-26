var util = require('util');

var sprintf = require('../utils/sprintf.js').sprintf;
var logger = require('../utils/logger.js').getLogger('authenticator');

var crypto = require('crypto');

// Only allow requests within 5 minutes.
var MAX_AGE = 5*60*1000;

var OAUTH_CONSUMER_KEY = 'oauth_consumer_key';
var OAUTH_NONCE = 'oauth_nonce';
var OAUTH_SIGNATURE = 'oauth_signature';
var OAUTH_SIGNATURE_METHOD = 'oauth_signature_method';
var OAUTH_TIMESTAMP = 'oauth_timestamp';

/**
 * All of these parameters must be present in a valid oauth header or query string. 
 */
var REQUIRED_OAUTH_PARAMS = [
  OAUTH_CONSUMER_KEY,
  OAUTH_NONCE,
  OAUTH_SIGNATURE,
  OAUTH_SIGNATURE_METHOD,
  OAUTH_TIMESTAMP
]

/**
 * Utility method for returning an authentication failure message.
 */
function unauthorized(req, res, message) {
  logger.info("Rejecting %s %s%s, error %s", req.method, req.headers.host, req.url, message);
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', 'OAuth error ' + message);
  res.end(message);
};

/**
 * Query strings and post contents might be parsed by connect as arrays if there are name
 * collisions.  Unpack these into individual entries in the argument_pairs array.
 */
function safelyAddValues(argument_pairs, name, value) {
  value = value || "";
  if (Array.isArray(value)) {
    for (var i=0; i<value.length; ++i) {
      safelyAddValues(argument_pairs, name, value[i]);
    }
  } else {
    argument_pairs.push([name, encodeData(value)]);
  }
}

/**
 * Go through the auth headers, the query params, and the post body (if applicable) to build the
 * set of values that form the signature. 
 */
function gatherSignableParams(req, res, oauth_params) {
  var argument_pairs = [];
  if (req.headers.authorization) {
    // If the OAuth creds are provided as an auth header, enumerate them here and add them to the
    // list of things we need to sign.
    var auth_header = req.headers.authorization;
    if (auth_header.indexOf('OAuth') !== 0) return unauthorized(req, res, 'Authorization type is not OAuth');
  
    auth_header = auth_header.substring(6);
  
    var auth_header_parts = auth_header.split(/[=,\,,"]/);
  
    for (var i=0; i < auth_header_parts.length; i+=4) {
      var param_name = auth_header_parts[i].trim();
      if (param_name === 'realm') continue;
      var param_value = auth_header_parts[i+2].trim();
      // For any auth header param other than the oauth signature, add it to the argument pairs array.  This array
      // is used for signing, and we don't want to re-sign the signature.
      if (param_name !== OAUTH_SIGNATURE) 
        argument_pairs.push([param_name, param_value]);
      
      // Add all non-realm and non oauth_signature parameters from the auth header to our oauth_params object
      // for easy lookup.
      oauth_params[param_name] = param_value;
    }
  }
  
  // Add query params
  for (var query_param_name in req.query) {
    // Ignore realm.  It is not used in signing.
    if (query_param_name === 'realm') continue;
    // For any parameter other than the oauth signature, add it to the argument pairs array.  This array
    // is used for signing, and we don't want to re-sign the signature.
    if (query_param_name !== OAUTH_SIGNATURE) 
      safelyAddValues(argument_pairs, query_param_name, req.query[query_param_name]);
    // If the parameter is an oauth param, track it in the oauth_params object for easy lookup.
    if (query_param_name.indexOf('oauth_') === 0) 
      oauth_params[query_param_name] = encodeData(req.query[query_param_name]);
  }
  
  // Add body params
  // logger.trace("req is:\n%s", util.inspect(req));
  for (var body_param in req.body) {
    safelyAddValues(argument_pairs, body_param, req.body[body_param] || "");
  }
  
  logger.trace("argument pairs:\n%s", util.inspect(argument_pairs));
  return argument_pairs;
}

function encodeData(toEncode) {
  if( toEncode == null || toEncode == "" ) return "";
  else {
    var result= encodeURIComponent(toEncode);
    // Fix the mismatch between RFC3986's and Javascript's beliefs in what is right and wrong.
    return result.replace(/\!/g, "%21").replace(/\'/g, "%27").replace(/\(/g, "%28")
                 .replace(/\)/g, "%29").replace(/\*/g, "%2A");
  }
}

/**
 * Sorts the encoded key value pairs by encoded name, then encoded value
 */
function sortRequestParams(argument_pairs) {
  // Sort by name, then value.
  return argument_pairs.sort(function(a,b) {
      if ( a[0]== b[0] )  {
        return a[1] < b[1] ? -1 : 1;
      }
      else return a[0] < b[0] ? -1 : 1;
  });
}

function normaliseRequestParams(argument_pairs) {
  
  // First encode them http://tools.ietf.org/html/rfc5849#section-3.4.1.3.2 .1
  for(var i=0;i<argument_pairs.length;i++) {
    argument_pairs[i][0] = encodeData(argument_pairs[i][0]);
    argument_pairs[i][1] = encodeData(argument_pairs[i][1]);
  }

  // Then sort them http://tools.ietf.org/html/rfc5849#section-3.4.1.3.2 .2
  argument_pairs = sortRequestParams(argument_pairs);

  // Then concatenate together http://tools.ietf.org/html/rfc5849#section-3.4.1.3.2 .3 & .4
  var args= "";
  for(var i=0;i<argument_pairs.length;i++) {
      args += sprintf("%s=%s", argument_pairs[i][0], argument_pairs[i][1]);
      if (i < argument_pairs.length-1) args+= "&";
  }
  
  logger.trace("The parameter string is\n%s", args);
  
  return args;
}

function constructStringsToSign(req, argument_pairs, oauth_secret) {
  
  // logger.trace("url_parts:\n%s", util.inspect(req.parsed_url));
  
  var parameters = encodeData(normaliseRequestParams(argument_pairs));
  var method = req.method.toUpperCase();
  
  // It would be really nice if there was a better way to do this, but we have no way of knowing if
  // the initial URL was https or http so we encode both.
  return [
    sprintf("%s&%s&%s", method, encodeData(sprintf("https://%s%s", req.headers.host, req.parsed_url.pathname)), parameters),
    sprintf("%s&%s&%s", method, encodeData(sprintf("http://%s%s", req.headers.host, req.parsed_url.pathname)), parameters)
  ]
};

function validateTimestamp(oauth_params, req, res) {
  // Check date
  var timestamp_str = oauth_params[OAUTH_TIMESTAMP];
  // Pad out timestamp string if it's given in seconds, not ms.  Yes, seconds are in the RFC spec, but some
  // clients will provide ms and ms is the format used within JS.
  if (timestamp_str.length < 11) timestamp_str += '000';
  var timestamp = parseInt(timestamp_str);
  if (isNaN(timestamp)) return unauthorized(req, res, 'Invalid oauth_timestamp');
  // Grab current epoch ms time.
  var now = new Date().getTime();
  if ((now - timestamp) > MAX_AGE) return unauthorized(req, res, 'Request expired, ' + (now - timestamp) + 'ms old');
};

/**
 * Create an oauth validator using the provided keys.
 */
exports.oauthValidator = function(keys) {
  return function(req, res, next) {
    try {
      if (!req || !req.headers) return unauthorized(req, res, 'Invalid request');
      
      if ((req.parsed_pathname.indexOf('/livecheck') === 0) || (req.parsed_pathname.indexOf('/healthcheck') === 0)) {
        logger.info("Proxying URL %s %s%s LIVECHECK", req.method, req.headers.host, req.url);
        return next();
      }
  
      var oauth_params = {};
      var argument_pairs = gatherSignableParams(req, res, oauth_params);
  
      logger.trace("Parsed auth header into:\n%s", util.inspect(oauth_params));
  
      if (oauth_params[OAUTH_SIGNATURE_METHOD] !== 'HMAC-SHA1')
        return unauthorized(req, res, 'Only OAuth 1.0a with HMAC-SHA1 is supported');
        
      for (var i=0; i<REQUIRED_OAUTH_PARAMS.lenght; ++i) {
        if (!oauth_params.hasOwnProperty(REQUIRED_OAUTH_PARAMS[i]))
         return unauthorized(req, res, 'Incomplete OAuth headers'); 
      }
      
      // Validate that the signature was generated within the last 5 minutes.
      validateTimestamp(oauth_params, req, res);
  
      if (!keys.hasOwnProperty(oauth_params[OAUTH_CONSUMER_KEY]))
        return unauthorized(req, res, 'Invalid consumer key');
  
      // Append & to consumer secret since we'll always have an empty string as the token secret
      var consumer_secret = keys[oauth_params[OAUTH_CONSUMER_KEY]] + '&';

      // Retrieve two signature bases, the first assuming the scheme is https, and the second assuming http.
      // Process them in this order under the assumption that most services should be going over https.
      var signature_bases = constructStringsToSign(req, argument_pairs, consumer_secret);
      
      while (signature_bases.length > 0) {

        var signature_base = signature_bases.shift();
        logger.trace("Got signature_base\n%s", signature_base);
  
        var hash = encodeData(crypto.createHmac("sha1", consumer_secret).update(signature_base).digest("base64"));
  
        logger.trace("Hash\t%s", hash);
        logger.trace("Sig\t%s", oauth_params[OAUTH_SIGNATURE]);
  
        if (oauth_params[OAUTH_SIGNATURE] === hash) {
          // Update the headers of the message to include the user key before proxying.
          var user = oauth_params[OAUTH_CONSUMER_KEY];
          req.headers["VP_USER_KEY"] = user;
          logger.info("Proxying %s %s%s, user %s", req.method, req.headers.host, req.url, user);
          return next();
        } 
      }
  
      return unauthorized(req, res, "Authentication failed");
    } catch (e) {
      logger.error("Failed to handle request %s %s%s due to %s", req.method, req.headers.host, req.url, e);
      res.writeHead(500);
      return res.end();
    }
  };
};

exports.urlParser = function() {
  return function(req, res, next) {
    req.parsed_url = require('url').parse(req.url, false);
    // The parsed pathname is used to check whether this is a /livecheck or /healthcheck URI
    req.parsed_pathname = req.parsed_url.pathname.toLowerCase();
    next();
  };
};
