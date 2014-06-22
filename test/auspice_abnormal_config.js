var should = require('should');
var _ = require('underscore');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

var auspice = require('../lib');

// Attempt to initiate Auspice with various forms of broken config.
describe('Auspice Config Validation', function() {
  
  // Before attempting to start Auspice, create the malformed directories we need for test purposes.
  before(function(done) {
    // Clear out any keys dir so that our tests have a clean slate.
    rimraf('./test/keys', function(err) {
      if (err) return should.fail(err);
      done(); 
    });
  });
  
  it ('should reject an attempt to init a proxy with an unset keystore_dir parameter', function(done) {
    auspice.init(null, function(err, proxy) {
      err.should.equal('Failed to open directory ' + null);
      done();
    });
  });
  
  it ('should reject an attempt to init a proxy with a keystore_dir referencing a nonexistent directory', function(done) {
    auspice.init('./test/keys', function(err, proxy) {
      err.should.equal('Failed to open directory ./test/keys');
      done();
    });
  });
  
  it ('should reject an attempt to init a proxy with a keystore_dir referencing a non-directory inode', function(done) {
    auspice.init('./test/auspice_abnormal_config.js', function(err, proxy) {
      err.should.equal('Failed to open directory ./test/auspice_abnormal_config.js');
      done();
    });
  });
  
  it ('should reject an attempt to init a proxy with a missing from_port directory', function(done) {
    mkdirp('./test/keys', function() {
      auspice.init('./test/keys', function(err, proxy) {
        err.should.startWith('Unable to load from_port path');
        done();
      });
    });
  });
  
  it ('should reject an attempt to init a proxy with a missing to_port directory', function(done) {
    mkdirp('./test/keys/8008/', function() {
      auspice.init('./test/keys', function(err, proxy) {
        err.should.equal('No proxy created.  Auspice startup aborted.');
        done();
      });
    });
  });
  
  it ('should reject an attempt to init a proxy with a malformed to_port directory', function(done) {
    mkdirp('./test/keys/8008/aabb', function() {
      auspice.init('./test/keys', function(err, proxy) {
        err.should.equal('No proxy created.  Auspice startup aborted.');
        done();
      });
    });
  });
});
