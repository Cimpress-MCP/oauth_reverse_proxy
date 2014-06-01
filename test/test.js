var should = require('should');

var _ = require('underscore');
var crypto = require('crypto');
var fs = require('fs');
var os = require('os');
var request = require('request');
var util = require('util');

var job_server;
var keygen = require('../utils/keygen.js');

var http = require('http');
var exec = require('child_process').exec;

// Cache console.[log,error] in case we want to mute it for any given test (sometimes Express or
// other components log expected errors, and we don't want to see them in our test results)
var console_log = console.log;
var console_error = console.error;

// This is the secret we'll use for signing ad hoc requests for test cases.
var mocha_secret;

// Variables used for signing requests with OAuth
var oauth_headers;
var params;
var signature_components;

// OAuth header params have the form oauth_version: '1.0'
var oauth_header_renderer = function(key, value) {
  return key + '="' + encodeData(value) + '"';
};

// Params for signing have the form oauth_version=1.0
var param_renderer = function(key, value) {
  return key + '=' + value;
};

// Construct a signature, add it to the OAuth header group, and return the OAuth header string  
var prepare_auth_header = function() {
  signature_components[2] = encodeData(renderParams(params, '&', param_renderer));
  var signature_base = signature_components.join('&');
  oauth_headers.push(['oauth_signature', signString(mocha_secret, signature_base)]);
  return 'OAuth ' + renderParams(oauth_headers, ', ', oauth_header_renderer);
};

// Convenience function for sending a request through auspice and expecting a certain response code.
var send_authenticated_request = function(expectedStatusCode, done) {
  request('http://localhost:8008/job', { headers: {'Authorization': prepare_auth_header()} },
    create_response_validator(expectedStatusCode, done)
  );
};

  // These cleanup operations need to run before each test to make sure the state of the
  // suite is consistent.  Placed here, they will be run before all suites and tests.
beforeEach(function() {
  
  // Make sure there are no pending event listeners before each test.
  if (job_server) job_server.removeAllListeners();
  
  // Always reset console.log and console.error
  console.log = console_log;
  console.error = console_error;
  
  var nonce = createNonce();
  var timestamp = new Date().getTime();
  
  // Rest the signature components we use to working defaults.
  signature_components = [
    'GET',
    encodeData('http://localhost:8008/job'),
    'param_placeholder'
  ];
  
  // Fill a valid set of oauth headers that we can monkey with as needed for our test cases.
  oauth_headers = [
    [ 'oauth_consumer_key', 'mocha-test-key' ],
    [ 'oauth_nonce', nonce ],
    [ 'oauth_signature_method', 'HMAC-SHA1'],
    [ 'oauth_timestamp', timestamp],
    [ 'oauth_version', '1.0' ]
  ];
  
  // Since there may be params that aren't headers, clone params here.
  params = _.clone(oauth_headers);
});

// Creates a convenience function for validating that an http response has the correct status code
// and did not result in a protocol-level error (connection failure, etc).
var create_response_validator = function(expectedStatusCode, additionalValidation, done) {
  return function(err, response, body) {
  
    if (!done) {
      done = additionalValidation;
      additionalValidation = undefined;
    }
  
    // Always reset console.log and console.error in case they've been muted for the test.
    console.log = console_log;
    console.error = console_error;
  
    if (err) return done(err);
    response.statusCode.should.equal(expectedStatusCode);
    // Validate that all responses have a connection header of keep-alive.  For performance reasons,
    // Auspice should never be disabling keep-alives.
    response.headers.connection.should.equal('keep-alive');
    if (expectedStatusCode === 200) body.should.equal('{"status":"ok"}');
  
    // If an additional validation function was provided, run it now on the received response and body.
    if (additionalValidation) additionalValidation(response, body, done);
    done();
  };
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
                      mocha_secret = fs.readFileSync(__dirname + '/keys/8008/8080/mocha-test-key') + '&';
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
    request('http://localhost:8008/livecheck', function(err, res, body) {
      if (err) return done(err);
      
      res.statusCode.should.equal(500);
      done();
    });
  });
  
  it ('should gracefully handle authenticated requests to offline hosts', function(done) {
    request('http://localhost:8008/job', { headers: {'Authorization': prepare_auth_header()} }, function(err, res, body) {
      if (err) return done(err);
      
      res.statusCode.should.equal(500);
      done();
    });
  });
});

// Test the job server in isolation to make sure responses are handled as expected without Auspice involved.
describe('Job Server', function() {
  
  before(function(done) {
   job_server = require('./server/job_server.js');
   job_server.on('started', function() {
     done();
   });
  });
  
  describe('Unauthenticated GET /job from localhost', function() {
    it ('should return a valid response', function(done) {      
      request('http://localhost:8080/job', create_response_validator(200, done));
    });
  });
  
  describe('Unauthenticated POST /job from localhost', function() {
    it ('should return a valid response', function(done) {
      var content = 'data=happy';
      request.post('http://localhost:8080/job', {form:{data:'happy'}}, create_response_validator(200, done));
    });
  });
  
  describe('Unauthenticated PUT /job from localhost', function() {
    it ('should return a valid response', function(done) {
      var content = 'data=happy';
      request.put('http://localhost:8080/job', {form:{data:'happy'}}, create_response_validator(200, done));
    });
  });
  
  describe('Unauthenticated DELETE /job from localhost', function() {
    it ('should return a valid response', function(done) {
      request.del('http://localhost:8080/job/12345', create_response_validator(200, done));
    });
  });
});

// Create random nonce string
function createNonce() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 10; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

// Encode signable strings
function encodeData(toEncode) {
  if( toEncode == null || toEncode === "" ) return "";
  else {
    var result= encodeURIComponent(toEncode);
    // Fix the mismatch between RFC3986's and Javascript's beliefs in what is right and wrong.
    return result.replace(/\!/g, "%21").replace(/\'/g, "%27").replace(/\(/g, "%28")
                 .replace(/\)/g, "%29").replace(/\*/g, "%2A");
  }
}

// Sign the provided string.  This is used for ad hoc tests run from within the suite.
function signString(key, str) {
  return crypto.createHmac("sha1", key).update(str).digest("base64");
}

// Given an array of parameters of type [ [key, value], [key2, value2] ], return a rendered string separated
// by character sep and where the key and value are transformed by renderFn before being joined.
function renderParams(params, sep, renderFn) {
  var out_params = [];
  params = _.flatten(params);
  for (var i=0; i<params.length; i+=2) {
    out_params[i/2] = renderFn(params[i], params[i+1]);
  }
  return out_params.join(sep);
}

// Auspice is an authenticating proxy.  Let's describe it.
describe('Auspice', function() {
  
  // Describe the Auspice proxy.  This suite represents test cases of failing and successful
  // authentication through the proxy.
  describe('Authenticating proxy functionality', function() {
    
    // Validate that a basic GET request works.
    it ('should accept a properly signed basic GET request', function(done) {      
      send_authenticated_request(200, done);
    });
    
    // Validate that a GET with query parameters works.
    it ('should accept a properly signed GET with query', function(done) {
      params.push(['query', 'ok']);
      request('http://localhost:8008/job?query=ok', { headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(200, done)
      );
    });
    
    // Validate that a GET with unsigned query parameters fails due to signature mismatch.
    it ('should reject an improperly signed GET where query params are not part of the signature', function(done) {
      request('http://localhost:8008/job?query=should_fail', { headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(401, done)
      );
    });
    
    // Validate that a GET with query string longer than 16kb fails due to signature mismatch.
    it ('should reject a GET with a query greater than 16kb', function(done) {
      
      //var crazy_large_buffer = new Buffer(1025*1024);
      var crazy_large_buffer = new Buffer(1024*16);
      //var crazy_large_buffer = new Buffer(10);
      for (var i=0; i<crazy_large_buffer.length; ++i) {
        crazy_large_buffer[i] = 'A'.charCodeAt();
      }
      var crazy_large_str = crazy_large_buffer.toString();
      var crazy_large_url = 'http://localhost:8008/job?query_huge_query=' + crazy_large_str;
      params.push(['query_huge_query', crazy_large_str]);
      
      request(crazy_large_url, { headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(413, done)
      );
    });
    
    // Validate that a basic, empty POST works.
    it ('should accept a properly signed POST with no params', function(done) {
      signature_components[0] = 'POST';
      request.post('http://localhost:8008/job', { headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(200, done)
      );
    });
    
    // Validate that a basic POST works.
    it ('should accept a properly signed POST with params', function(done) {
      signature_components[0] = 'POST';
      params.push(['post', 'ok']);
      
      job_server.once('POST', function(uri, req, res) {
        req.headers.should.have.property('vp_user_key', 'mocha-test-key');
        req.method.should.equal('POST');
        _.isEqual(req.body, {'post':'ok'}).should.equal(true);
      });
      
      request.post('http://localhost:8008/job', { form: {'post': 'ok'}, headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(200, done)
      );
    });
    
    // Validate that a POST with unsigned body parameters fails due to signature mismatch.
    it ('should reject an improperly signed POST where params are not part of the signature', function(done) {
      request.post('http://localhost:8008/job', { form: {'post': 'ok'}, headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(401, done)
      );
    });
    
    // Validate that a POST with body greater than 1mb fails due to signature mismatch.
    it ('should reject a formencoded POST with a body greater than 1mb', function(done) {
      
      var crazy_large_buffer = new Buffer(1025*1024);
      var crazy_huge_form = { 'post': crazy_large_buffer.toString() };
      
      // Mute console.log message from Express about entity size.  We know this.  It's what we're testing.
      console.log = function() {}
      console.error = function() {}
      
      request.post('http://localhost:8008/job', { form: crazy_huge_form, headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(413, done)
      );
    });
    
    // Validate that a basic PUT works.
    it ('should accept a properly signed PUT with params', function(done) {
      signature_components[0] = 'PUT';
      params.push(['put', 'ok']);

      job_server.once('PUT', function(uri, req, res) {
        req.headers.should.have.property('vp_user_key', 'mocha-test-key');
        req.method.should.equal('PUT');
        _.isEqual(req.body, {'put':'ok'}).should.equal(true);
      });
      
      request.put('http://localhost:8008/job', { form: {'put': 'ok'}, headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(200, done)
      );
    });
    
    // Validate that a PUT with unsigned body parameters fails due to signature mismatch.
    it ('should reject an improperly signed PUT where params are not part of the signature', function(done) {
      request.put('http://localhost:8008/job', { form: {'put': 'ok'}, headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(401, done)
      );
    });

    // Validate that a PUT with body greater than 1mb fails due to signature mismatch.
    it ('should reject a formencoded PUT with a body greater than 1mb', function(done) {
      
      var crazy_large_buffer = new Buffer(1025*1024);
      var crazy_huge_form = { 'post': crazy_large_buffer.toString() };
      
      // Mute console.log message from Express about entity size.  We know this.  It's what we're testing.
      console.log = function() {}
      console.error = function() {}
      
      request.put('http://localhost:8008/job', { form: crazy_huge_form, headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(413, done)
      );
    });
    
    // Validate that a basic DELETE works.
    it ('should accept a properly signed DELETE', function(done) {
      signature_components[0] = 'DELETE';
      signature_components[1] = encodeData('http://localhost:8008/job/12345');
      request.del('http://localhost:8008/job/12345', { headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(200, done)
      );
    });
    
    // Validate that a DELETE with unsigned body parameters fails due to signature mismatch.
    it ('should reject an improperly signed DELETE where signature is incorrect', function(done) {
      request.del('http://localhost:8008/job', { headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(401, done)
      );
    });
  });
  
  describe('Message integrity protection', function() {
    
    beforeEach(function() {
      // Mute console.log messages from job server.  It gets chatty when you proxy more than a single
      // request per test, as we do in each test in this suite.
      console.log = function() {}
    });
    
    /**
     * This creates a function that will run a request both with and without authentication
     * and validate that the only deviations in the request headers are deviations we expect.
     * This function takes as its parameter the method type we want to test, and returns a
     * function that describes a Mocha testcase.
     */
    var create_request_header_validator = function(method) {
      return function(done) {
        var my_done = function(err) {
          // If the response validator returned an error, don't bother with the header comparison.
          if (err) return done(err);
          if (results.authorized && results.vanilla) {
            // Compare the two sets of request headers
            var keys_to_ignore = ['authorization', 'host', 'vp_user_key'];
          
            // Deep compare the objects after omitting the set of keys known a priori to differ when
            // the proxy is used.
            (_.isEqual(
              _.omit(results.authorized, keys_to_ignore),
              _.omit(results.vanilla, keys_to_ignore))
            ).should.equal(true);
          
            results.vanilla['custom'].should.equal('header');
            results.vanilla['more'].should.equal('custom_headers');
          
            done();
          }
        };
      
        var results = {
          'authorized' : undefined,
          'vanilla' : undefined
        };
      
        var headers = {
          'custom': 'header',
          'more': 'custom_headers'
        };

        // Make sure we sign for the appropriate method type
        signature_components[0] = method;

        var vanilla_url = 'http://localhost:8080/job';
        var authorized_url = 'http://localhost:8008/job';

        // Run the appropriate request based on the method desired (get, post, put, del)
        var method_function_name = method.toLowerCase();
        if (method_function_name === 'delete') {
          // Delete requires slightly special handling since we use a different URL scheme
          method_function_name = 'del';
          vanilla_url = 'http://localhost:8080/job/1234';
          authorized_url = 'http://localhost:8008/job/1234';
          signature_components[1] = encodeData(authorized_url);
        }
      
        // Job server event listener to collect the request headers from 
        job_server.on(method, function(uri, req, res) {
          if (!results.authorized) {
            results.authorized = req.headers;
            // Once we've seen the authorized request, make an unauthorized request to gather its headers.
            request[method_function_name](vanilla_url, {headers: headers}, create_response_validator(200, my_done));
          } else {
            results.vanilla = req.headers;
          }
        });
               
        request[method_function_name](authorized_url,
          // For the authorized version of this request, extend our custom headers with the OAuth header.
          { headers: _.extend({'Authorization': prepare_auth_header()}, headers) },
          create_response_validator(200, my_done)
        );
      };
    };
    
    // Run the request header validator once for each verb.
    ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(method) {
      it ('should proxy request headers from a ' + method + ' intact', create_request_header_validator(method));    
    });
    
    /**
     * This creates a function that will run a request both with and without authentication
     * and validate that there are no deviations in the response headers.  This function takes
     * as its parameter the method type we want to test, and returns a function that describes
     * a Mocha testcase.
     */
    var create_response_header_validator = function(method) {
      return function(done) {
        var my_done = function(err) {
          // If the response validator returned an error, don't bother with the header comparison.
          if (err) return done(err);
          if (results.authorized && results.vanilla) {
            // Deep compare the two
            (_.isEqual(results.authorized, results.vanilla)).should.equal(true);
            _.keys(results.authorized).length.should.be.above(4);
            done();
          }
        };
      
        var results = {
          'authorized' : undefined,
          'vanilla' : undefined
        };
      
        var create_custom_validator = function(header_collection) {
          return function(res, body, done) {
            results[header_collection] = res.headers;
          };
        };

        // Make sure we sign for the appropriate method type
        signature_components[0] = method;

        var vanilla_url = 'http://localhost:8080/job';
        var authorized_url = 'http://localhost:8008/job';

        // Run the appropriate request based on the method desired (get, post, put, del)
        var method_function_name = method.toLowerCase();
        if (method_function_name === 'delete') {
          // Delete requires slightly special handling since we use a different URL scheme
          method_function_name = 'del';
          vanilla_url = 'http://localhost:8080/job/1234';
          authorized_url = 'http://localhost:8008/job/1234';
          signature_components[1] = encodeData(authorized_url);
        }
      
        request[method_function_name](authorized_url, { headers: {'Authorization': prepare_auth_header() } },
          create_response_validator(200, create_custom_validator('authorized'), my_done)
        );
      
        request[method_function_name](vanilla_url, create_response_validator(200, create_custom_validator('vanilla'), my_done));
      };
    };

    // Run the response header validator once for each verb.
    ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(method) {
      it ('should proxy response headers from a ' + method + ' intact', create_response_header_validator(method));    
    });
  });
  
  describe('Livecheck exceptions', function() {
    it ('should allow /livecheck URLs through without authentication', function(done) {
      request('http://localhost:8008/livecheck', create_response_validator(200, done));
    });
    
    it ('should allow /healthcheck URLs through without authentication', function(done) {
      request('http://localhost:8008/healthcheck', create_response_validator(200, done));
    });
    
    it ('should allow /livecheck URLs through, regardless of case, without authentication', function(done) {
      request('http://localhost:8008/liveCheck', create_response_validator(200, done));
    });
    
    it ('should allow /healthcheck URLs through, regardless of case, without authentication', function(done) {
      request('http://localhost:8008/healthCheck', create_response_validator(200, done));
    });
    
    it ('should reject /livecheck-like URLs that lack authentication', function(done) {
      request('http://localhost:8008/livecheck?query=so&sneaky', create_response_validator(400, done));
    });
    
    it ('should reject /healthcheck-like URLs that lack authentication', function(done) {
      request('http://localhost:8008/healthcheck?query=so&sneaky', create_response_validator(400, done));
    });
    
    it ('should reject POSTs to /livecheck URLs that lack authentication', function(done) {
      request.post('http://localhost:8008/livecheck', create_response_validator(400, done));
    });
    
    it ('should reject PUTs to /livecheck URLs that lack authentication', function(done) {
      request.put('http://localhost:8008/livecheck', create_response_validator(400, done));
    });
    
    it ('should reject DELETEs to /livecheck URLs that lack authentication', function(done) {
      request.del('http://localhost:8008/livecheck', create_response_validator(400, done));
    });
  });
  
  describe('Weedy OAuth validations', function() {
    
    // Validate that an invalid signature method results in a 400 error.
    it ('should reject requests with invalid signature methods', function(done) {
      oauth_headers[2][1] = 'HMAC-SHA256';
      send_authenticated_request(400, done);
    });
    
    // Validate that a missing oauth component results in a 400 error.
    it ('should reject requests without a consumer key', function(done) {
      oauth_headers.splice(0, 1);
      send_authenticated_request(400, done);
    });
    
    // Validate that a missing oauth component results in a 400 error.
    it ('should reject requests without a nonce', function(done) {
      oauth_headers.splice(1, 1);
      send_authenticated_request(400, done);
    });
    
    // Validate that a missing oauth component results in a 400 error.
    it ('should reject requests without a signature method', function(done) {
      oauth_headers.splice(2, 1);
      send_authenticated_request(400, done);
    });
    
    // Validate that a missing oauth component results in a 400 error.
    it ('should reject requests without a timestamp', function(done) {
      oauth_headers.splice(3, 1);
      send_authenticated_request(400, done);
    });
    
    // Validate that incorrect Authorization mechanism results in a 401 error.
    it ('should reject requests with non-OAuth Authorization headers', function(done) {
      request('http://localhost:8008/job', { headers: {'Authorization': 'Basic ABCDEFHG=' } },
        create_response_validator(400, done)
      );
    });
    
    // Validate that an unmatched consumer key results in a 401 error.
    it ('should reject requests with unmatched consumer keys', function(done) {
      oauth_headers[0][1] = 'not-mocha-test-key';
      send_authenticated_request(401, done);
    });
    
    // Validate that an invalid (low) timestamp results in a 401 error.
    it ('should reject timestamps that are too low', function(done) {
      oauth_headers[3][1] = 1234;
      send_authenticated_request(401, done);
    });
    
    // Validate that an invalid (high) timestamp causes a 401 error.
    it ('should reject timestamps that are too high', function(done) {
      oauth_headers[3][1] = 9999999999999;
      send_authenticated_request(401, done);
    });
    
    // Validate that an invalid version causes a 401 error.
    it ('should reject versions that are wrong', function(done) {
      oauth_headers[4][1] = '2.0';
      send_authenticated_request(400, done);
    });
    
  });
});

// Creates a convenience function for running an external client and validating that the correct
// key is passed to the job server and the correct content is written to disk.
var create_client_test = function(method, cmd, cwd, key) {
  return function(cb) {
    job_server.once(method, function(uri, req, res) {
      req.headers.should.have.property('vp_user_key', key);
    });
  
    exec(cmd, {cwd: cwd}, function(err, stdout, stderr) {
      if (err) return cb(err);
      stderr.should.equal('');
      stdout.trim().should.equal('{"status":"ok"}');
      cb();
    });
  };
};

// These test clients are in the test/clients subdirectory.  Each one tests a limited amount of OAuth
// functionality to validate that requests can be sent through Auspice properly using various languages.
describe('Client tests', function() {
  
  // Only test Bash and Python if we're not on Windows.
  if (os.platform().indexOf('win') !== 0) {
    it ('bash', function(done) {
      var bashTest = create_client_test('GET', 'bash client.sh', 'test/clients/bash', 'bash-test-key')
      bashTest(done);
    });
    
    it ('python', function(done) {
      var pythonTest = create_client_test('GET', 'python client.py', 'test/clients/python', 'python-test-key')
      pythonTest(done);
    });
  }
  
  it ('java', function(done) {
    var javaTest = create_client_test('POST', 
      'java -cp target/AuspiceClient-1.0-SNAPSHOT-jar-with-dependencies.jar com.vistaprint.auspice.Client',
      'test/clients/java/AuspiceClient', 'java-test-key')
    javaTest(done);
  });
  
  it ('node.js', function(done) {
    var nodeTest = create_client_test('POST', 'node client.js', 'test/clients/node', 'node-test-key')
    nodeTest(done);
  });
  
  it ('perl', function(done) {
    var perlTest = create_client_test('GET', 'perl client.pl', 'test/clients/perl', 'perl-test-key')
    perlTest(done);
  });
  
  // Only test .Net if we're on Windows.
  if (os.platform().indexOf('win') === 0) {
    it ('.Net', function(done) {
      var dotNetTest = create_client_test('POST', '.\\AuspiceClient\\AuspiceClient\\bin\\Debug\\AuspiceClient.exe',
        'test/clients/dotnet', 'dotnet-test-key');
      dotNetTest(done);
    });
  }
  
  it ('ruby', function(done) {
    var rubyTest = create_client_test('GET', 'ruby client.rb', 'test/clients/ruby', 'ruby-test-key')
    rubyTest(done);
  });
  
});
