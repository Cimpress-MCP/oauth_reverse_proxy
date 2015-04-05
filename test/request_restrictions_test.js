var _ = require('underscore');

// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');

// All tests must require bootstrap_test since that creates our proxy, starts our job server,
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./bootstrap_test.js');

describe('Additional request restrictions', function() {

  // Validate that a request with an un-whitelisted URI receives a 401.
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
    it ('should reject ' + verb + ' on non-whitelisted URIs', function(done) {
      request_sender.sendAuthenticatedRequest(verb, 'http://localhost:8008/funkypath', {}, 401, done);
    });
  });

  // Validate that a request with an un-whitelisted host receives a 401.
  // TODO: Is this test really expressing the codepath we say it is?
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
    it ('should reject ' + verb + ' with non-whitelisted Host: headers', function(done) {
      request_sender.sendAuthenticatedRequest(verb, 'http://localhost:8008/job', {'headers': {'host': 'funkhost.com'}}, 401, done);
    });
  });
});
