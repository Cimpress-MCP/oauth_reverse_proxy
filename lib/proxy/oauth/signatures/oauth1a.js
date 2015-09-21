var sprintf = require('../../../sprintf.js').sprintf;
var encoding = require('../../../encoding.js');

var oauth_constants = require('../constants.js');

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

  // First encode them http://tools.ietf.org/html/rfc5849#section-3.4.1.3.2 .1
  for (var i=0; i<argument_pairs.length; i++) {
    argument_pairs[i][0] = encoding.encodeData(encoding.decodeData(argument_pairs[i][0]));
    argument_pairs[i][1] = encoding.encodeData(encoding.decodeData(argument_pairs[i][1]));
  }

  // Then sort them http://tools.ietf.org/html/rfc5849#section-3.4.1.3.2 .2
  argument_pairs = sortRequestParams(argument_pairs);

  // Then concatenate together http://tools.ietf.org/html/rfc5849#section-3.4.1.3.2 .3 & .4
  var args= "";
  for (var i=0; i<argument_pairs.length; i++) {
    // wrb: If this array element is identical to the one after it, skip it.  This is because most
    // implementations do not duplicate parameters in the case of an exact match.  However, this doesn't
    // match up with anything in the RFC, so I'm going to leave it commented out for now.
    /**
    if (i < argument_pairs.length-1 &&
      argument_pairs[i][0] === argument_pairs[i+1][0] && argument_pairs[i][1] === argument_pairs[i+1][1]) {
      continue;
    }
    **/
    args += sprintf("%s%%3D%s", argument_pairs[i][0], argument_pairs[i][1]);
    if (i < argument_pairs.length-1) {
      args+= "%26";
    }
  }

  return args;
}

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
 * Loop over the collection and add entries to the provided collection.
 */
exports.collectParams = function(req, collection) {

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
};

// Create signable base strings starting with https and http, if necessary.  Ideally, we only want to create the
// https signature, but we take the pessimistic approach that upstream proxies can not be trusted to set the headers
// we need.  We will return an http-based string unless we see an x-forwarded-proto header that starts with https.
exports.constructStringsToSign = function(req) {
  var parameters = normaliseRequestParams(req.argument_pairs);
  var method = req.method.toUpperCase();

  if (req.parsed_url.protocol) {
  	return [
 	   sprintf("%s&%s&%s", method, encoding.encodeData(sprintf("%s//%s%s", req.parsed_url.protocol, req.headers.host, encoding.decodeData(req.parsed_url.pathname))), parameters)
  	];
  }

  // Optimistically assume we will only need to sign an https string.
  var signable_strings =  [
    sprintf("%s&%s&%s", method, encoding.encodeData(sprintf("https://%s%s", req.headers.host, encoding.decodeData(req.parsed_url.pathname))), parameters)
  ];

  // If x-forwarded-proto is present and starts with https, we know that the original request was for an https url and
  // can return the signable_strings array with a single entry.
  if (req.headers['x-forwarded-proto'] && (req.headers['x-forwarded-proto'].toLowerCase().indexOf('https') === 0)) {
    return signable_strings;
  }

  // If we don't know whether the inbound request was https or http, return both.
  signable_strings.push(sprintf("%s&%s&%s", method, encoding.encodeData(sprintf("http://%s%s", req.headers.host, encoding.decodeData(req.parsed_url.pathname))), parameters));

  return signable_strings;
};
