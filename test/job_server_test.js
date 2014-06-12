var fs = require('fs');
var path = require('path');
var should = require('should');

var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

var test_server = require('./server/test_server.js'); 
var job_server = test_server.JobServer;

// Test the job server in isolation to make sure responses are handled as expected without Auspice involved.
describe('Job Server', function() {
  
  // Initiate the job server in case auspice_bootstrap_test.js has not been required.  This is the only test
  // case where it might be valid to start the job server without starting Auspice: we are only testing the
  // functionality of the job server here.
  before(function(done) {
   test_server.init(8080, function(err) {
     done(err);
   });
  });
  
  // Run tests for unauthenticated GETs and DELETEs
  ['GET', 'DELETE'].forEach(function(verb) {
    it ('should return a valid response to a ' + verb, function(done) {
      request_sender.sendRequest(verb, 'http://localhost:8080/job/unauthenticated_uri', null, 200, done);
    });
  });
  
  // Run tessts for unauthenticated POSTs and PUTs
  ['PUT', 'POST'].forEach(function(verb) {
    it ('should return a valid response to formencoded ' + verb, function(done) {
      request_sender.sendRequest(verb, 'http://localhost:8080/job', {form:{data:'happy'}}, 200, done);
    });
    
    it ('should return a valid response to a multipart ' + verb, function(done) {
      // Send an unauthenticated multipart POST or PUT
      var r = request_sender.sendRequest(verb, 'http://localhost:8080/uploads', null, 200, done);
      
      // Populate the form for the authenticated POST or PUT
      var form = r.form();
      form.append('first_field', 'multipart_enabled');
      form.append('binary_data', fs.createReadStream(path.join(__dirname, 'resources/booch.jpg')));
    });
  });
  
  // Test a compressed reply
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
    it ('should handle a gzip compressed reply to a ' + verb, function(done) {
      request_sender.sendRequest(verb, 'http://localhost:8080/compressed_content', {headers:{'accept-encoding':'gzip'}}, 200,
      function(err, res, body) {
        res.headers['content-encoding'].should.equal('gzip');
        body.should.equal(validation_tools.LOREM_IPSUM);
        done();
      });
    });
    
    it ('should handle a deflate compressed reply to a ' + verb, function(done) {
      request_sender.sendRequest(verb, 'http://localhost:8080/compressed_content', {headers:{'accept-encoding':'deflate'}}, 200,
      function(err, res, body) {
        res.headers['content-encoding'].should.equal('deflate');
        body.should.equal(validation_tools.LOREM_IPSUM);
        done();
      });
    });
  });
  
  // Test a SOAP-ish message
  it ('should handle a SOAP-like POST', function(done) {
      var soap_headers = {headers:{'content-type':'application/soap+xml; charset=utf-8'}};
      // Send an unauthenticated SOAP POST
      validation_tools.STOCK_XML_STREAM.pipe(
        request_sender.sendRequest('POST', 'http://localhost:8080/getProducts', soap_headers, 200, done));
  });
  
  // Test a JSON message
  it ('should handle a JSON POST', function(done) {
      var json_headers = {headers:{'content-type':'application/json; charset=utf-8'}};
      // Send an unauthenticated JSON POST
      validation_tools.STOCK_JSON_STREAM.pipe(
        request_sender.sendRequest('POST', 'http://localhost:8080/transactions', json_headers, 200, done));
  });
});
