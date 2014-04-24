var util = require('util');

var url_utils = require('url');

var sprintf = require('../utils/sprintf.js').sprintf;
var logger = require('../utils/logger.js').getLogger('authenticator');

var crypto = require('crypto');

// Only allow requests within 5 minutes;
var MAX_AGE = 5*60*1000;

function parseAuthHeader(req, cb) {
  var oauth_params = {};
  if (req.headers.authorization) {
    var auth_header = req.headers.authorization;
    if (auth_header.indexOf('OAuth') !== 0) return cb('Authorization type is not OAuth');
  
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
  var url_parts = url_utils.parse(req.url, true);
  for (var query_param in url_parts.query) {
    if (query_param === 'realm') continue;
    oauth_params[query_param] = encodeData(url_parts.query[query_param]);
  }
  
  return oauth_params;
}

function encodeData(toEncode) {
  if( toEncode == null || toEncode == "" ) return "";
  else {
    var result= encodeURIComponent(toEncode);
    // Fix the mismatch between OAuth's  RFC3986's and Javascript's beliefs in what is right and wrong ;)
    return result.replace(/\!/g, "%21").replace(/\'/g, "%27").replace(/\(/g, "%28")
                 .replace(/\)/g, "%29").replace(/\*/g, "%2A");
  }
}

// Takes an object literal that represents the arguments, and returns an array
// of argument/value pairs.
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

// Sorts the encoded key value pairs by encoded name, then encoded value
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
  
  logger.debug("The parameter string is\n%s", args);
  
  return args;
}

function createSignatureBase(method, url, parameters) {
  url = encodeData(url);
  parameters = encodeData(normaliseRequestParams(parameters));
  return method.toUpperCase() + "&" + url + "&" + parameters;
}

function constructStringToSign(req, parameters, oauth_secret) {
  var method = req.method;
  
  var url_parts = url_utils.parse(req.url, false);
  logger.debug("input url: %s", req.url);
  logger.debug("input headers: %s", util.inspect(req.headers));
  logger.debug("url_parts:\n%s", util.inspect(url_parts));
  
  // TODO: Figure out how to determine if this should be http or https
  var url = sprintf("http://%s%s", req.headers.host, url_parts.pathname);
  
  // TODO: Add post params if applicable
  
  return createSignatureBase(method, url, parameters);
};

exports.authenticateRequest = function(req, keys, cb) {
  if (!req || !req.headers) return cb('Invalid request');
  
  var oauth_params = parseAuthHeader(req, cb);
  
  logger.info("Parsed auth header into:\n%s", util.inspect(oauth_params));
  
  if (oauth_params['oauth_signature_method'] !== 'HMAC-SHA1')
    return cb('Only OAuth 1.0a with HMAC-SHA1 is supported');

  if (!oauth_params.hasOwnProperty('oauth_nonce') || !oauth_params.hasOwnProperty('oauth_timestamp') ||
     !oauth_params.hasOwnProperty('oauth_signature') || !oauth_params.hasOwnProperty('oauth_consumer_key'))
     return cb('Incomplete OAuth headers'); 
  
  // Check date
  var timestamp_str = oauth_params['oauth_timestamp'];
  // Pad out timestamp string if it's given in seconds, not ms.
  if (timestamp_str.length < 11) timestamp_str += '000';
  var timestamp = parseInt(timestamp_str);
  if (isNaN(timestamp)) return cb('Invalid oauth_timestamp');
  var now = new Date().getTime();
  if ((now - timestamp) > MAX_AGE) return cb('Request expired, ' + (now - timestamp) + 'ms old');
  
  if (!keys.hasOwnProperty(oauth_params['oauth_consumer_key']))
    return cb('Invalid consumer key');
  
  // Append & to consumer secret since we'll always have an empty string as the token secret
  var consumer_secret = keys[oauth_params['oauth_consumer_key']] + '&';

  var signature_base = constructStringToSign(req, oauth_params, consumer_secret);
  
  logger.debug("Got signature_base\n%s", signature_base);
  
  var hash = encodeData(crypto.createHmac("sha1", consumer_secret).update(signature_base).digest("base64"));
  
  logger.info("Hash\t%s", hash);
  logger.info("Sig\t%s", oauth_params['oauth_signature']);
  
  if (hash === oauth_params['oauth_signature']) return cb();
  
  cb("Authentication failed");
};
