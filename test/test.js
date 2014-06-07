var should = require('should');

var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var stream = require('stream')
var util = require('util');


var test_server = require('./server/test_server.js');
var job_server = test_server.JobServer;
var keygen = require('../utils/keygen.js');

// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./request_sender.js');
var ResponseValidatorFactoryClass = request_sender.ResponseValidator;

// These cleanup operations need to run before each test to make sure the state of the
// suite is consistent.  Placed here, they will be run before all suites and tests.
beforeEach(function() {
  
  // Make sure there are no pending event listeners before each test.
  if (job_server) job_server.removeAllListeners();
  
  // Reset the internal state of the request_sender so each unit test gets a tabula rasa.
  request_sender.reset();
});

var IGNORABLE_REQUEST_HEADERS = ['authorization', 'host', 'vp_user_key', 'content-type'];
var IGNORABLE_RESPONSE_HEADERS = [ 'date' ];

var STOCK_JSON_CONTENTS = fs.readFileSync('./test/resources/test.json', {encoding:'utf8'});
var STOCK_JSON_OBJECT = JSON.parse(STOCK_JSON_CONTENTS);

var STOCK_JSON_STREAM = new stream();
STOCK_JSON_STREAM.pipe = function(target) {
  target.write(STOCK_JSON_CONTENTS);
}

var STOCK_XML_CONTENTS = fs.readFileSync('./test/resources/get_list_of_products.xml', {encoding:'utf8'});
var STOCK_XML_STREAM = new stream();
STOCK_XML_STREAM.pipe = function(target) {
  target.write(STOCK_XML_CONTENTS);
}

// Compare the two sets of headers and return true only if they are equal in both name and
// value, aside from the keys listed in keys_to_ignore.
var compare_headers = function(auth, unauth, keys_to_ignore) {
  
  // Default to an empty set if no keys were provided.
  keys_to_ignore = keys_to_ignore || {};

  // Deep compare the objects after omitting the set of keys that may differ between calls.
  var rvalue = _.isEqual(
    _.omit(auth, keys_to_ignore),
    _.omit(unauth, keys_to_ignore)
  );
  
  // If we have a header difference, this may the result of a transient condition and very difficult
  // to reproduce.  Log the headers to make sure we know what happened.
  if (!rvalue) 
    console.log('auth:\n%s\n,unauth:\n%s\nto_ignore:\n%s', util.inspect(auth), util.inspect(unauth), util.inspect(keys_to_ignore));
    
  return rvalue;
};

describe('Auspice Resiliency', function() {
  
  // Before starting Auspice, create the keys we need for test clients.
  before(function(done) {
    keygen.createKey(__dirname + '/keys', 8008, 8080, 'bash-test-key', function(err) {
      keygen.createKey(__dirname + '/keys', 8008, 8080, 'dotnet-test-key', function(err) {
        keygen.createKey(__dirname + '/keys', 8008, 8080, 'java-test-key', function(err) {
          keygen.createKey(__dirname + '/keys', 8008, 8080, 'node-test-key', function(err) {
            keygen.createKey(__dirname + '/keys', 8008, 8080, 'perl-test-key', function(err) {
              keygen.createKey(__dirname + '/keys', 8008, 8080, 'powershell-test-key', function(err) {
                keygen.createKey(__dirname + '/keys', 8008, 8080, 'python-test-key', function(err) {
                  keygen.createKey(__dirname + '/keys', 8008, 8080, 'ruby-test-key', function(err) {
                    keygen.createKey(__dirname + '/keys', 8008, 8080, 'mocha-test-key', function(err) {
                      request_sender.mocha_secret = fs.readFileSync(__dirname + '/keys/8008/8080/mocha-test-key') + '&';
                      done(err);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
  
  it ('should start cleanly', function(done) {
    var auspice = require(__dirname + '/../lib');
    auspice.init(__dirname + '/keys', function(err, proxy) {
      if (err) return should.fail('Auspice startup failed: ' + err);
      
      // Turn the proxy.keys object into an array to get its length
      (_.keys(proxy.keys).length).should.be.exactly(9);
      done();
    });
  });
  
  it ('should gracefully handle /livecheck requests to offline hosts', function(done) {
    request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8008/livecheck', null, 500, done);
  });

  it ("should gracefully handle authenticated GET requests to offline hosts", function(done) {
    request_sender.sendSimpleAuthenticatedRequest('GET', 500, done);
  });

});

// Test the job server in isolation to make sure responses are handled as expected without Auspice involved.
describe('Job Server', function() {
  
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
  
  // Test a SOAP-ish message
  it ('should handle a SOAP-like POST', function(done) {
      var soap_headers = {headers:{'content-type':'application/soap+xml; charset=utf-8'}};
      // Send an unauthenticated SOAP POST
      STOCK_XML_STREAM.pipe(
        request_sender.sendRequest('POST', 'http://localhost:8080/getProducts', soap_headers, 200, done));
  });
  
  // Test a JSON message
  it ('should handle a JSON POST', function(done) {
      var json_headers = {headers:{'content-type':'application/json; charset=utf-8'}};
      // Send an unauthenticated SOAP POST
      STOCK_JSON_STREAM.pipe(
        request_sender.sendRequest('POST', 'http://localhost:8080/transactions', json_headers, 200, done));
  });
});

// Auspice is an authenticating proxy.  Let's describe it.
describe('Auspice', function() {
  
  // Describe the Auspice proxy.  This suite represents test cases of failing and successful
  // authentication through the proxy.
  describe('Authenticating proxy functionality', function() {
    
    // GETs and DELETEs have the same URL format and do not expect input, so test them both in a loop.
    ['GET', 'DELETE'].forEach(function(verb) {
      
      // Validate that a basic GET or DELETE request works.
      it ("should accept a properly signed basic " + verb + " request", function(done) {
        request_sender.sendSimpleAuthenticatedRequest(verb, 200, done);
      });
    
      // Validate that a GET or DELETE with query parameters works.
      it ("should accept a properly signed " + verb + " with query", function(done) {
        request_sender.params.push(['query', 'ok']);
        request_sender.sendAuthenticatedRequest(verb, 'http://localhost:8008/job/12345?query=ok', null, 200, done);
      });
    
      // Validate that a GET or DELETE with unsigned query parameters fails due to signature mismatch.
      it ("should reject an improperly signed " + verb + " where query params are not part of the signature", function(done) {
        request_sender.sendAuthenticatedRequest(verb, 'http://localhost:8008/job/12345?query=should_fail', null, 401, done);
      });
    });

    // We want to test that giant query strings aren't allowed for any verb, so loop over them all
    ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
      
      // Validate that a GET or DELETE with query string longer than 16kb fails due to signature mismatch.
      it ("should reject a " + verb + " with a query greater than 16kb", function(done) {
        var crazy_large_buffer = new Buffer(1024*16);
        for (var i=0; i<crazy_large_buffer.length; ++i) {
          crazy_large_buffer[i] = 'A'.charCodeAt();
        }
        var crazy_large_str = crazy_large_buffer.toString();
        var crazy_large_url = 'http://localhost:8008/job/crazy_huge_job?query_huge_query=' + crazy_large_str;
        request_sender.params.push(['query_huge_query', crazy_large_str]);
        
        request_sender.sendAuthenticatedRequest(verb, crazy_large_url, null, 413, done);
      });
    });
    
    // Validate that a basic POST or PUT works.  Loop over each verb, running the common tests between them.
    ['POST', 'PUT'].forEach(function(verb) {
      
      // Validate that a basic, empty POST or PUT works.
      it ("should accept a properly signed " + verb + " with no params", function(done) {
        request_sender.sendSimpleAuthenticatedRequest(verb, 200, done);
      });
      
      it ("should accept a properly signed " + verb + " with params", function(done) {
        job_server.once(verb + " /job", function(req, res) {
          req.headers.should.have.property('vp_user_key', 'mocha-test-key');
          req.method.should.equal(verb);
          _.isEqual(req.body, {'submit':'ok'}).should.equal(true);
        });
        
        // Add the params to the signature.  Without this line, the call will fail with a 401.
        request_sender.params.push('submit', 'ok');
        request_sender.sendAuthenticatedRequest(verb, null, {form:{submit:'ok'}}, 200, done);
      });
      
      // Validate that a POST or PUT with unsigned body parameters fails due to signature mismatch.
      it ("should reject an improperly signed " + verb + " where params are not part of the signature", function(done) {
        request_sender.sendAuthenticatedRequest(verb, null, {form:{submit:'ok'}}, 401, done);
      });
      
      // Validate that a POST or PUT with body greater than 1mb fails due to signature mismatch.
      it ("should reject a formencoded " + verb + " with a body greater than 1mb", function(done) {
        var crazy_large_buffer = new Buffer(1025*1024);
        var crazy_huge_form = { 'post': crazy_large_buffer.toString() };
      
        // Mute console.err message from Express about entity size.  We know this.  It's what we're testing.
        var _console_error = console.error;
        console.error = function() {}

        // Send an authenticated request with a giant form body.
        request_sender.sendAuthenticatedRequest(verb, null, {form:crazy_huge_form}, 413, function(err) {
          // reset console.err
          console.error = _console_error;
          done(err);
        });
      });
      
      // Validate that a multipart POST or PUT succeeds.
      it ("should accept a multipart " + verb, function(done) {
        var unauthenticated_request;
        var authenticated_request;
        
        // Set a job_server listener to grab the authenticated request when it hits the job server
        job_server.once(verb + " /uploads", function(req, res) {
          authenticated_request = req;
        });
        
        // Send an authenticated multipart POST or PUT
        var r = request_sender.sendAuthenticatedRequest(verb, 'http://localhost:8008/uploads', null, 200, function(err, res, body) {
          
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
            compare_headers(authenticated_request.headers, unauthenticated_request.headers, IGNORABLE_REQUEST_HEADERS).should.equal(true);
            
            // Validate that the request was sent multipart and chunked.
            authenticated_request.headers['content-type'].should.startWith('multipart/form-data; boundary=');
            authenticated_request.headers['transfer-encoding'].should.equal('chunked');

            // Now validate that the response headers and body are correct.  Note that we explicitly ignore
            // last-modified and etag in the header comparison because it can differ by a second based on when the
            // disk writes from multer quiesced.
            compare_headers(
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
      
      // Validate that a JSON POST or PUT succeeds.
      it ("should accept a " + verb + " with a JSON body", function(done) {
        var unauthenticated_request;
        var authenticated_request;
        
        // Set a job_server listener to grab the authenticated request when it hits the job server
        job_server.once(verb + " /transactions", function(req, res) {
          authenticated_request = req;
          (_.isEqual(authenticated_request.body, STOCK_JSON_OBJECT)).should.equal(true);
        });
        
        var json_header = {headers:{'content-type':'application/json'}};
        
        // Send an authenticated JSON POST or PUT
        STOCK_JSON_STREAM.pipe(
          request_sender.sendAuthenticatedRequest(verb, 'http://localhost:8008/transactions', json_header, 200, function(err, res, body) {
          
          var authenticated_response = res;
          var authenticated_response_body = body;
          
          // Set a job_server listener to grab the unauthenticated request when it hits the job server
          job_server.once(verb + " /transactions", function(req, res) {
            unauthenticated_request = req;
            // Validate that the JSON message made it to the server intact.
            (_.isEqual(unauthenticated_request.body, STOCK_JSON_OBJECT)).should.equal(true);
          });
          
          // Send an unauthenticated JSON POST or PUT
          STOCK_JSON_STREAM.pipe(
            request_sender.sendRequest(verb, 'http://localhost:8080/transactions', json_header, 200, function(err, res, body) {
            
            var unauthenticated_response = res;
            var unauthenticated_response_body = body;
          
            // Deep compare the objects after omitting the set of keys known a priori to differ when
            // the proxy is used.
            compare_headers(authenticated_request.headers, unauthenticated_request.headers, IGNORABLE_REQUEST_HEADERS).should.equal(true);
            
            // Validate that the request was sent JSON and chunked.
            authenticated_request.headers['content-type'].should.equal('application/json');
            authenticated_request.headers['transfer-encoding'].should.equal('chunked');

            // Now validate that the response headers and body are correct.  Note that we explicitly ignore
            // last-modified and etag in the header comparison because it can differ by a second based on when the
            // disk writes from multer quiesced.
            compare_headers(
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
    
    // Test SOAP-ish messages
    it ('should handle a SOAP request', function(done) {
      var unauthenticated_request;
      var authenticated_request;
      
      // Set a job_server listener to grab the authenticated request when it hits the job server
      job_server.once('POST /getProducts', function(req, res) {
        authenticated_request = req;
        req.body.should.equal(STOCK_XML_CONTENTS);
      });
      
      var soap_headers = {headers:{'content-type':'application/soap+xml; charset=utf-8'}};
      
      // Send an authenticated multipart POST or PUT
      STOCK_XML_STREAM.pipe(
        request_sender.sendAuthenticatedRequest('POST', 'http://localhost:8008/getProducts', soap_headers, 200, function(err, res, body) {
        
        var authenticated_response = res;
        var authenticated_response_body = body;
        
        // Set a job_server listener to grab the unauthenticated request when it hits the job server
        job_server.once('POST /getProducts', function(req, res) {
          unauthenticated_request = req;
          req.body.should.equal(STOCK_XML_CONTENTS);
        });
        
        // Send an unauthenticated multipart POST or PUT
        STOCK_XML_STREAM.pipe(
          request_sender.sendRequest('POST', 'http://localhost:8080/getProducts', soap_headers, 200, function(err, res, body) {
          
          var unauthenticated_response = res;
          var unauthenticated_response_body = body;
        
          // Deep compare the objects after omitting the set of keys known a priori to differ when
          // the proxy is used.
          compare_headers(authenticated_request.headers, unauthenticated_request.headers, IGNORABLE_REQUEST_HEADERS).should.equal(true);
          
          // Validate that the request was sent multipart and chunked.
          authenticated_request.headers['content-type'].should.equal('application/soap+xml; charset=utf-8');
          authenticated_request.headers['transfer-encoding'].should.equal('chunked');

          // Now validate that the response headers and body are correct.  Note that we explicitly ignore
          // last-modified and etag in the header comparison because it can differ by a second based on when the
          // disk writes from multer quiesced.
          compare_headers(
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
  
  // This is a set of tests to validate that Auspice does not tamper with the request or response
  // headers or other components of the messages that transit through the proxy.  Unlike many of
  // the other test suites, this requires that we send two requests (one authenticated and one
  // unauthenticated) to validate that there are no unexpected differences in content.
  describe('Message integrity protection', function() {

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
            compare_headers(authenticated_response_headers, vanilla_response_headers, IGNORABLE_RESPONSE_HEADERS).should.equal(true);
            _.keys(authenticated_response_headers).length.should.be.above(4);

            // Compare the two sets of request headers          
            compare_headers(authenticated_request_headers, vanilla_request_headers, IGNORABLE_REQUEST_HEADERS).should.equal(true);
          
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

  // This is a set of tests for handling /livecheck-style URLs.  We allow either /livecheck or /healthcheck through
  // without authentication if the verb is GET.  All other verbs and all other forms of those URLs (for example,
  // with query strings or with paths) are rejected.  This is to prevent a crafty/lazy developer from using the
  // /livecheck route as a way to tunnel information to their underlying service without authenticating.  Auspice
  // is, after all, a tool meant to enforce developer inconvenience.  
  describe('Livecheck exceptions', function() {
    
    // Create a test case sending a url and expecting a given response.
    var create_livecheck_test = function(verb, url, expected_status_code) {
      return function(done) {
        // Send a request with a given verb and url, validating that expectedStatusCode matches.
        request_sender.sendRequest(verb, url, null, expected_status_code, done);
      }
    };
    
    // For each livecheck-style URL, which is any that has a case-insensitive path of /livecheck or /healthcheck...
    ['http://localhost:8008/livecheck', 'http://localhost:8008/healthcheck', 
     'http://localhost:8008/liveCheck', 'http://localhost:8008/healthCheck'].forEach(function(url) {
       // Create unit tests to validate that we accept all GETs and reject everything else.
       ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
         if (verb === 'GET')
           it ("should allow GET " + url + " through without authentication", create_livecheck_test(verb, url, 200));
        else
          it ("should reject " + verb + "s to " + url + " URLs that lack authentication", create_livecheck_test(verb, url, 400));
      });
    });
    
    // For each invalid livecheck-style URL (those with a query string or path), validate that unauthenticated GETs
    // are rejected
    ['http://localhost:8008/livecheck?query=so&sneaky', 'http://localhost:8008/healthcheck?query=so&sneaky',
     'http://localhost:8008/livecheck/soSneaky', 'http://localhost:8008/healthcheck/soSneaky'].forEach(function(url) {
      it ("should reject unauthenticated GETs to " + url, function(done) {
        request_sender.sendRequest('GET', url, null, 400, done);
      });
    });
  });
  
  // This is a set of tests for missing OAuth components, incorrectly specified OAuth parameters, etc.  These are
  // health tests for our OAuth validations: any spurious 200s returned here represent weaknesses in Auspice's security.
  describe('Weedy OAuth validations', function() {
    
    // Run these tests for each verb.  While verb handling inside of Auspice is consistent and these results should
    // always be the same, that may not always be the case.  This is a hedge against future stupidity.
    ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {

      // Validate that an invalid signature method results in a 400 error.
      it ("should reject " + verb + " requests with invalid signature methods", function(done) {
        request_sender.oauth_headers[2][1] = 'HMAC-SHA256';
        request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
      });
    
      // Validate that a missing oauth component results in a 400 error.
      it ("should reject " + verb + " requests without a consumer key", function(done) {
        request_sender.oauth_headers.splice(0, 1);
        request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
      });
    
      // Validate that a missing oauth component results in a 400 error.
      it ("should reject " + verb + " requests without a nonce", function(done) {
        request_sender.oauth_headers.splice(1, 1);
        request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
      });
    
      // Validate that a missing oauth component results in a 400 error.
      it ("should reject " + verb + " requests without a signature method", function(done) {
        request_sender.oauth_headers.splice(2, 1);
        request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
      });
    
      // Validate that a missing oauth component results in a 400 error.
      it ("should reject " + verb + " requests without a timestamp", function(done) {
        request_sender.oauth_headers.splice(3, 1);
        request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
      });
    
      // Validate that incorrect Authorization mechanism results in a 400 error.
      it ("should reject " + verb + " requests with non-OAuth Authorization headers", function(done) {
        request_sender.sendAuthenticatedRequest(verb, null, { headers: {'Authorization': 'Basic ABCDEFHG=' } }, 400, done);
      });
    
      // Validate that an unmatched consumer key results in a 401 error.
      it ("should reject " + verb + " requests with unmatched consumer keys", function(done) {
        request_sender.oauth_headers[0][1] = 'not-mocha-test-key';
        request_sender.sendSimpleAuthenticatedRequest(verb, 401, done);
      });
    
      // Validate that an invalid (low) timestamp results in a 401 error.
      it ("should reject " + verb + " requests with timestamps that are too low", function(done) {
        request_sender.oauth_headers[3][1] = 1234;
        request_sender.sendSimpleAuthenticatedRequest(verb, 401, done);
      });
    
      // Validate that an invalid (high) timestamp causes a 401 error.
      it ("should reject " + verb + " request timestamps that are too high", function(done) {
        request_sender.oauth_headers[3][1] = 9999999999999;
        request_sender.sendSimpleAuthenticatedRequest(verb, 401, done);
      });
    
      // Validate that an invalid version causes a 401 error.
      it ("should reject " + verb + " requests with versions that are wrong", function(done) {
        request_sender.oauth_headers[4][1] = '2.0';
        request_sender.sendSimpleAuthenticatedRequest(verb, 400, done);
      });
    });    
  });
});

