/**
 * Test that requests sent through an outbound proxy are properly signed.
 */

// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

// All tests must require auth_proxy_bootstrap_test since that creates a reverse_proxy, starts our job server,
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./auth_proxy_bootstrap_test.js');

// Tests that verbs are handled correctly by oauth_reverse_proxy
describe('oauth_proxy outbound message integrity: verbs', function() {

  // GETs and DELETEs have the same URL format and do not expect input, so test them both in a loop.
  ['GET', 'DELETE'].forEach(function(verb) {

    // Validate that a basic GET or DELETE request works when signed using an oauth_proxy.
    it ("should accept a properly signed basic " + verb + " request", function(done) {
      request_sender.sendRequest(verb, 'http://localhost:8282/?oauth_proxy_consumer_key=mocha-test-key&oauth_proxy_url=' +
        encodeURIComponent('http://localhost:8008/job/12345'),
        null, 200, done);
    });

    // Validate that a basic GET or DELETE over IPv6 works.
    it ("should accept a properly signed " + verb + " over IPv6", function(done) {
      request_sender.sendRequest(verb, 'http://[::1]:8282/?oauth_proxy_consumer_key=mocha-test-key&oauth_proxy_url=' +
        encodeURIComponent('http://[::1]:8008/job/12345'),
        null, 200, done);
    });

    // Validate that a GET or DELETE with query parameters works.
    it ("should accept a properly signed " + verb + " with query", function(done) {
      request_sender.sendRequest(verb, 'http://localhost:8282/?oauth_proxy_consumer_key=mocha-test-key&oauth_proxy_url=' +
        encodeURIComponent('http://localhost:8008/job/12345?query=ok'),
        null, 200, done);
    });

    // Validate that a GET or DELETE over IPv6 with query parameters works.
    it ("should accept a properly signed " + verb + " over IPv6 with query", function(done) {
      request_sender.sendRequest(verb, 'http://[::1]:8282/?oauth_proxy_consumer_key=mocha-test-key&oauth_proxy_url=' +
        encodeURIComponent('http://[::1]:8008/job/12345?query=ok'),
        null, 200, done);
    });


    // Validate that a basic GET or DELETE request works when signed using an oauth_proxy.
    it ("should accept a properly signed basic " + verb + " request", function(done) {
      request_sender.sendRequest(verb, 'http://localhost:8282/?oauth_proxy_consumer_key=mocha-test-key&oauth_proxy_url=' +
        encodeURIComponent('https://localhost:8443/job/12345'),
        null, 200, done);
    });
  });

});
