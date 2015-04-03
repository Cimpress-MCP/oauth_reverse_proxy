/**
 * Test that requests sent to a remote target host work properly.
 */

// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

// All tests must require auth_proxy_bootstrap_test since that creates a reverse_proxy, starts our job server,
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./auth_proxy_bootstrap_test.js');

// Tests that verbs are handled correctly by oauth_reverse_proxy
describe('oauth_reverse_proxy: remote target host', function() {

  // Validate that a GET for a Google query works
  it ("should forward a properly signed basic GET request to Google", function(done) {
    request_sender.sendAuthenticatedRequest('GET', 'http://localhost:6006/', null, 200, done);
  });

});
