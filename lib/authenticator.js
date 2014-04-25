var util = require('util');

var sprintf = require('../utils/sprintf.js').sprintf;
var logger = require('../utils/logger.js').getLogger('authenticator');

var crypto = require('crypto');

// Only allow requests within 5 minutes;
var MAX_AGE = 5*60*1000;

function unauthorized(req, res, message) {
  logger.info("Rejecting %s %s%s, error %s", req.method, req.headers.host, req.url, message);
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', 'OAuth error ' + message);
  res.end(message);
};

function gatherSignableParams(req, res) {
  var oauth_params = {};
  if (req.headers.authorization) {
    var auth_header = req.headers.authorization;
    if (auth_header.indexOf('OAuth') !== 0) return unauthorized(req, res, 'Authorization type is not OAuth');
  
    auth_header = auth_header.substring(6);
  
    var auth_header_parts = auth_header.split(/[=,\,,"]/);
    logger.info("Got auth header parts:\n%s", util.inspect(auth_header_parts));
  
    for (var i=0; i<auth_header_parts.length; i+=4) {
      var param_name = auth_header_parts[i].trim();
      if (param_name === 'realm') continue;
      oauth_params[param_name] = auth_header_parts[i+2].trim();
    }
  }
  
  // Add query params
  for (var query_param in req.query) {
    if (query_param === 'realm') continue;
    oauth_params[query_param] = encodeData(req.query[query_param]);
  }
  
  return oauth_params;
}

function encodeData(toEncode) {
  if( toEncode == null || toEncode == "" ) return "";
  else {
    var result= encodeURIComponent(toEncode);
    // Fix the mismatch between OAuth's  RFC3986's and Javascript's beliefs in what is right and wrong.
    return result.replace(/\!/g, "%21").replace(/\'/g, "%27").replace(/\(/g, "%28")
                 .replace(/\)/g, "%29").replace(/\*/g, "%2A");
  }
}

/**
 * Takes an object literal that represents the arguments, and returns an array
 * of argument/value pairs.
 */
function makeArrayOfArgumentsHash(arguments_hash) {
  var argument_pairs= [];
  for (var key in arguments_hash) {
    // The signature from the client should not be part of what we sign. 
    if (key === 'oauth_signature') continue;
    var value = arguments_hash[key];
    if( Array.isArray(value) ) {
      for(var i=0; i < value.length; i++) {
        argument_pairs[argument_pairs.length] = [key, value[i]];
      }
    } else {
      argument_pairs[argument_pairs.length] = [key, value];
    }
  }
  return argument_pairs;
}

/**
 * Sorts the encoded key value pairs by encoded name, then encoded value
 */
function sortRequestParams(argument_pairs) {
  // Sort by name, then value.
  argument_pairs.sort(function(a,b) {
      if ( a[0]== b[0] )  {
        return a[1] < b[1] ? -1 : 1;
      }
      else return a[0] < b[0] ? -1 : 1;
  });

  return argument_pairs;
}

function normaliseRequestParams(arguments) {
  var argument_pairs = makeArrayOfArgumentsHash(arguments);
  
  // First encode them #3.4.1.3.2 .1
  for(var i=0;i<argument_pairs.length;i++) {
    argument_pairs[i][0] = encodeData(argument_pairs[i][0]);
    argument_pairs[i][1] = encodeData(argument_pairs[i][1]);
  }

  // Then sort them #3.4.1.3.2 .2
  argument_pairs = sortRequestParams(argument_pairs);

  // Then concatenate together #3.4.1.3.2 .3 & .4
  var args= "";
  for(var i=0;i<argument_pairs.length;i++) {
      args += sprintf("%s=%s", argument_pairs[i][0], argument_pairs[i][1]);
      if (i < argument_pairs.length-1) args+= "&";
  }
  
  logger.trace("The parameter string is\n%s", args);
  
  return args;
}

function constructStringsToSign(req, parameters, oauth_secret) {
  var method = req.method;
  
  logger.trace("url_parts:\n%s", util.inspect(req.parsed_url));
  
  parameters = encodeData(normaliseRequestParams(parameters));
  
  var method = req.method.toUpperCase();
  
  // It would be really nice if there was a better way to do this, but we have no way of knowing if
  // the initial URL was https or http so we encode both.
  return [
    sprintf("%s&%s&%s", method, encodeData(sprintf("https://%s%s", req.headers.host, req.parsed_url.pathname)), parameters),
    sprintf("%s&%s&%s", method, encodeData(sprintf("http://%s%s", req.headers.host, req.parsed_url.pathname)), parameters)
  ]
};

/**
 * Create an oauth validator using the provided keys.
 */
exports.oauthValidator = function(keys) {
  return function(req, res, next) {
    try {
      if (!req || !req.headers) return unauthorized(req, res, 'Invalid request');
  
      var oauth_params = gatherSignableParams(req, res);
  
      logger.trace("Parsed auth header into:\n%s", util.inspect(oauth_params));
  
      if (oauth_params['oauth_signature_method'] !== 'HMAC-SHA1')
        return unauthorized(req, res, 'Only OAuth 1.0a with HMAC-SHA1 is supported');

      if (!oauth_params.hasOwnProperty('oauth_nonce') || !oauth_params.hasOwnProperty('oauth_timestamp') ||
         !oauth_params.hasOwnProperty('oauth_signature') || !oauth_params.hasOwnProperty('oauth_consumer_key'))
         return unauthorized(req, res, 'Incomplete OAuth headers'); 
  
      // Check date
      var timestamp_str = oauth_params['oauth_timestamp'];
      // Pad out timestamp string if it's given in seconds, not ms.
      if (timestamp_str.length < 11) timestamp_str += '000';
      var timestamp = parseInt(timestamp_str);
      if (isNaN(timestamp)) return unauthorized(req, res, 'Invalid oauth_timestamp');
      var now = new Date().getTime();
      if ((now - timestamp) > MAX_AGE) return unauthorized(req, res, 'Request expired, ' + (now - timestamp) + 'ms old');
  
      if (!keys.hasOwnProperty(oauth_params['oauth_consumer_key']))
        return unauthorized(req, res, 'Invalid consumer key');
  
      // Append & to consumer secret since we'll always have an empty string as the token secret
      var consumer_secret = keys[oauth_params['oauth_consumer_key']] + '&';

      // Retrieve two signature bases, the first assuming the scheme is https, and the second assuming http.
      // Process them in this order under the assumption that most services should be going over https.
      var signature_bases = constructStringsToSign(req, oauth_params, consumer_secret);
      
      while (signature_bases) {

        var signature_base = signature_bases.shift();
        logger.trace("Got signature_base\n%s", signature_base);
  
        var hash = encodeData(crypto.createHmac("sha1", consumer_secret).update(signature_base).digest("base64"));
  
        logger.trace("Hash\t%s", hash);
        logger.trace("Sig\t%s", oauth_params['oauth_signature']);
  
        if (oauth_params['oauth_signature'] === hash) {
          // Update the headers of the message to include the user key before proxying.
          var user = oauth_params['oauth_consumer_key'];
          req.headers["VP_USER_KEY"] = user;
          logger.info("Proxying %s %s%s, user %s", req.method, req.headers.host, req.url, user);
          return next();
        } 
      }
  
      unauthorized("Authentication failed");
    } catch (e) {
      logger.error("Failed to handle request %s %s%s due to %s", req.method, req.headers.host, req.url, e);
      res.writeHead(500);
      return res.end();
    }
  };
};
