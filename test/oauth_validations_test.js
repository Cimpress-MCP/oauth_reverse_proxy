var should = require('should');

var request_sender = require('./utils/request_sender.js');

// All tests must require bootstrap_test since that creates our proxy, starts our job server,
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./bootstrap_test.js');

// This is a set of tests for missing OAuth components, incorrectly specified OAuth parameters, etc.  These are
// health tests for our OAuth validations: any spurious 200s returned here represent weaknesses in oauth_reverse_proxy's security.
describe('OAuth validations', function() {

  // Run these tests for each verb.  While verb handling inside of oauth_reverse_proxy is consistent and these results should
  // always be the same, that may not always be the case.  This is a hedge against future stupidity.
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {

    // Validate that an invalid signature method results in a 400 error.
    it ("should reject " + verb + " requests with invalid signature methods", function(done) {
      request_sender.oauth_headers[2][1] = 'HMAC-SHA256';
      request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
    });

    // Validate that a missing oauth component results in a 400 error.
    it ("should reject " + verb + " requests without a consumer key", function(done) {
      request_sender.oauth_headers.splice(0, 1);
      request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
    });

    // Validate that a missing oauth component results in a 400 error.
    it ("should reject " + verb + " requests without a nonce", function(done) {
      request_sender.oauth_headers.splice(1, 1);
      request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
    });

    // Validate that a missing oauth component results in a 400 error.
    it ("should reject " + verb + " requests without a signature method", function(done) {
      request_sender.oauth_headers.splice(2, 1);
      request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
    });

    // Validate that a missing oauth component results in a 400 error.
    it ("should reject " + verb + " requests without a timestamp", function(done) {
      request_sender.oauth_headers.splice(3, 1);
      request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
    });

    // Validate that an empty consumer key string results in a 400 error.
    it ("should reject " + verb + " requests with consumer keys that are empty strings", function(done) {
      request_sender.oauth_headers[0][1] = '';
      request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
    });

    // Validate that an empty nonce string results in a 400 error.
    it ("should reject " + verb + " requests with nonces that are empty strings", function(done) {
      request_sender.oauth_headers[1][1] = '';
      request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
    });

    // Validate that an empty signature method string results in a 400 error.
    it ("should reject " + verb + " requests with signature methods that are empty strings", function(done) {
      request_sender.oauth_headers[2][1] = '';
      request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
    });

    // Validate that an empty timestamp string results in a 400 error.
    it ("should reject " + verb + " requests with timestamps that are empty strings", function(done) {
      request_sender.oauth_headers[3][1] = '';
      request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
    });

    // Validate that incorrect Authorization mechanism results in a 400 error.
    it ("should reject " + verb + " requests with non-OAuth Authorization headers", function(done) {
      request_sender.sendAuthenticatedRequest(verb, null, { headers: {'Authorization': 'Basic ABCDEFHG=' } }, 400, done);
    });

    // Validate that an unmatched consumer key results in a 401 error.
    it ("should reject " + verb + " requests with unmatched consumer keys", function(done) {
      request_sender.oauth_headers[0][1] = 'not-mocha-test-key';
      request_sender.sendSimpleAuthenticatedRequest(verb, 401, done);
    });

    // Validate that an invalid (low) timestamp results in a 401 error.
    it ("should reject " + verb + " requests with timestamps that are too low", function(done) {
      request_sender.oauth_headers[3][1] = 1234;
      request_sender.sendSimpleAuthenticatedRequest(verb, 401, done);
    });

    // Validate that an invalid (high) timestamp causes a 401 error.
    it ("should reject " + verb + " request timestamps that are too high", function(done) {
      request_sender.oauth_headers[3][1] = 9999999999999;
      request_sender.sendSimpleAuthenticatedRequest(verb, 401, done);
    });

    // Validate that non-numeric timestamp results in a 401 error.
    it ("should reject " + verb + " requests with timestamps that are not numeric", function(done) {
      request_sender.oauth_headers[3][1] = 'cant_fool_a_fooler';
      request_sender.sendSimpleAuthenticatedRequest(verb, 401, done);
    });

    // Validate that an invalid version causes a 401 error.
    it ("should reject " + verb + " requests with versions that are wrong", function(done) {
      request_sender.oauth_headers[4][1] = '2.0';
      request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
    });

    // Validate that an invalid secret will cause an 401 error.
    it ("should reject " + verb + " secrets that have strings with escape sequences", function(done) {
      request_sender.oauth_headers[0][1] = 'escapechars-test-key';
      request_sender.sendSimpleAuthenticatedRequest(verb, 401, done);
    });

    // Validate that an invalid secret will cause an 401 error.
    it ("should reject " + verb + " secrets that are byte strings", function(done) {
      request_sender.oauth_headers[0][1] = 'bytes-test-key';
      request_sender.sendSimpleAuthenticatedRequest(verb, 401, done);
    });
  });
});

// Tests the validator's handling of specially formatted mock-requests, allowing us to get into the weeds
// of specific use cases that might be difficult to achieve by sending actual requests.
describe('oauth_reverse_proxy request validation', function() {

  // Create a stub proxy to pass into our validator functions.  This needs to expose a logger and a set of keys.
  var stub_proxy = {
    keystore: { keys: {'mock_key':'mock_secret'} },
    logger : require('../lib/logger.js').getLogger({'service_name': 'oauth_reverse_proxy request validation test'})
  };

  // The request validator function used in the connect workflow for node-http-proxy.
  var request_validator = require('../lib/proxy/validators/request_sanity_validator.js')(stub_proxy);

  // The oauth validator function used in the connect workflow for node-http-proxy.
  var oauth_validator = require('../lib/proxy/validators/oauth_signature_validator.js')(stub_proxy);

  // Create a mock response that can be used to validate that the correct failure states are registered.
  var create_res = function(done, expected_code, expected_message) {
    return {
      writeHead: function(code, message) {
        code.should.equal(expected_code);
        message.should.equal(expected_message);
      },
      end: function() {
        done();
      }
    };
  };

  it ('should reject a null request even though that should never ever happen', function(done) {
    var res = create_res(done, 400, 'Invalid request');
    // Attempt to validate an empty request.
    request_validator(null, res, null);
  });

  it ('should reject a request with no headers even though that should never ever happen', function(done) {
    var res = create_res(done, 400, 'Invalid request');

    var req = {};
    // Attempt to validate a hopelessly flawed request.
    request_validator(req, res, null);
  });

  it ('should reject a request with no method even though that should never ever happen', function(done) {
    var res = create_res(done, 400, 'Invalid request');

    var req = {};
    req.headers = {'host':'localhost'};

    // Attempt to validate a hopelessly flawed request.
    request_validator(req, res, null);
  });

  it ('should reject a request with no url even though that should never ever happen', function(done) {
    var res = create_res(done, 400, 'Invalid request');

    var req = {};
    req.headers = {'host':'localhost'};
    req.method = 'GET';

    // Attempt to validate a hopelessly flawed request.
    request_validator(req, res, null);
  });

  // We can finally populate our stub request with everything necessary to pass the test for a /livecheck route.
  // But we pass in a null next function knowing this will cause the validator to throw an exception.
  it ('should handle an uncaught exception in the validator method even though that should never ever happen', function(done) {
    var res = create_res(done, 500, 'Internal error');

    var req = {};
    req.whitelist_passed = true;
    req.headers = {'host':'localhost'};
    req.method = 'GET';
    req.url = '/livecheck';

    oauth_validator(req, res, null);
  });
});

