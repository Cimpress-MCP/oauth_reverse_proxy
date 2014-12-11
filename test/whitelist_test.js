var should = require('should');
var fs = require('fs');
var request_sender = require('./utils/request_sender.js');

// All tests must require auth_proxy_bootstrap_test since that creates our proxy, starts our job server, and
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./auth_proxy_bootstrap_test.js');

// This is a set of tests for handling whitelisted URLs.  As part of the bootstrap, we create a whitelist configuration
// that allows /livecheck paths through the proxy unauthenticated if the verb is GET.  
// All other verbs and other URLs using the GET verb (for example, /healthcheck) are rejected in this configuration.
// As are all other routes off of /livecheck (e.g. /livecheck/DeleteEverything) are also rejected in this configuration.
// This is to prevent a crafty/lazy developer from using the /livecheck route as a way to tunnel information to their 
// underlying service without authenticating.  oauth_reverse_proxy is, after all, a tool meant to enforce developer inconvenience.
describe('oauth_reverse_proxy configurable whitelist exemptions', function() {

  // Create a test case sending a url and expecting a given response.
  var create_livecheck_test = function(verb, url, expected_status_code) {
    return function(done) {
      // Send a request with a given verb and url, validating that expectedStatusCode matches.
      request_sender.sendRequest(verb, url, null, expected_status_code, done);
    }
  };

  // For each livecheck-style URL, which is any that has a case-insensitive path of /livecheck or /healthcheck...
  ['http://localhost:8008/livecheck', 'http://localhost:8008/healthcheck',
   'http://localhost:8008/liveCheck', 'http://localhost:8008/livecheck/CrashProduction'].forEach(function(url) {
     // Create unit tests to validate that we accept all GETs and reject everything else.
     ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
       if (verb === 'GET' && url.toLowerCase() === 'http://localhost:8008/livecheck' )
         it ("should allow GET " + url + " through without authentication", create_livecheck_test(verb, url, 200));
      else
        it ("should reject " + verb + "s to " + url + " URLs that lack authentication", create_livecheck_test(verb, url, 400));
    });
  });
});
