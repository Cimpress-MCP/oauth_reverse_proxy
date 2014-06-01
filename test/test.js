var should = require('should');

var _ = require('underscore');
var crypto = require('crypto');
var fs = require('fs');
var os = require('os');
var request = require('request');
var util = require('util');

var job_server = require('../test/server/job_server.js');
var job_server_started = false;
job_server.on('started', function() {
  job_server_started = true;
});
var keygen = require('../test/keygen/');

var http = require('http');
var exec = require('child_process').exec;

// Creates a convenience function for validating that an http response has the correct status code
// and did not result in a protocol-level error (connection failure, etc).
var create_response_validator = function(expectedStatusCode, done) {
  return function(err, response, body) {
    if (err) return done(err);
    response.statusCode.should.equal(expectedStatusCode);
    if (expectedStatusCode === 200) body.should.equal('{"status":"ok"}');
    done();
  };
};

describe('Jobs Server', function() {
  
  before(function(done) {
    setTimeout(function() {
      if (job_server_started) return done();
    }, 50);
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

function createClientTest(method, cmd, cwd, key) {
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
}

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

/**
 * Given an array of parameters of type [ [key, value], [key2, value2] ], return
 * a rendered string separated by character sep and where the key and value are
 * transformed by renderFn before being joined.
 */
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
  
  // This is the secret we'll use for signing ad hoc requests for test cases.
  var mocha_secret;
  
  // But first, create the keys we need for test clients.
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
  
  var oauth_headers;
  var params;
  var signature_components;
  
  // These cleanup operations need to run before each test to make sure the state of the
  // suite is consistent.
  beforeEach(function() {
    // Make sure there are no pending event listeners before each test.
    job_server.removeAllListeners();
    
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
    request({ uri : 'http://localhost:8008/job', headers: {'Authorization': prepare_auth_header()}},
      create_response_validator(expectedStatusCode, done)
    );
  };
  
  var auspice_started = false;
  // Describe the Auspice proxy.  This suite represents test cases of failing and successful
  // authentication through the proxy.
  describe('Proxy', function() {
    it ('should start cleanly', function(done) {
      var auspice = require(__dirname + '/../lib');
      auspice.init(__dirname + '/keys', function(err, proxy) {
        if (err) return should.fail('Auspice startup failed: ' + err);
        
        // Turn the proxy.keys object into an array to get its length
        (_.keys(proxy.keys).length).should.be.exactly(9);
        auspice_started = true;
        done();    
      });
    });
    
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
    
    // Validate that a basic POST works.
    it ('should accept a properly signed POST with params', function(done) {
      signature_components[0] = 'POST';
      params.push(['post', 'ok']);
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
    
    // Validate that a basic PUT works.
    it ('should accept a properly signed PUT with params', function(done) {
      signature_components[0] = 'PUT';
      params.push(['put', 'ok']);
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
    
    // Validate that a basic DELETE works.
    it ('should accept a properly signed DELETE', function(done) {
      signature_components[0] = 'DELETE';
      signature_components[1] = encodeData('http://localhost:8008/job/12345');
      request.del('http://localhost:8008/job/12345', { headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(200, done)
      );
    });
    
    // Validate that a PUT with unsigned body parameters fails due to signature mismatch.
    it ('should reject an improperly signed DELETE where signature is incorrect', function(done) {
      request.del('http://localhost:8008/job', { headers: {'Authorization': prepare_auth_header() } },
        create_response_validator(401, done)
      );
    });
    
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
    
    //
    // Begin library tests.  These test clients are in the test/clients subdirectory.  Each one tests
    // a limited amount of OAuth functionality to validate that requests can be sent through Auspice
    // properly.
    //
    
    // Only test Bash and Python if we're not on Windows.
    if (os.platform().indexOf('win') === -1) {
      it ('should service requests from a bash client', function(done) {
        var bashTest = createClientTest('GET', 'bash client.sh', 'test/clients/bash', 'bash-test-key')
        bashTest(done);
      });
	  
    
      it ('should service requests from a python client', function(done) {
        var pythonTest = createClientTest('GET', 'python client.py', 'test/clients/python', 'python-test-key')
        pythonTest(done);
      });
    }
    
    it ('should service requests from a java client', function(done) {
      var javaTest = createClientTest('POST', 
        'java -cp target/AuspiceClient-1.0-SNAPSHOT-jar-with-dependencies.jar com.vistaprint.auspice.Client',
        'test/clients/java/AuspiceClient', 'java-test-key')
      javaTest(done);
    });
    
    it ('should service requests from a node client', function(done) {
      var nodeTest = createClientTest('POST', 'node client.js', 'test/clients/node', 'node-test-key')
      nodeTest(done);
    });
    
    it ('should service requests from a perl client', function(done) {
      var perlTest = createClientTest('GET', 'perl client.pl', 'test/clients/perl', 'perl-test-key')
      perlTest(done);
    });
    
    // Only test .Net if we're on Windows.
    if (os.platform().indexOf('win') === 0) {
      it ('should service requests from a .Net client', function(done) {
        var dotNetTest = createClientTest('POST', '.\\AuspiceClient\\AuspiceClient\\bin\\Debug\\AuspiceClient.exe',
          'test/clients/dotnet', 'dotnet-test-key');
        dotNetTest(done);
      });
	  }
    
    it ('should service requests from a ruby client', function(done) {
      var rubyTest = createClientTest('GET', 'ruby client.rb', 'test/clients/ruby', 'ruby-test-key')
      rubyTest(done);
    });
    
    //
    // End library tests. 
    //
    
  });
});
