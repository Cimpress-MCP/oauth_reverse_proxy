var fs = require('fs');
var should = require('should');
var _ = require('underscore');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

var oauth_reverse_proxy = require('../lib');
var Proxy = require('../lib/proxy');

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

// Attempt to initiate oauth_reverse_proxy with various forms of broken config.
describe('oauth_reverse_proxy config validation', function() {

  // Before attempting to start oauth_reverse_proxy, clean the malformed directories we need for test purposes.
  beforeEach(slate_cleaner);

  // After we're done with all these tests and we've butchered our keys directory to a fair-thee-well,
  // kill it with fire.
  after(slate_cleaner);

  it ('should reject an attempt to init oauth_reverse_proxy with an unset config_dir parameter', function(done) {
    oauth_reverse_proxy.init(null, function(err, proxy) {
      err.should.equal('Failed to open directory ' + null);
      done();
    });
  });

  it ('should reject an attempt to init oauth_reverse_proxy with a config_dir referencing a nonexistent directory', function(done) {
    oauth_reverse_proxy.init('./test/keys', function(err, proxy) {
      err.should.equal('Failed to open directory ./test/keys');
      done();
    });
  });

  it ('should reject an attempt to init oauth_reverse_proxy with a config_dir referencing a non-directory inode', function(done) {
    oauth_reverse_proxy.init('./test/auth_proxy_abnormal_config.js', function(err, proxy) {
      err.should.equal('oauth_reverse_proxy config dir is not a directory');
      done();
    });
  });
});

// Attempt to initiate a proxy with various forms of broken key directories.
describe('Proxy config validation', function() {

  // Before attempting to start oauth-reverse_proxy, clean the malformed directories we need for test purposes.
  beforeEach(slate_cleaner);

  // After we're done with all these tests and we've butchered our keys directory to a fair-thee-well,
  // kill it with fire.
  after(slate_cleaner);

  // TODO: Add tests for all other properties of ProxyConfig
  // TODO: Validate that a proxy is not created when ProxyConfig is not valid

  it ('should reject an attempt to init a proxy with an unreadable to_port directory', function(done) {
    mkdirp('./test/keys/8008/', function() {
      fs.writeFile('./test/keys/8008/8080', 'Das ist nicht ein Directory', function(err) {
        var proxy = new Proxy({'from_port': 8008, 'to_port': 8080, 'oauth_secret_dir': './test/keys/8008/8080'});
        proxy.start(function(err) {
          err.should.startWith('Failed to read key directory ');
          done();
        });
      });
    });
  });
});
