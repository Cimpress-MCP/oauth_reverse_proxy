var _ = require('underscore');
var fs = require('fs');
var path = require('path');

var job_server = require('./job_server/');

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

  // Tests that SOAP-style messages are handled by oauth_reverse_proxy
  describe(mode + ' message integrity: SOAP', function() {

    var sendFn = mode === 'oauth_reverse_proxy' ?
      request_sender.sendAuthenticatedRequest :
      request_sender.sendProxyAuthenticatedRequest;

    // Test SOAP-ish messages
    it ('should handle a SOAP request', function(done) {
      var unauthenticated_request;
      var authenticated_request;

      // Set a job_server listener to grab the authenticated request when it hits the job server
      job_server.once('POST /getProducts', function(req, res) {
        authenticated_request = req;
        req.body.should.equal(validation_tools.STOCK_XML_CONTENTS);
      });

      var soap_headers = {headers:{'content-type':'application/soap+xml; charset=utf-8'}};

      // Send an authenticated multipart POST
      validation_tools.STOCK_XML_STREAM.pipe(
        sendFn('POST', 'http://localhost:8008/getProducts', soap_headers, 200, function(err, res, body) {

        var authenticated_response = res;
        var authenticated_response_body = body;

        // Set a job_server listener to grab the unauthenticated request when it hits the job server
        job_server.once('POST /getProducts', function(req, res) {
          unauthenticated_request = req;
          req.body.should.equal(validation_tools.STOCK_XML_CONTENTS);
        });

        // Send an unauthenticated multipart POST or PUT
        validation_tools.STOCK_XML_STREAM.pipe(
          request_sender.sendRequest('POST', 'http://localhost:8080/getProducts', soap_headers, 200, function(err, res, body) {

          var unauthenticated_response = res;
          var unauthenticated_response_body = body;

          // Deep compare the objects after omitting the set of keys known a priori to differ when
          // the proxy is used.
          validation_tools.compareHeaders(
            authenticated_request.headers,
            unauthenticated_request.headers,
            validation_tools.IGNORABLE_REQUEST_HEADERS
          ).should.equal(true);

          // Validate that the request was sent multipart and chunked.
          authenticated_request.headers['content-type'].should.equal('application/soap+xml; charset=utf-8');
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
          authenticated_response_body.length.should.be.greaterThan(500);

          done();
        }));
      }));
    });
  });
});
