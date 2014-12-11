var should = require('should');

var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var util = require('util');

var test_server = require('./server/test_server.js');
var job_server = test_server.JobServer;

// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

// All tests must require auth_proxy_bootstrap_test since that creates our proxy, starts our job server, and
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./auth_proxy_bootstrap_test.js');

// Validate that JSON requests and responses are properly routed through oauth_reverse_proxy.
describe('oauth_reverse_proxy message integrity: JSON', function() {

  ['POST', 'PUT'].forEach(function(verb) {

    // Validate that a JSON POST or PUT succeeds.
    it ("should accept a " + verb + " with a JSON body", function(done) {
      var unauthenticated_request;
      var authenticated_request;

      // Set a job_server listener to grab the authenticated request when it hits the job server
      job_server.once(verb + " /transactions", function(req, res) {
        authenticated_request = req;
        (_.isEqual(authenticated_request.body, validation_tools.STOCK_JSON_OBJECT)).should.equal(true);
      });

      var json_header = {headers:{'content-type':'application/json'}};

      // Send an authenticated JSON POST or PUT
      validation_tools.STOCK_JSON_STREAM.pipe(
        request_sender.sendAuthenticatedRequest(verb, 'http://localhost:8008/transactions', json_header, 200, function(err, res, body) {

        var authenticated_response = res;
        var authenticated_response_body = body;

        // Set a job_server listener to grab the unauthenticated request when it hits the job server
        job_server.once(verb + " /transactions", function(req, res) {
          unauthenticated_request = req;
          // Validate that the JSON message made it to the server intact.
          (_.isEqual(unauthenticated_request.body, validation_tools.STOCK_JSON_OBJECT)).should.equal(true);
        });

        // Send an unauthenticated JSON POST or PUT
        validation_tools.STOCK_JSON_STREAM.pipe(
          request_sender.sendRequest(verb, 'http://localhost:8080/transactions', json_header, 200, function(err, res, body) {

          var unauthenticated_response = res;
          var unauthenticated_response_body = body;

          // Deep compare the objects after omitting the set of keys known a priori to differ when
          // the proxy is used.
          validation_tools.compareHeaders(
            authenticated_request.headers,
            unauthenticated_request.headers,
            validation_tools.IGNORABLE_REQUEST_HEADERS
          ).should.equal(true);

          // Validate that the request was sent JSON and chunked.
          authenticated_request.headers['content-type'].should.equal('application/json');
          authenticated_request.headers['transfer-encoding'].should.equal('chunked');

          // Now validate that the response headers and body are correct.  Note that we explicitly ignore
          // last-modified and etag in the header comparison because it can differ by a second based on when the
          // disk writes from multer quiesced.
          validation_tools.compareHeaders(
            authenticated_response.headers, unauthenticated_response.headers,
            ['date', 'last-modified', 'etag']
          ).should.equal(true);

          // Compare the bodies, and make sure we got a large enough response to be plausible.
          authenticated_response_body.should.equal(unauthenticated_response_body);
          authenticated_response_body.length.should.be.greaterThan(1000);

          done();
        }));
      }));
    });
  });
});
