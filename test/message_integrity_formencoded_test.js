var _ = require('underscore');
var fs = require('fs');
var path = require('path');

var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

var job_server = require('./server/test_server.js').JobServer;

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

  // Tests that formencoded post and put content is handled by inbound and outbound proxies.
  describe(mode + ' message integrity: formencoded', function() {

    var sendFn = mode === 'oauth_reverse_proxy' ?
      request_sender.sendAuthenticatedRequest :
      request_sender.sendProxyAuthenticatedRequest;

    var simpleSendFn = mode === 'oauth_reverse_proxy' ?
      request_sender.sendSimpleAuthenticatedRequest :
      request_sender.sendSimpleProxyAuthenticatedRequest;

    // Validate that a basic POST or PUT works.  Loop over each verb, running the common tests between them.
    ['POST', 'PUT'].forEach(function(verb) {

      // Validate that a basic, empty POST or PUT works.
      it ("should accept a properly signed " + verb + " with no params", function(done) {
        simpleSendFn(verb, 200, done);
      });

      it ("should accept a properly signed " + verb + " with params", function(done) {
        job_server.once(verb + " /job", function(req, res) {
          req.headers.should.have.property('x-oauth-reverse-proxy-consumer-key', 'mocha-test-key');
          req.method.should.equal(verb);
          _.isEqual(req.body, {'submit':'ok'}).should.equal(true);
        });

        // Add the params to the signature.  Without this line, the call will fail with a 401.
        request_sender.params.push('submit', 'ok');
        sendFn(verb, null, {form:{submit:'ok'}}, 200, done);
      });

      // This test is not relevant for the outbound proxy
      if (mode === 'oauth_reverse_proxy') {
        // Validate that a POST or PUT with unsigned body parameters fails due to signature mismatch.
        it ("should reject an improperly signed " + verb + " where params are not part of the signature", function(done) {
          sendFn(verb, null, {form:{submit:'ok'}}, 401, done);
        });
      }

      // Validate that a POST or PUT with body greater than 1mb fails due to signature mismatch.
      it ("should reject a formencoded " + verb + " with a body greater than 1mb", function(done) {
        var crazy_large_buffer = new Buffer(1025*1024);
        var crazy_huge_form = { 'post': crazy_large_buffer.toString() };

        // Mute console.err message from Express about entity size.  We know this.  It's what we're testing.
        var _console_error = console.error;
        console.error = function() {}

        // Send an authenticated request with a giant form body.
        sendFn(verb, null, {form:crazy_huge_form}, 413, function(err) {
          // reset console.err
          console.error = _console_error;
          done(err);
        });
      });
    });
  });
});
