var _ = require('underscore');

var job_server = require('./server/test_server.js').JobServer;

var forward_header_mutator = require('../lib/proxy/mutators/forward_header_mutator.js')();

// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');

// All tests must require auth_proxy_bootstrap_test since that creates our proxy, starts our job server, and
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./auth_proxy_bootstrap_test.js');

// This is a set of tests to validate that oauth_reverse_proxy correctly adds the x-forwarded-* and via headers to the proxied request.
describe('oauth_reverse_proxy request header tampering: addition of x-forwarded-* and via', function() {

  it('should append correct headers for inbound HTTP connections', function(done) {
    // Validate that standard HTTP connection handling works.
    var stub_request = {
      headers: {
        host: 'test.cimpress.com'
      },
      connection: {
        remoteAddress: '10.10.10.1'
      }
    };

    forward_header_mutator(stub_request, null, function() {
      stub_request.headers['x-forwarded-port'].should.equal('80');
      stub_request.headers['x-forwarded-for'].should.equal('10.10.10.1');
      stub_request.headers['x-forwarded-proto'].should.equal('http');
      stub_request.headers['via'].should.equal('1.1 localhost (oauth_reverse_proxy vtst)');
      done();
    });
  });

  it('should append correct headers for inbound SSL connections', function(done) {
    // Validate that SSL-specific handling works.  HTTPs connections must have the connection.pair set to be a realistic test.
    var stub_request = {
      headers: {
        host: 'test.cimpress.com'
      },
      connection: {
        remoteAddress: '10.10.10.1',
        pair: true
      }
    };

    forward_header_mutator(stub_request, null, function() {
      stub_request.headers['x-forwarded-port'].should.equal('443');
      stub_request.headers['x-forwarded-for'].should.equal('10.10.10.1');
      stub_request.headers['x-forwarded-proto'].should.equal('https');
      stub_request.headers['via'].should.equal('1.1 localhost (oauth_reverse_proxy vtst)');
      done();
    });
  });

  // Validate that a basic authenticated request works.  Loop over each verb, running the common tests between them.
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {

    var expected_headers = [
      ['host', 'localhost:8080'],
      ['x-forwarded-for', '127.0.0.1'],
      ['x-forwarded-port', '8008'],
      ['x-forwarded-proto', 'http'],
      ['via', '1.1 localhost (oauth_reverse_proxy vtst)']
    ];

    it("should add x-forwarded-* and via headers to proxied " + verb + " requests", function(done) {
      job_server.once(verb + " /job", function(req, res) {
        expected_headers.forEach(function(header_pair) {
          req.headers[header_pair[0]].should.equal(header_pair[1]);
        });
      });

      request_sender.sendSimpleAuthenticatedRequest(verb, 200, done);
    });
  });

  // Validate that a basic authenticated request works.  Loop over each verb, running the common tests between them.
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {

    var expected_headers = [
      ['host', 'localhost:8080'],
      ['x-forwarded-for', '127.0.0.1'],
      ['x-forwarded-port', '8008'],
      ['x-forwarded-proto', 'http'],
      ['via', '1.1 localhost (oauth_reverse_proxy vtst)']
    ];

    it("should add x-forwarded-* and via headers to proxied " + verb + " requests", function(done) {
      job_server.once(verb + " /job", function(req, res) {
        expected_headers.forEach(function(header_pair) {
          req.headers[header_pair[0]].should.equal(header_pair[1]);
        });
      });

      request_sender.sendSimpleAuthenticatedRequest(verb, 200, done);
    });
  });

  // Validate that a basic authenticated request works.  Loop over each verb, running the common tests between them.
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {

    var expected_headers = [
      ['host', 'localhost:8080'],
      ['x-forwarded-for', '127.0.0.1'],
      ['x-forwarded-port', '8008'],
      ['x-forwarded-proto', 'http'],
      ['via', '1.1 localhost (oauth_reverse_proxy vtst)']
    ];

    it("should add x-forwarded-* and via headers to proxied " + verb + " requests", function(done) {
      job_server.once(verb + " /job", function(req, res) {
        expected_headers.forEach(function(header_pair) {
          req.headers[header_pair[0]].should.equal(header_pair[1]);
        });
      });

      request_sender.sendSimpleAuthenticatedRequest(verb, 200, done);
    });
  });

  // Validate that a basic HTTPs-forwarded request works.  Loop over each verb, running the common tests between them.
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {

    var expected_headers = [
      ['host', 'localhost:8080'],
      ['x-forwarded-for', '10.10.56.32,127.0.0.1'],
      ['x-forwarded-port', '8888,8008'],
      ['x-forwarded-proto', 'https,http'],
      ['via', '1.1 devlexicebun001,1.1 localhost (oauth_reverse_proxy vtst)']
    ];

    // The x-forwarded-proto header being HTTPs indicates to us that the original request was HTTPs and the only
    // signature we need to calculate is HTTPs.  However, request_sender only knows how to make HTTP calls, so we
    // will get a 401 for this test.  That is expected and normal: it means that we calculated the signature only
    // once and failed when the HTTPs signature didn't match our request signature.
    it("should handle proxied HTTPs " + verb + " but fail since the request URL was not actually HTTPs", function(done) {
      job_server.once(verb + " /job", function(req, res) {
        expected_headers.forEach(function(header_pair) {
          req.headers[header_pair[0]].should.equal(header_pair[1]);
        });

        req.headers['x-vp-correlatorid'].should.equal('1d324044-308c-4b7b-b324-684f21d68c55');
      });

      var existing_headers = {
        'x-forwarded-for': '10.10.56.32',
        'x-forwarded-port': '8888',
        'x-forwarded-proto': 'https',
        'via': '1.1 devlexicebun001',
        'x-vp-correlatorid': '1d324044-308c-4b7b-b324-684f21d68c55'
      };

      request_sender.sendAuthenticatedRequest(verb, null, {headers:existing_headers}, 401, done);
    });
  });
});

// This is a set of tests to validate that oauth_reverse_proxy correctly modifies the host header in the proxied request.
describe('oauth_reverse_proxy request header tampering: host', function() {

  // All of the below requests
  var stub_request;
  beforeEach(function() {
    stub_request = {
      headers: {
        host: 'test.cimpress.com:8000'
      }
    };
  });

  it('should support modifying a host header from a custom port to another custom port', function(done) {
    var host_header_mutator = require('../lib/proxy/mutators/host_header_mutator.js')({config:{from_port: 8000, to_port: 8888}});
    host_header_mutator(stub_request, null, function() {
      stub_request.headers.host.should.equal('test.cimpress.com:8888');
      done();
    });
  });

  it('should support modifying the host header even when the from port isn\'t present in the original host header', function(done) {
    var host_header_mutator = require('../lib/proxy/mutators/host_header_mutator.js')({config:{from_port: 4000, to_port: 8888}});
    host_header_mutator(stub_request, null, function() {
      stub_request.headers.host.should.equal('test.cimpress.com:8888');
      done();
    });
  });

  [80, 443].forEach(function(port) {
    it("should support modifying a host header from a custom port to a standard port (" + port + ")", function(done) {
      var host_header_mutator = require('../lib/proxy/mutators/host_header_mutator.js')({config:{from_port: 8000, to_port: port}});
      host_header_mutator(stub_request, null, function() {
        stub_request.headers.host.should.equal('test.cimpress.com');
        done();
      });
    });

    it("should support modifying a host header from a standard port (" + port + ") to a custom port", function(done) {
      stub_request.headers.host = 'test.cimpress.com';
      var host_header_mutator = require('../lib/proxy/mutators/host_header_mutator.js')({config:{from_port: port, to_port: 8000}});
      host_header_mutator(stub_request, null, function() {
        stub_request.headers.host.should.equal('test.cimpress.com:8000');
        done();
      });
    });

    it("should support modifying to standard port " + port + " even when the from port isn\'t present in the original host header", function(done) {
      var host_header_mutator = require('../lib/proxy/mutators/host_header_mutator.js')({config:{from_port: 4000, to_port: port}});
      host_header_mutator(stub_request, null, function() {
        stub_request.headers.host.should.equal('test.cimpress.com');
        done();
      });
    });
  });
});

