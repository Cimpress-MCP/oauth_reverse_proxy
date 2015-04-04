var fs = require('fs');
var util = require('util');

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
  // Tests that compressed response content is handled by oauth_reverse_proxy.
  describe(mode + ' message integrity: compression', function() {

    var sendFn = mode === 'oauth_reverse_proxy' ?
      request_sender.sendAuthenticatedRequest :
      request_sender.sendProxyAuthenticatedRequest;

    ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {

      // Validate that a response containing gzipped content is handled properly.
      it ("should handle a gzipped response to a " + verb, function(done) {
        sendFn(verb, 'http://localhost:8008/compressed_content', {headers:{'accept-encoding':'gzip'}}, 200,
        function(err, res, body) {
          res.headers['content-encoding'].should.equal('gzip');
          body.should.equal(validation_tools.LOREM_IPSUM);
          done();
        });
      });

      // Validate that a response containing deflated content is handled properly.
      it ("should handle a gzipped response to a " + verb, function(done) {
        sendFn(verb, 'http://localhost:8008/compressed_content', {headers:{'accept-encoding':'deflate'}}, 200,
        function(err, res, body) {
          res.headers['content-encoding'].should.equal('deflate');
          body.should.equal(validation_tools.LOREM_IPSUM);
          done();
        });
      });
    });
  });

});

