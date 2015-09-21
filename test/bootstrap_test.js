var should = require('should');
var _ = require('underscore');
var fs = require('fs');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var crypto = require('crypto');
var path = require('path');

var oauth_reverse_proxy = require('../lib');
var keygen = require('../utils/keygen.js');
var request_sender = require('./utils/request_sender.js');

var job_server = require('./job_server/');

// Run the abnormal config test before initializing the rest of the test suite.
require('./abnormal_config_test.js');

// These cleanup operations need to run before each test to make sure the state of the
// suite is consistent.  Placed here, they will be run before all suites and tests.
beforeEach(function() {
  // Reset the internal state of the request_sender so each unit test gets a tabula rasa.
  request_sender.reset();

  // Make sure there are no pending event listeners before each test.
  if (job_server) job_server.removeAllListeners();
});

// Create an oauth_reverse_proxy, and validate that it works properly even if there is no server
// running behind it.  Once this is done, start a server.  After the completion of this
// test, the preconditions for all other test cases are in place.  Thus, every test case
// must require auth_bootstrap_test.
describe('bootstrapping', function() {

  // Before starting our oauth_reverse_proxy, create the keys we need for test clients.
  before(function(done) {
    rimraf('./test/config.d/dynamic_config_service.json', function(err) {
      rimraf('./test/config.d/dynamic_whitelist_config_service.json', function(err) {
        rimraf('./test/keys/8008/8080', function(err) {
          mkdirp('./test/keys/8008/8080', function(err) {
            keygen.createKey('./test/keys', 8008, 8080, 'bash-test-key', function(err) {
              keygen.createKey('./test/keys', 8008, 8080, 'dotnet-test-key', function(err) {
                keygen.createKey('./test/keys', 8008, 8080, 'restsharp-test-key', function(err) {
                  keygen.createKey('./test/keys', 8008, 8080, 'java-test-key', function(err) {
                    keygen.createKey('./test/keys', 8008, 8080, 'node-test-key', function(err) {
                      keygen.createKey('./test/keys', 8008, 8080, 'perl-test-key', function(err) {
                        keygen.createKey('./test/keys', 8008, 8080, 'powershell-test-key', function(err) {
                          keygen.createKey('./test/keys', 8008, 8080, 'python-test-key', function(err) {
                            keygen.createKey('./test/keys', 8008, 8080, 'ruby-test-key', function(err) {
                              keygen.createKey('./test/keys', 8008, 8080, 'golang-test-key', function(err) {
                                keygen.createKey('./test/keys', 8008, 8080, 'mocha-test-key', function(err) {
                                  keygen.createKey('./test/keys', 8008, 8080, 'quota-test-key', function(err) {
                                    keygen.createKey('./test/keys', 8008, 8080, 'allowedsymbols-test-key', 'abc.def-ghi_jkl=', function(err) {
                                      keygen.createKey('./test/keys', 8008, 8080, 'base64-test-key', 'helloworld========', function(err) {
                                        // Keys that are expected to be rejected
                                        keygen.createKey('./test/keys', 8008, 8080, 'escapechars-test-key', ';!@#$%^', function(err) {
                                          keygen.createKey('./test/keys', 8008, 8080, 'bytes-test-key', crypto.randomBytes(256), function(err) {
                                            // This is the secret we'll use for signing ad hoc requests for test cases.
                                            request_sender.keys['mocha-test-key'] = fs.readFileSync('./test/keys/8008/8080/mocha-test-key') + '&';
                                            // This is the secret we'll use for testing higher quotas.  This key is allowed to make 5 requests
                                            // per second to the proxy defined in quota_service.json.
                                            request_sender.keys['quota-test-key'] = fs.readFileSync('./test/keys/8008/8080/quota-test-key') + '&';
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
  });

  // Test that the proxy starts and loads all the keys created in the before function.
  it ('should start cleanly', function(done) {
    oauth_reverse_proxy.init('./test/config.d', function(err, proxies) {
      if (err) done('oauth_reverse_proxy startup failed: ' + err);
      exports.proxies = require('../lib/proxy_manager.js').proxies;
      exports.proxy = exports.proxies['jobs_service.json'];

      if (typeof exports.proxy === 'string') {
        should.fail(exports.proxy);
      }

      // Turn the proxy.keys object into an array to get its length
      exports.proxy.keystore.count.should.be.exactly(14);
      done();
    });
  });

  // Validate that none of the config files with valid filenames but invalid contents were loaded.
  [
    'unnamed_service.json',
    'no_from_port_service.json', 'no_to_port_service.json',
    'equal_ports_service.json', 'to_port_on_client_proxy_service.json',
    'nonnumeric_from_port_service.json', 'nonnumeric_to_port_service.json',
    'negative_from_port_service.json', 'negative_to_port_service.json',
    'giant_from_port_service.json', 'giant_to_port_service.json',
    'nonnumeric_quota_default_threshold_service.json', 'nonnumeric_quota_interval_service.json',
    'nonnumeric_quota_key_threshold_service.json', 'nonpositive_quota_default_threshold_service.json',
    'nonpositive_quota_key_threshold_service.json', 'subsecond_quota_interval_service.json',
    'no_ssl_cert_service.json', 'no_ssl_key_service.json',
    'invalid_ssl_cert_service.json', 'invalid_ssl_key_service.json'
  ].forEach(function(invalid_config_file) {
    it ('should reject invalid proxy config file ' + invalid_config_file, function() {
      var msg = exports.proxies[invalid_config_file];
      (typeof msg).should.equal('string');
    });
  });

  it ('should gracefully handle /livecheck requests to offline hosts', function(done) {
    request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8008/livecheck', null, 500, done);
  });

  it ('should gracefully handle proxy requests targeted at offline hosts', function(done) {
    request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8282/?oauth_proxy_consumer_key=mocha-test-key&oauth_proxy_url=' +
        encodeURIComponent('http://localhost:50505/job/12345'), null, 500, done);
  });

  it ("should gracefully handle authenticated GET requests to offline hosts", function(done) {
    request_sender.sendSimpleAuthenticatedRequest('GET', 500, done);
  });

  after(function(done) {
    // Once all the integrity tests (which require an offline job server to be effective) are complete,
    // start the job_server;
    job_server.init(8080, function(err) {
      done(err);
    });
  });

});
