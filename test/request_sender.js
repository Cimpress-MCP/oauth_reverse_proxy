var should = require('should');

var _ = require('underscore');
var crypto = require('crypto');
var fs = require('fs');
var request = require('request');
// This saves us from having to special case calls to delete since it's the only verb where the
// name doesn't match the method name.  For the others, we're just being lazy and saying we don't
// want to remember whether our verbs are upper or lower case when we try to grab the appropriate
// function to call from the request object.
request.delete = request.DELETE = request.del;
request.GET = request.get;
request.POST = request.post;
request.PUT = request.put;
var url_utils = require('url');
var util = require('util');

// This is the secret we'll use for signing ad hoc requests for test cases.
exports.mocha_secret;

// Variables used for signing requests with OAuth
var oauth_headers = exports.oauth_headers = [];
var params = exports.params = [];
var signature_components;

// Different verbs have different default URL layouts.  This mapping helps us find the right
// url for a verb without having too many hard-coded URLs scattered throughout the tests.
var VERB_DEFAULT_ROUTES = exports.VERB_DEFAULT_ROUTES = {
  'GET': 'http://localhost:8008/job/12345',
  'POST': 'http://localhost:8008/job',
  'PUT': 'http://localhost:8008/job',
  'DELETE': 'http://localhost:8008/job/12345'
}

// OAuth header params have the form oauth_version: '1.0'
var oauth_header_renderer = function(key, value) {
  return key + '="' + encodeData(value) + '"';
};

// Params for signing have the form oauth_version=1.0
var param_renderer = function(key, value) {
  return key + '=' + value;
};

// Construct a signature, add it to the OAuth header group, and return the OAuth header string  
var prepare_auth_header = function() {
  // The url should not be encoded before prepare_auth_header is called.  This just cuts down on
  // the number of times we need to spread encodeData throughout the tests.
  signature_components[1] = encodeData(signature_components[1]);
  signature_components[2] = encodeData(renderParams(params, '&', param_renderer));
  var signature_base = signature_components.join('&');
  //console.log("signature_base:\n%s", signature_base);
  oauth_headers.push(['oauth_signature', signString(exports.mocha_secret, signature_base)]);
  return 'OAuth ' + renderParams(oauth_headers, ', ', oauth_header_renderer);
};

// Convenience function for sending a request and expecting a certain response code.
exports.sendRequest = function(verb, url, options, expected_status_code, done) {
  if (!url) url = VERB_DEFAULT_ROUTES[verb];
  // Populate an options object by merging the options parameter, if provdied, with the parsed
  // url and the verb of this request.  After these operations, options is a fully qualified
  // request.js parameter.
  options = options || {};
  _.extend(options, url_utils.parse(url));
  _.extend(options, { method: verb, uri: url });
  return request(options, create_response_validator(expected_status_code, done));
};

// Ok, now we're really going nuts with currying and partials.  This creates a prefilled version of
// sendRequest that assumes you are only providing a verb, an expected status code, and a callback.
exports.sendSimpleRequest = _.partial(exports.sendRequest, _, undefined, undefined, _, _);

// Convenience function for sending an authenticated request and expecting a certain response code.
exports.sendAuthenticatedRequest = function(verb, url, options, expected_status_code, done) {
  if (!url) url = VERB_DEFAULT_ROUTES[verb];
  // Populate an options object by merging the options parameter, if provdied, with the parsed
  // url and the verb of this request.  After these operations, options is a fully qualified
  // request.js parameter.
  options = options || {};
  _.extend(options, url_utils.parse(url));
  _.extend(options, { method: verb, uri: url });
  
  signature_components[0] = options.method;
  signature_components[1] = 'http://' + options.hostname + ':' + options.port + options.pathname;
  
  var existing_headers = options.headers || {};
  // Create auth headers and merge them with any headers provided in options.  We do it in this order
  // because we have some tests that set Authorization to something non-OAuth.  We want those tests
  // to fail, so we need their bogus authentication headers to overwrite the OAuth header.
  var headers = _.extend({'Authorization': prepare_auth_header()}, existing_headers);
  _.extend(options, { headers: headers });
  
  return exports.sendRequest(verb, url, options, expected_status_code, done);
};

// Ok, now we're really going nuts with currying and partials.  This creates a prefilled version of
// sendRequest that assumes you are only providing a verb, an expected status code, and a callback.
exports.sendSimpleAuthenticatedRequest = _.partial(exports.sendAuthenticatedRequest, _, undefined, undefined, _, _);

// Called from beforeEach, resets the state of the request sender so that each unit test is clean.
exports.reset = function() {
  var nonce = createNonce();
  var timestamp = new Date().getTime();
  
  // Reset the signature components we use to working defaults.
  signature_components = [
    'GET',
    undefined,
    'param_placeholder'
  ];
  
  // Empty the oauth_headers and params arrays
  oauth_headers.length = 0;
  params.length = 0;
  
  // Fill a valid set of oauth headers that we can monkey with as needed for our test cases.  Loop over
  // each of these defaults and add them to our oauth_headers and params arrays.
  [
    [ 'oauth_consumer_key', 'mocha-test-key' ],
    [ 'oauth_nonce', nonce ],
    [ 'oauth_signature_method', 'HMAC-SHA1'],
    [ 'oauth_timestamp', timestamp],
    [ 'oauth_version', '1.0' ]
  ].forEach(function(header) {
    oauth_headers.push(header);
    
    // Since there may be params that aren't headers, we populate the params array separately.
    params.push(header);
  });
};

// Creates a convenience function for validating that an http response has the correct status code
// and did not result in a protocol-level error (connection failure, etc).
var create_response_validator = function(expected_status_code, done) {
  return function(err, response, body) {
    if (err) return done(err);
    response.statusCode.should.equal(expected_status_code);
    // Validate that all responses have a connection header of keep-alive.  For performance reasons,
    // Auspice should never be disabling keep-alives.
    response.headers.connection.should.equal('keep-alive');
    // We know that all requests to the JobServer should return {"status":"ok"}, so add that validation.
    if (expected_status_code === 200 && response.request.path.indexOf('/job') != -1) body.should.equal('{"status":"ok"}');
    
    // Otherwise, if we made it here, the test is complete.
    done(null, response, body);
  };
};

// Create random nonce string
function createNonce() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for( var i=0; i < 10; i++ ) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

// Encode signable strings
function encodeData(toEncode) {
  if( toEncode == null || toEncode === "" ) return "";
  else {
    var result= encodeURIComponent(toEncode);
    // Fix the mismatch between RFC3986's and Javascript's beliefs in what is right and wrong.
    return result.replace(/\!/g, "%21").replace(/\'/g, "%27").replace(/\(/g, "%28")
                 .replace(/\)/g, "%29").replace(/\*/g, "%2A");
  }
}

// Sign the provided string.  This is used for ad hoc tests run from within the suite.
function signString(key, str) {
  return crypto.createHmac("sha1", key).update(str).digest("base64");
}

// Given an array of parameters of type [ [key, value], [key2, value2] ], return a rendered string separated
// by character sep and where the key and value are transformed by renderFn before being joined.
function renderParams(params, sep, renderFn) {
  var out_params = [];
  // Flatten the nested array into a single array of type [ key, value, key2, value2 ]
  params = _.flatten(params);

  // Fail an assertion if the output array is odd in length.
  (params.length & 1).should.equal(0);
  for (var i=0; i<params.length; i+=2) {
    out_params[i/2] = renderFn(params[i], params[i+1]);
  }
  return out_params.join(sep);
}
