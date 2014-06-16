var _ = require('underscore');

var job_server = require('./server/test_server.js').JobServer;

// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');

// All tests must require auspice_bootstrap_test since that creates our proxy, starts our job server, and
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.  
require('./auspice_bootstrap_test.js');

// This is a set of tests to validate that Auspice correctly adds the x-forwarded-* and vp-correlation-id
// headers to the proxied request.
describe('Auspice request header additions', function() {
  
  // Validate that a basic POST or PUT works.  Loop over each verb, running the common tests between them.
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
    
    var expected_headers = [
      ['host', 'localhost:8080'],
      ['x-forwarded-for', '127.0.0.1'],
      ['x-forwarded-port', '8008'],
      ['x-forwarded-proto', 'http']
    ];
    
    it("should add x-forwarded-* headers to proxied " + verb + " requests", function(done) {
      job_server.once(verb + " /job", function(req, res) {
        expected_headers.forEach(function(header_pair) {
          req.headers[header_pair[0]].should.equal(header_pair[1]);
        });
      });
      
      request_sender.sendSimpleAuthenticatedRequest(verb, 200, done);
    });
  });
  
  // Validate that a basic POST or PUT works.  Loop over each verb, running the common tests between them.
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
    
    var expected_headers = [
      ['host', 'localhost:8080'],
      ['x-forwarded-for', '10.10.56.32,127.0.0.1'],
      ['x-forwarded-port', '8888,8008'],
      ['x-forwarded-proto', 'http,http']
    ];
    
    it("should append x-forwarded-* headers to proxied " + verb + " requests with existing x-forwarded-* headers", function(done) {
      job_server.once(verb + " /job", function(req, res) {
        expected_headers.forEach(function(header_pair) {
          req.headers[header_pair[0]].should.equal(header_pair[1]);
        });
      });

      var existing_headers = {
        'x-forwarded-for': '10.10.56.32',
        'x-forwarded-port': '8888',
        'x-forwarded-proto': 'http'
      };

      request_sender.sendAuthenticatedRequest(verb, null, {headers:existing_headers}, 200, done);
    });
  });
  
});