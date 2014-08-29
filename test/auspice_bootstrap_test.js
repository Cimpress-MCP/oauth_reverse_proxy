var should = require('should');
var _ = require('underscore');
var fs = require('fs');
var mkdirp = require('mkdirp');

var auspice = require('../lib');
var keygen = require('../utils/keygen.js');
var request_sender = require('./utils/request_sender.js');

var test_server = require('./server/test_server.js');
var job_server = test_server.JobServer;

// These cleanup operations need to run before each test to make sure the state of the
// suite is consistent.  Placed here, they will be run before all suites and tests.
beforeEach(function() {  
  // Reset the internal state of the request_sender so each unit test gets a tabula rasa.
  request_sender.reset();
  
  // Make sure there are no pending event listeners before each test.
  if (job_server) job_server.removeAllListeners();
});

// Create an Auspice proxy, and validate that it works properly even if there is no server
// running behind it.  Once this is done, start a server.  After the completion of this
// test, the preconditions for all other test cases are in place.  Thus, every test case
// must require auspice_bootstrap_test.
describe('Auspice Bootstrap', function() {
  
  // Before starting Auspice, create the keys we need for test clients.
  before(function(done) {
    mkdirp('./test/keys/8008/8080', function(err) {
      keygen.createKey('./test/keys', 8008, 8080, 'bash-test-key', function(err) {
        keygen.createKey('./test/keys', 8008, 8080, 'dotnet-test-key', function(err) {
          keygen.createKey('./test/keys', 8008, 8080, 'java-test-key', function(err) {
            keygen.createKey('./test/keys', 8008, 8080, 'node-test-key', function(err) {
              keygen.createKey('./test/keys', 8008, 8080, 'perl-test-key', function(err) {
                keygen.createKey('./test/keys', 8008, 8080, 'powershell-test-key', function(err) {
                  keygen.createKey('./test/keys', 8008, 8080, 'python-test-key', function(err) {
                    keygen.createKey('./test/keys', 8008, 8080, 'ruby-test-key', function(err) {
                      keygen.createKey('./test/keys', 8008, 8080, 'golang-test-key', function(err) {
                        keygen.createKey('./test/keys', 8008, 8080, 'mocha-test-key', function(err) {
                          keygen.createKey('./test/keys', 8008, 8080, 'escapechars-test-key', ';!@#$%^', function(err) {
                            request_sender.mocha_secret = fs.readFileSync('./test/keys/8008/8080/mocha-test-key') + '&';
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
  
  // Test that the proxy starts and loads all the keys created in the before function.
  it ('should start cleanly', function(done) {
    auspice.init('./test/keys', function(err, proxy) {
      if (err) return should.fail('Auspice startup failed: ' + err);
      
      // Turn the proxy.keys object into an array to get its length
      (_.keys(proxy.keys).length).should.be.exactly(10);
      done();
    });
  });
  
  it ('should gracefully handle /livecheck requests to offline hosts', function(done) {
    request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8008/livecheck', null, 500, done);
  });

  it ("should gracefully handle authenticated GET requests to offline hosts", function(done) {
    request_sender.sendSimpleAuthenticatedRequest('GET', 500, done);
  });
  
  after(function(done) {
    // Once all the integrity tests, which require an offline job server to be effective, are complete,
    // start the job_server;
    test_server.init(8080, function(err) {
      done(err);
    });
  });

});
