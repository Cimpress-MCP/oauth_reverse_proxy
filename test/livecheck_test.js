var should = require('should');

var request_sender = require('./utils/request_sender.js');

// All tests must require auspice_bootstrap_test since that creates our proxy, starts our job server, and
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./auspice_bootstrap_test.js');

// This is a set of tests for handling /livecheck-style URLs.  We allow either /livecheck or /healthcheck through
// without authentication if the verb is GET.  All other verbs and all other forms of those URLs (for example,
// with query strings or with paths) are rejected.  This is to prevent a crafty/lazy developer from using the
// /livecheck route as a way to tunnel information to their underlying service without authenticating.  Auspice
// is, after all, a tool meant to enforce developer inconvenience.
describe('Auspice livecheck exemptions', function() {

  // Create a test case sending a url and expecting a given response.
  var create_livecheck_test = function(verb, url, expected_status_code) {
    return function(done) {
      // Send a request with a given verb and url, validating that expectedStatusCode matches.
      request_sender.sendRequest(verb, url, null, expected_status_code, done);
    }
  };

  // For each livecheck-style URL, which is any that has a case-insensitive path of /livecheck or /healthcheck...
  ['http://localhost:8008/livecheck', 'http://localhost:8008/healthcheck',
   'http://localhost:8008/liveCheck', 'http://localhost:8008/healthCheck'].forEach(function(url) {
     // Create unit tests to validate that we accept all GETs and reject everything else.
     ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
       if (verb === 'GET')
         it ("should allow GET " + url + " through without authentication", create_livecheck_test(verb, url, 200));
      else
        it ("should reject " + verb + "s to " + url + " URLs that lack authentication", create_livecheck_test(verb, url, 400));
    });
  });

  // For each invalid livecheck-style URL (those with a query string or path), validate that unauthenticated GETs
  // are rejected
  ['http://localhost:8008/livecheck?query=so&sneaky', 'http://localhost:8008/healthcheck?query=so&sneaky',
   'http://localhost:8008/livecheck/soSneaky', 'http://localhost:8008/healthcheck/soSneaky'].forEach(function(url) {
    it ("should reject unauthenticated GETs to " + url, function(done) {
      request_sender.sendRequest('GET', url, null, 400, done);
    });
  });
});
