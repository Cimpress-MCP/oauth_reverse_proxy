var fs = require('fs');
var util = require('util');

// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

// All tests must require auspice_bootstrap_test since that creates our proxy, starts our job server, and
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.  
require('./auspice_bootstrap_test.js');

// Tests that compressed response content is handled by Auspice.
describe('Auspice message integrity: verbs', function() {

  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
  
    // Validate that a response containing gzipped content is handled properly.
    it ("should handle a gzipped response to a " + verb, function(done) {
      request_sender.sendAuthenticatedRequest(verb, 'http://localhost:8008/compressed_content', {headers:{'accept-encoding':'gzip'}}, 200,
      function(err, res, body) {
        res.headers['content-encoding'].should.equal('gzip');
        body.should.equal(validation_tools.LOREM_IPSUM);
        done();
      });
    });
  
    // Validate that a response containing deflated content is handled properly.
    it ("should handle a gzipped response to a " + verb, function(done) {
      request_sender.sendAuthenticatedRequest(verb, 'http://localhost:8008/compressed_content', {headers:{'accept-encoding':'deflate'}}, 200,
      function(err, res, body) {
        res.headers['content-encoding'].should.equal('deflate');
        body.should.equal(validation_tools.LOREM_IPSUM);
        done();
      });
    });
  });
});