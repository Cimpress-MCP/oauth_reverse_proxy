// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

// All tests must require bootstrap_test since that creates our proxy, starts our job server,
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./bootstrap_test.js');

// Tests that oauth_reverse_proxy can correctly host https routes
describe('oauth_reverse_proxy https', function() {

  // GETs and DELETEs have the same URL format and do not expect input, so test them both in a loop.
  ['GET', 'DELETE'].forEach(function(verb) {

    // Validate that a basic GET or DELETE over IPv6 works.
    it ("should support a properly signed HTTPS " + verb, function(done) {
      request_sender.sendAuthenticatedRequest(verb, 'https://localhost:8443/job/12345', {headers: {connection: 'keep-alive'}, strictSSL: false}, 200, done);
    });

    // Validate that a basic GET or DELETE over IPv6 works.
    it ("should support a properly signed HTTPS " + verb + " over IPv6", function(done) {
      request_sender.sendAuthenticatedRequest(verb, 'https://[::1]:8443/job/12345', {headers: {connection: 'keep-alive'}, strictSSL: false, hostname: '[::1]'}, 200, done);
    });
  });
});
