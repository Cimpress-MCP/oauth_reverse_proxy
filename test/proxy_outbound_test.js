/**
 * Test that requests sent through an outbound proxy are properly signed.
 */
var sprintf = require('../lib/sprintf.js').sprintf;

// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

// All tests must require bootstrap_test since that creates a reverse_proxy, starts our job server,
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./bootstrap_test.js');

// Tests that verbs are handled correctly by oauth_reverse_proxy
describe('oauth_proxy outbound message integrity: verbs', function() {

  ["http", "https"].forEach(function(proto) {

    // GETs and DELETEs have the same URL format and do not expect input, so test them both in a loop.
    ['GET', 'DELETE'].forEach(function(verb) {

      it ('should gracefully handle ' + proto + ' ' +  verb + ' requests to offline hosts', function(done) {
        request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8282/?oauth_proxy_consumer_key=mocha-test-key&oauth_proxy_url=' +
          encodeURIComponent(sprintf('%s://localhost:50505/job/12345', proto)), null, 500, done);
      });

      // Validate that a basic GET or DELETE request works when signed using an oauth_proxy.
      it ("should accept a properly signed basic " + verb + " request via " + proto, function(done) {
        request_sender.sendRequest(verb, 'http://localhost:8282/?oauth_proxy_consumer_key=mocha-test-key&oauth_proxy_url=' +
          encodeURIComponent(sprintf('%s://localhost:%s/job/12345', proto, (proto === 'http' ? '8008' : '8443'))),
          null, 200, done);
      });

      // Validate that a basic GET or DELETE over IPv6 works.
      it ("should accept a properly signed " + verb + " over IPv6 via " + proto, function(done) {
        request_sender.sendRequest(verb, 'http://[::1]:8282/?oauth_proxy_consumer_key=mocha-test-key&oauth_proxy_url=' +
          encodeURIComponent(sprintf('%s://[::1]:%s/job/12345', proto, (proto === 'http' ? '8008' : '8443'))),
          null, 200, done);
      });

      // Validate that a GET or DELETE with query parameters works.
      it ("should accept a properly signed " + verb + " with query via " + proto, function(done) {
        request_sender.sendRequest(verb, 'http://localhost:8282/?oauth_proxy_consumer_key=mocha-test-key&oauth_proxy_url=' +
          encodeURIComponent(sprintf('%s://localhost:%s/job/12345?query=ok', proto, (proto === 'http' ? '8008' : '8443'))),
          null, 200, done);
      });

      // Validate that a GET or DELETE over IPv6 with query parameters works.
      it ("should accept a properly signed " + verb + " over IPv6 with query via " + proto, function(done) {
        request_sender.sendRequest(verb, 'http://[::1]:8282/?oauth_proxy_consumer_key=mocha-test-key&oauth_proxy_url=' +
          encodeURIComponent(sprintf('%s://[::1]:%s/job/12345?query=ok', proto, (proto === 'http' ? '8008' : '8443'))),
          null, 200, done);
      });
    });
  });

});
