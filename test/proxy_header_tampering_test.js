var _ = require('underscore');

var job_server = require('./server/test_server.js').JobServer;

var header_modifier = require('../lib/header_modifier.js');

// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');

// All tests must require auspice_bootstrap_test since that creates our proxy, starts our job server, and
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.  
require('./auspice_bootstrap_test.js');

// This is a set of tests to validate that Auspice correctly adds the x-forwarded-* and via headers to the proxied request.
describe('Auspice request header tampering: addition of x-forwarded-*, via, and correlator id', function() {
  
  // Validate that a basic POST or PUT works.  Loop over each verb, running the common tests between them.
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
    
    var expected_headers = [
      ['host', 'localhost:8080'],
      ['x-forwarded-for', '127.0.0.1'],
      ['x-forwarded-port', '8008'],
      ['x-forwarded-proto', 'http'],
      ['via', '1.1 localhost (Auspice v' + process.env.AUSPICE_VERSION + ')']
    ];
    
    it("should add x-forwarded-* and via headers to proxied " + verb + " requests", function(done) {
      job_server.once(verb + " /job", function(req, res) {
        expected_headers.forEach(function(header_pair) {
          req.headers[header_pair[0]].should.equal(header_pair[1]);
        });
        
        // Also check for correlator id and match that it's a UUID per RFC 4122 v4. 
        req.headers['x-vp-correlatorid'].should.match(/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12}/);
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
      ['x-forwarded-proto', 'http,http'],
      ['via', '1.1 devlexicebun001,1.1 localhost (Auspice v' + process.env.AUSPICE_VERSION + ')']
    ];
    
    it("should append x-forwarded-* and via headers to proxied " + verb + " requests with existing x-forwarded-* headers", function(done) {
      job_server.once(verb + " /job", function(req, res) {
        expected_headers.forEach(function(header_pair) {
          req.headers[header_pair[0]].should.equal(header_pair[1]);
        });
        
        req.headers['x-vp-correlatorid'].should.equal('1d324044-308c-4b7b-b324-684f21d68c55');
      });

      var existing_headers = {
        'x-forwarded-for': '10.10.56.32',
        'x-forwarded-port': '8888',
        'x-forwarded-proto': 'http',
        'via': '1.1 devlexicebun001',
        'x-vp-correlatorid': '1d324044-308c-4b7b-b324-684f21d68c55'
      };

      request_sender.sendAuthenticatedRequest(verb, null, {headers:existing_headers}, 200, done);
    });
  });
});

// This is a set of tests to validate that Auspice correctly modifies the host header in the proxied request.
describe('Auspice request header tampering: host', function() {
  
  // All of the below requests 
  var stub_request;
  beforeEach(function() {
    stub_request = {
      headers: {
        host: 'prdlexbun001.vistaprint.svc:8000'
      }
    };
  });
  
  it('should support modifying a host header from a custom port to another custom port', function(done) {
    var host_header_modifier = header_modifier.modifyHostHeaders(8000, 8888);
    host_header_modifier(stub_request, null, function() {
      stub_request.headers.host.should.equal('prdlexbun001.vistaprint.svc:8888');
      done();
    });
  });
  
  it('should support modifying the host header even when the from port isn\'t present in the original host header', function(done) {
    var host_header_modifier = header_modifier.modifyHostHeaders(4000, 8888);
    host_header_modifier(stub_request, null, function() {
      stub_request.headers.host.should.equal('prdlexbun001.vistaprint.svc:8888');
      done();
    });
  });
  
  [80, 443].forEach(function(port) {  
    it("should support modifying a host header from a custom port to a standard port (" + port + ")", function(done) {
      var host_header_modifier = header_modifier.modifyHostHeaders(8000, port);
      host_header_modifier(stub_request, null, function() {
        stub_request.headers.host.should.equal('prdlexbun001.vistaprint.svc');
        done();
      });
    });
  
    it("should support modifying a host header from a standard port (" + port + ") to a custom port", function(done) {
      stub_request.headers.host = 'prdlexbun001.vistaprint.svc';
      var host_header_modifier = header_modifier.modifyHostHeaders(port, 8000);
      host_header_modifier(stub_request, null, function() {
        stub_request.headers.host.should.equal('prdlexbun001.vistaprint.svc:8000');
        done();
      });
    });
  
    it("should support modifying to standard port " + port + " even when the from port isn\'t present in the original host header", function(done) {
      var host_header_modifier = header_modifier.modifyHostHeaders(4000, port);
      host_header_modifier(stub_request, null, function() {
        stub_request.headers.host.should.equal('prdlexbun001.vistaprint.svc');
        done();
      });
    });
  });
  
});