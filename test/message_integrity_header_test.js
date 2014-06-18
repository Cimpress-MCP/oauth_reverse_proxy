var _ = require('underscore');

var job_server = require('./server/test_server.js').JobServer;

// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

// All tests must require auspice_bootstrap_test since that creates our proxy, starts our job server, and
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.  
require('./auspice_bootstrap_test.js');

// This is a set of tests to validate that Auspice does not tamper with the request or response
// headers or other components of the messages that transit through the proxy.  Unlike many of
// the other test suites, this requires that we send two requests (one authenticated and one
// unauthenticated) to validate that there are no unexpected differences in content.
describe('Auspice message integrity: headers', function() {

  // Run the message integrity validations once for each verb.
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {

    // A custom set of headers to send with our requests.
    var custom_headers = {
      headers: {
        custom: 'header',
        more: 'custom_headers'
      }
    };
    
    // This test sends a request to both an authenticated and unauthenticated endpoint, with custom
    // headers, and validates that there are no differences (other than expected differences in
    // auth headers, for example).
    it ("should proxy headers to and from a " + verb + " intact", function(done) {
      var authenticated_url = request_sender.VERB_DEFAULT_ROUTES[verb];
      var vanilla_url = authenticated_url.replace(8008, 8080);
      
      var vanilla_request_headers;
      var authenticated_request_headers;
      
      job_server.once(verb + " /job", function(req, res) {
        vanilla_request_headers = req.headers;
      });
      
      request_sender.sendRequest(verb, vanilla_url, custom_headers, 200, function(err, res, body) {
        if (err) return done(err);

        job_server.once(verb + " /job", function(req, res) {
          authenticated_request_headers = req.headers;
        });
        
        var vanilla_response_headers = res.headers;
        request_sender.sendAuthenticatedRequest(verb, authenticated_url, custom_headers, 200, function(err, res, body) {
          if (err) return done(err);
        
          var authenticated_response_headers = res.headers;
        
          // Compare the two sets of response headers
          validation_tools.compareHeaders(
            authenticated_response_headers,
            vanilla_response_headers,
            validation_tools.IGNORABLE_RESPONSE_HEADERS
          ).should.equal(true);
          _.keys(authenticated_response_headers).length.should.be.above(4);

          // Compare the two sets of request headers          
          validation_tools.compareHeaders(
            authenticated_request_headers,
            vanilla_request_headers,
            validation_tools.IGNORABLE_REQUEST_HEADERS
          ).should.equal(true);
        
          vanilla_request_headers['custom'].should.equal('header');
          vanilla_request_headers['more'].should.equal('custom_headers');
          
          done();
        });
      });
    });
    
    it ("should support chunked responses for " + verb, function(done) {
      request_sender.sendAuthenticatedRequest(verb, 'http://localhost:8008/transactions', null, 200, function(err, auth_res, auth_body) {
        if (err) return done(err);
      
        auth_res.headers['transfer-encoding'].should.equal('chunked');
        request_sender.sendRequest(verb, 'http://localhost:8080/transactions', null, 200, function(err, res, body) {
          if (err) return done(err);
        
          auth_res.headers['transfer-encoding'].should.equal('chunked');
          auth_body.should.equal(body);
          done();
        });
      });
    });
  });
});
