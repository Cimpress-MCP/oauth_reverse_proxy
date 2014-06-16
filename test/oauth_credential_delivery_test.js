var _ = require('underscore');
var should = require('should');

var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

var test_server = require('./server/test_server.js');
var job_server = test_server.JobServer;

// All tests must require auspice_bootstrap_test since that creates our proxy, starts our job server, and
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./auspice_bootstrap_test.js');

// This is a set of tests to validate that OAuth credentials can be sent on the query string or even in
// the body of POSTs and PUTs in addition to via the more traditional Authorization header.
describe('Auspice OAuth credential transport', function() {
  
  var validate_requests = function(verb, url, transport, options, request_setup_fn, done) {
    var alternative_transport_based_request;
    var header_based_request;
    
    var alternative_transport_options = _.clone(options);
    
    // If there's a function to populate the request_sender or arguments of the request, run it now.
    if (request_setup_fn) request_setup_fn(options);
    
    // Set a job_server listener to grab the authenticated request when it hits the job server
    job_server.once(verb + " /job", function(req, res) {
      header_based_request = req;
    });
    
    request_sender.sendAuthenticatedRequest(verb, url, options, 200, function(err, res, body) {

      var header_based_response = res;
      var header_based_response_body = body;
      
      // Reset the request_sender since we are sending back to back authenticated requests within a single
      // test, so we can't rely on beforeEach cleaning state for us.
      request_sender.reset();

      // Set request_sender to use the query string to send our OAuth creds.
      request_sender.setCredentialTransport(transport);
    
      // If there's a function to populate the request_sender or arguments of the request, run it now.
      if (request_setup_fn) request_setup_fn(alternative_transport_options);
      
      // Set a job_server listener to grab the unauthenticated request when it hits the job server
      job_server.once(verb + " /job", function(req, res) {
        alternative_transport_based_request = req;
      });
      
      request_sender.sendAuthenticatedRequest(verb, url, alternative_transport_options, 200, function(err, res, body) {
      
        var alternative_transport_based_response = res;
        var alternative_transport_based_response_body = body;

        // IGNORABLE_REQUEST_HEADERS contains Authorization, so we don't need to worry about that known difference, but
        // we do need to add content-type and content-length when headers are sent via request body.
        var known_request_differences = validation_tools.IGNORABLE_REQUEST_HEADERS;
        if (transport === request_sender.CREDENTIAL_TRANSPORT_BODY)
          known_request_differences = _.union(known_request_differences, ['content-type', 'content-length'])
    
        // Deep compare the objects after omitting the set of keys known a priori to differ when a query string is
        // used for credentials rather than an Authorization header.
        validation_tools.compareHeaders(
          header_based_request.headers,
          alternative_transport_based_request.headers,
          known_request_differences
        ).should.equal(true);

        // Now validate that the response headers and body are correct.  Note that we explicitly ignore
        // last-modified and etag in the header comparison because it can differ by a second based on when the
        // disk writes from multer quiesced.
        validation_tools.compareHeaders(
          alternative_transport_based_response.headers, header_based_response.headers,
          ['date', 'last-modified', 'etag']
        ).should.equal(true);
      
        // Compare the bodies, and make sure we got a large enough response to be plausible.
        alternative_transport_based_response_body.should.equal(header_based_response_body);
        alternative_transport_based_response_body.should.equal('{"status":"ok"}');
    
        done();
      });
    });
  };
  
  ['GET', 'DELETE'].forEach(function(verb) {
    it ("should accept credentials for " + verb + " via query string or auth header", function(done) {
      validate_requests(verb, 'http://localhost:8008/job/12345', request_sender.CREDENTIAL_TRANSPORT_QUERY, null, null, done);
    });
  });
  
  ['GET', 'DELETE'].forEach(function(verb) {
    it ("should accept credentials for " + verb + " via query string or auth header with existing query string", function(done) {
      
      var request_setup_fn = function() {
        request_sender.params.push(['params', 'are']);
        request_sender.params.push(['still', 'ok']);
      };

      validate_requests(verb, 'http://localhost:8008/job/12345?params=are&still=ok',
        request_sender.CREDENTIAL_TRANSPORT_QUERY, null, request_setup_fn, done);
    });
  });
  
  ['PUT', 'POST'].forEach(function(verb) {
    it ("should accept credentials for " + verb + " via POST or auth header", function(done) {
      validate_requests(verb, 'http://localhost:8008/job', request_sender.CREDENTIAL_TRANSPORT_BODY, null, null, done);
    });
  });
  
  ['PUT', 'POST'].forEach(function(verb) {
    it ("should accept credentials for " + verb + " via POST or auth header with existing POST parameters", function(done) {
      
      var request_setup_fn = function() {
        request_sender.params.push(['posts', 'are']);
        request_sender.params.push(['still', 'ok']);
      };
      
      validate_requests(verb, 'http://localhost:8008/job', request_sender.CREDENTIAL_TRANSPORT_BODY, 
        {form:{posts:'are', still:'ok'}}, request_setup_fn, done);
    });
  });
});
