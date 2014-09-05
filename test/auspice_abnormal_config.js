var fs = require('fs');
var should = require('should');
var _ = require('underscore');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

var auspice = require('../lib');
var proxy_class = require('../lib/proxy.js').AuthenticatingProxy;

// Start every test with an empty keys directory.
var slate_cleaner = function(done) {
  if (fs.existsSync('./test/keys')) {
    rimraf('./test/keys', function(err) {
      if (err) return should.fail(err);
      done();
    });
  } else {
    // If the keys directory didn't exist, we're already done.
    done();
  }
};

// Attempt to initiate Auspice with various forms of broken config.
describe('Auspice config validation', function() {

  // Before attempting to start Auspice, clean the malformed directories we need for test purposes.
  beforeEach(slate_cleaner);

  // After we're done with all these tests and we've butchered our keys directory to a fair-thee-well,
  // kill it with fire.
  after(slate_cleaner);

  it ('should reject an attempt to init Auspice with an unset keystore_dir parameter', function(done) {
    auspice.init(null, function(err, proxy) {
      err.should.equal('Failed to open directory ' + null);
      done();
    });
  });

  it ('should reject an attempt to init Auspice with a keystore_dir referencing a nonexistent directory', function(done) {
    auspice.init('./test/keys', function(err, proxy) {
      err.should.equal('Failed to open directory ./test/keys');
      done();
    });
  });

  it ('should reject an attempt to init Auspice with a keystore_dir referencing a non-directory inode', function(done) {
    auspice.init('./test/auspice_abnormal_config.js', function(err, proxy) {
      err.should.equal('Failed to open directory ./test/auspice_abnormal_config.js');
      done();
    });
  });

  it ('should reject an attempt to init Auspice with a missing from_port directory', function(done) {
    mkdirp('./test/keys', function() {
      auspice.init('./test/keys', function(err, proxy) {
        err.should.startWith('Unable to load from_port path');
        done();
      });
    });
  });

  it ('should reject an attempt to init Auspice with a missing to_port directory', function(done) {
    mkdirp('./test/keys/8008/', function() {
      auspice.init('./test/keys', function(err, proxy) {
        err.should.equal('No proxy created.  Auspice startup aborted.');
        done();
      });
    });
  });

  it ('should reject an attempt to init Auspice with a non-existent to_port directory', function(done) {
    mkdirp('./test/keys/8008/aabb', function() {
      mkdirp('./test/keys/8008/blart', function() {
        auspice.init('./test/keys', function(err, proxy) {
          err.should.equal('No proxy created.  Auspice startup aborted.');
          done();
        });
      });
    });
  });
});

// Attempt to initiate a proxy with various forms of broken key directories.
describe('Proxy config validation', function() {

  // Before attempting to start Auspice, clean the malformed directories we need for test purposes.
  beforeEach(slate_cleaner);

  // After we're done with all these tests and we've butchered our keys directory to a fair-thee-well,
  // kill it with fire.
  after(slate_cleaner);

  it ('should reject an attempt to init a proxy with an unreadable to_port directory', function(done) {
    mkdirp('./test/keys/8008/', function() {
      fs.writeFile('./test/keys/8008/8080', 'Das ist nicht ein Directory', function(err) {
        var proxy = new proxy_class('8008', '8080', './test/keys/8008/8080');
        proxy.start(function(err) {
          err.should.startWith('Failed to read key directory ');
          done();
        });
      });
    });
  });
});
