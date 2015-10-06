// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

// All tests must require bootstrap_test since that creates our proxy, starts our job server,
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./bootstrap_test.js');

// Run these tests in two modes, one where the outbound request is signed by the proxy and the other
// where a signed request is sent to a reverse proxy.
['oauth_proxy', 'oauth_reverse_proxy'].forEach(function(mode) {

  // Tests that URL encoding is handled correctly by oauth_reverse_proxy
  describe(mode + ' message integrity: URL encoding', function() {

    var sendFn = mode === 'oauth_reverse_proxy' ?
      request_sender.sendAuthenticatedRequest :
      request_sender.sendProxyAuthenticatedRequest;

    var simpleSendFn = mode === 'oauth_reverse_proxy' ?
      request_sender.sendSimpleAuthenticatedRequest :
      request_sender.sendSimpleProxyAuthenticatedRequest;

    // We want to test that escape characters are acceptable in multiple verbs' query strings, so loop over GET and DELETE
    ['GET', 'DELETE'].forEach(function(verb) {
      // Validate that a GET or DELETE with weird query parameters works.
      it ("should accept a properly signed " + verb + " with a funky query", function(done) {
        request_sender.params.push(['qamper&and', "%%%%froody%%%%"]);
        request_sender.params.push(['query', 'funky town']);
        sendFn(verb, 'http://localhost:8008/job/12345?query=funky%20town&qamper%26and=%25%25%25%25froody%25%25%25%25', null, 200, done);
      });

      // Validate that a GET or DELETE with an empty query value works.
      it ("should accept a properly signed " + verb + " with param that has no value", function(done) {
        request_sender.params.push(['qamper&and', '']);
        request_sender.params.push(['query', 'funky town']);
        sendFn(verb, 'http://localhost:8008/job/12345?qamper%26and=&query=funky%20town', null, 200, done);
      });
    });

    // Make sure to test all verbs
    ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
      // Validate that a verb requesting a URI with an escape character in the path works.
      it ("should accept a properly signed " + verb + " with a funky path", function(done) {
        sendFn(verb, 'http://localhost:8008/%7bwonky%20path%7d/is&wonky', null, 200, done);
      });

      // Validate that a verb requesting a URI with fun characters in the path works.
      it ("should accept a properly signed " + verb + " with non-alphabet UTF-8 characters such as emoji", function(done) {
        sendFn(verb, 'http://localhost:8008/job/12345?doyouwanttobuilda=☃&itdoesnthavetobea=⛄&ok=bye', null, 200, done);
      });
    });
  });
});
