var _ = require('underscore');
var crypto = require('crypto');
var encoding = require('../../lib/encoding.js');
var fs = require('fs');
var logger = require('../../lib/logger.js').getLogger();
var querystring = require('querystring');
var request = require('request');
var should = require('should');
var url_utils = require('url');
var util = require('util');
var validation_tools = require('./validation_tools.js');
var zlib = require('zlib');

var module_tag = {
  module: require('../../lib/logger.js').getModulePath(__filename)
};

// This saves us from having to special case calls to delete since it's the only verb where the
// name doesn't match the method name.  For the others, we're just being lazy and saying we don't
// want to remember whether our verbs are upper or lower case when we try to grab the appropriate
// function to call from the request object.
request.delete = request.DELETE = request.del;
request.GET = request.get;
request.POST = request.post;
request.PUT = request.put;

exports.keys = {};

// Set and export constants for configuring the way auth credentials are delivered in our test
// cases.  OAuth credentials can be delivered by Authorization header or Query-String, and, less
// standardly, in the body of a POST.  We want to test all 3 while defaulting to Auth header.
var CREDENTIAL_TRANSPORT_HEADER = exports.CREDENTIAL_TRANSPORT_HEADER = "header";
var CREDENTIAL_TRANSPORT_QUERY = exports.CREDENTIAL_TRANSPORT_QUERY = "query";
var CREDENTIAL_TRANSPORT_BODY = exports.CREDENTIAL_TRANSPORT_BODY = "post";

var credential_transport = CREDENTIAL_TRANSPORT_HEADER;

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
};

// OAuth header params have the form oauth_version: '1.0'
var oauth_header_renderer = function(key, value) {
  return key + '="' + encoding.encodeData(value) + '"';
};

// Params for signing have the form oauth_version=1.0
var param_renderer = function(key, value) {
  return key + '=' + value;
};

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

// Construct a signature, add it to the OAuth header group, and create a rendered version of
// these headers using the provided renderFn.  If none is provided, render these as
// Authorization headers.
var prepare_auth_credentials = function(renderFn) {

  // The default renderer will render the oauth credentials for an Authorization header.
  renderFn = renderFn || function() { return 'OAuth ' + renderParams(oauth_headers, ', ', oauth_header_renderer); };

  // The url should not be encoded before prepare_auth_header is called.  This just cuts down on
  // the number of times we need to spread encoding.encodeData throughout the tests.
  signature_components[1] = encoding.encodeData(signature_components[1]);
  signature_components[2] = encoding.encodeData(renderParams(params, '&', param_renderer));
  var signature_base = signature_components.join('&');
  logger.debug(module_tag, "Signature base: %s", signature_base);

  // Pull the secret corresponding to the key used in this request.  Most commonly, this will be mocha-test-key's
  // secret, but we have the option of using other keys for other tests (to validate that things like quotas work).
  var secret = exports.keys[params[0][1]] || 'bogus-secret';
  oauth_headers.push(['oauth_signature', signString(secret, signature_base)]);
  return renderFn();
};

// Fill in the options array with the credentials populated in whatever mechanism is appropriate,
// header, query string, or POST body.
function populateTransport(options) {
  if (credential_transport === CREDENTIAL_TRANSPORT_HEADER) {
    var existing_headers = options.headers || {};
    // Create auth headers and merge them with any headers provided in options.  We do it in this order
    // because we have some tests that set Authorization to something non-OAuth.  We want those tests
    // to fail, so we need their bogus authentication headers to overwrite the OAuth header.
    var headers = _.extend({'Authorization': prepare_auth_credentials()}, existing_headers);
    _.extend(options, { headers: headers });
  } else if (credential_transport === CREDENTIAL_TRANSPORT_QUERY) {
    var qs = prepare_auth_credentials(function() {
      return querystring.stringify(_.object(oauth_headers));
    });

    qs = (options.query) ? '&' + qs : '?' + qs;
    options.uri = options.uri + qs;
  } else if (credential_transport === CREDENTIAL_TRANSPORT_BODY) {
    var form = prepare_auth_credentials(function() {
      return _.object(oauth_headers);
    });

    // If there are existing form params, merge them.  Otherwise, the form params we generated from
    // our auth credentials are all we'll send with this PUT or POST.
    options.form = options.form ? _.extend(options.form, form) : form;
  }

  return options;
}

// Allow clients to set the credential transport, but only to one of our three allowed options.
exports.setCredentialTransport = function(transport) {
  if (transport !== CREDENTIAL_TRANSPORT_HEADER && transport !== CREDENTIAL_TRANSPORT_QUERY && transport !== CREDENTIAL_TRANSPORT_BODY) {
    return should.fail('Invalid auth header transport ' + transport);
  }
  credential_transport = transport;
};

// Convenience function for sending a request and expecting a certain response code.
// TODO: Consider rewriting this function to return a chainable Promise, which would
// parallelize a lot of the unit test operations and also result in better code readability.
exports.sendRequest = function(verb, url, options, expected_status_code, done) {
  if (!url) url = VERB_DEFAULT_ROUTES[verb];
  // Populate an options object by merging the options parameter, if provdied, with the parsed
  // url and the verb of this request.  After these operations, options is a fully qualified
  // request.js parameter.
  options = options || {};
  _.extend(options, url_utils.parse(url));
  _.extend(options, { method: verb, uri: url });

  var validation = validation_tools.createResponseValidator(expected_status_code, done);
  // In the common case where we aren't doing any gzip or deflate, make a simple request() call.
  if (!(options.headers && options.headers['accept-encoding']))
    return request(options, validation);

  // If we need to decompress content, make a more complicated request call, using the request
  // object as a stream.  This could be done with pipes and would probably be a bit more elegant,
  // but I think this style is a bit easier to read.
  var req = request(options);
  req.on('response', function(res) {
    var chunks = [];
    res.on('data', function(chunk) {
      chunks.push(chunk);
    });

    // Once we have the full response, decide whether it needs to be gunzipped or inflated.
    res.on('end', function() {
      var buffer = Buffer.concat(chunks);
      var encoding = res.headers['content-encoding'];
      if (encoding == 'gzip') {
        zlib.gunzip(buffer, function(encoding_err, decoded) {
          if (!decoded) return done(encoding_err);
          validation(null, res, decoded.toString());
        });
      } else if (encoding == 'deflate') {
        zlib.inflate(buffer, function(encoding_err, decoded) {
          if (!decoded) return done(encoding_err);
          validation(null, res, decoded.toString());
        });
      } else {
        validation(null, res, buffer.toString());
      }
    });
  });

  req.on('error', function(err) {
    validation(err);
  });
};

// Ok, now we're really going nuts with currying and partials.  This creates a prefilled version of
// sendRequest that assumes you are only providing a verb, an expected status code, and a callback.
exports.sendSimpleRequest = _.partial(exports.sendRequest, _, undefined, undefined, _, _);

// Send the request through our outbound proxy to add the auth headers.  Note that in this case url
// is the ultimate destination URL, not the URL of the authenticating proxy.  This method sends to
// the authenticating proxy and wraps the target URL as a convenience.
exports.sendProxyAuthenticatedRequest = function(verb, url, options, expected_status_code, done) {
  if (!url) url = VERB_DEFAULT_ROUTES[verb];

  return exports.sendRequest(verb,
    'http://localhost:8282/?oauth_proxy_consumer_key=mocha-test-key&oauth_proxy_url=' + encodeURIComponent(url),
    options, expected_status_code, done);
};

// Ok, now we're really going nuts with currying and partials.  This creates a prefilled version of
// sendProxyAuthenticatedRequest that assumes you are only providing a verb, an expected status code,
// and a callback.
exports.sendSimpleProxyAuthenticatedRequest = _.partial(exports.sendProxyAuthenticatedRequest, _, undefined, undefined, _, _);

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
  var proto = options.protocol || 'http:';
  signature_components[1] = proto + '//' + options.hostname + ':' + options.port + encoding.decodeData(options.pathname);

  // We don't technically need to reset the options value, but it does make it more clear that
  // we may be modifying options in populateTransport.
  options = populateTransport(options);

  // Rewrite the url parameter if it's been overridden by populateTransport
  url = options.uri ? options.uri : url;
  return exports.sendRequest(verb, url, options, expected_status_code, done);
};

// Ok, now we're really going nuts with currying and partials.  This creates a prefilled version of
// sendAuthenticatedRequest that assumes you are only providing a verb, an expected status code, and a callback.
exports.sendSimpleAuthenticatedRequest = _.partial(exports.sendAuthenticatedRequest, _, undefined, undefined, _, _);

// Called from beforeEach, resets the state of the request sender so that each unit test is clean.
exports.reset = function() {

  // Our default mechanism for delivering credentials is an Auth header.
  exports.setCredentialTransport(CREDENTIAL_TRANSPORT_HEADER);

  var nonce = createNonce();
  // Grab current epoch ms time.
  var timestamp = Date.now();

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

// Create random nonce string
function createNonce() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for( var i=0; i < 10; i++ ) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

// Sign the provided string.  This is used for ad hoc tests run from within the suite.
function signString(key, str) {
  return crypto.createHmac("sha1", key).update(str).digest("base64");
}
