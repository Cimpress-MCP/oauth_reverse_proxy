var _ = require('underscore');
var fs = require('fs');
var path = require('path');

var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

var job_server = require('./job_server/');

// All tests must require bootstrap_test since that creates our proxy, starts our job server,
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./bootstrap_test.js');

// Run these tests in two modes, one where the outbound request is signed by the proxy and the other
// where a signed request is sent to a reverse proxy.
['oauth_proxy', 'oauth_reverse_proxy'].forEach(function(mode) {

  // Validate that JSON requests and responses are properly routed through oauth_reverse_proxy.
  describe(mode + ' message integrity: multipart', function() {

    var sendFn = mode === 'oauth_reverse_proxy' ?
      request_sender.sendAuthenticatedRequest :
      request_sender.sendProxyAuthenticatedRequest;

    ['POST', 'PUT'].forEach(function(verb) {
      // Validate that a multipart POST or PUT succeeds.
      it ("should accept a multipart " + verb, function(done) {
        var unauthenticated_request;
        var authenticated_request;

        // Set a job_server listener to grab the authenticated request when it hits the job server
        job_server.once(verb + " /uploads", function(req, res) {
          authenticated_request = req;
        });

        // Send an authenticated multipart POST or PUT
        var r = sendFn(verb, 'http://localhost:8008/uploads', null, 200, function(err, res, body) {

          var authenticated_response = res;
          var authenticated_response_body = body;

          // Set a job_server listener to grab the unauthenticated request when it hits the job server
          job_server.once(verb + " /uploads", function(req, res) {
            unauthenticated_request = req;
          });

          // Send an unauthenticated multipart POST or PUT
          var r = request_sender.sendRequest(verb, 'http://localhost:8080/uploads', null, 200, function(err, res, body) {

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
            authenticated_request.headers['content-type'].should.startWith('multipart/form-data; boundary=');

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
          });

          // Populate the form for the unauthenticated POST or PUT
          var form = r.form();
          form.append('first_field', 'multipart_enabled');
          form.append('binary_data', fs.createReadStream(path.join(__dirname, 'resources/booch.jpg')));
        });

        // Populate the form for the authenticated POST or PUT
        var form = r.form();
        form.append('first_field', 'multipart_enabled');
        form.append('binary_data', fs.createReadStream(path.join(__dirname, 'resources/booch.jpg')));
      });
    });
  });
});
