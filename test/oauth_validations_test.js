var should = require('should');

var request_sender = require('./utils/request_sender.js');

// All tests must require auspice_bootstrap_test since that creates our proxy, starts our job server, and
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./auspice_bootstrap_test.js');

// This is a set of tests for missing OAuth components, incorrectly specified OAuth parameters, etc.  These are
// health tests for our OAuth validations: any spurious 200s returned here represent weaknesses in Auspice's security.
describe('Auspice OAuth validations', function() {
  
  // Run these tests for each verb.  While verb handling inside of Auspice is consistent and these results should
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
  
    // Validate that an invalid version causes a 401 error.
    it ("should reject " + verb + " requests with versions that are wrong", function(done) {
      request_sender.oauth_headers[4][1] = '2.0';
      request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
    });
  });    
});