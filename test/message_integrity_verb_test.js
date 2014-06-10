// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

// All tests must require auspice_bootstrap_test since that creates our proxy, starts our job server, and
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.  
require('./auspice_bootstrap_test.js');

// Tests that verbs are handled correctly by Auspice
describe('Auspice message integrity: verbs', function() {

  // GETs and DELETEs have the same URL format and do not expect input, so test them both in a loop.
  ['GET', 'DELETE'].forEach(function(verb) {
    
    // Validate that a basic GET or DELETE request works.
    it ("should accept a properly signed basic " + verb + " request", function(done) {
      request_sender.sendSimpleAuthenticatedRequest(verb, 200, done);
    });
  
    // Validate that a GET or DELETE with query parameters works.
    it ("should accept a properly signed " + verb + " with query", function(done) {
      request_sender.params.push(['query', 'ok']);
      request_sender.sendAuthenticatedRequest(verb, 'http://localhost:8008/job/12345?query=ok', null, 200, done);
    });
  
    // Validate that a GET or DELETE with unsigned query parameters fails due to signature mismatch.
    it ("should reject an improperly signed " + verb + " where query params are not part of the signature", function(done) {
      request_sender.sendAuthenticatedRequest(verb, 'http://localhost:8008/job/12345?query=should_fail', null, 401, done);
    });
  });

  // We want to test that giant query strings aren't allowed for any verb, so loop over them all
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
    
    // Validate that a GET or DELETE with query string longer than 16kb fails due to signature mismatch.
    it ("should reject a " + verb + " with a query greater than 16kb", function(done) {
      var crazy_large_buffer = new Buffer(1024*16);
      for (var i=0; i<crazy_large_buffer.length; ++i) {
        crazy_large_buffer[i] = 'A'.charCodeAt();
      }
      var crazy_large_str = crazy_large_buffer.toString();
      var crazy_large_url = 'http://localhost:8008/job/crazy_huge_job?query_huge_query=' + crazy_large_str;
      request_sender.params.push(['query_huge_query', crazy_large_str]);
      
      request_sender.sendAuthenticatedRequest(verb, crazy_large_url, null, 413, done);
    });
  });
});