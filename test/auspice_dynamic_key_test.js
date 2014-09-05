var fs = require('fs');
var should = require('should');
var _ = require('underscore');

var keygen = require('../utils/keygen.js');
var auspice_bootstrap_test = require('./auspice_bootstrap_test.js');

describe('Auspice Key Loader', function() {
  it ('should support adding keys dynamically', function(done) {
    keygen.createKey('./test/keys', 8008, 8080, 'dynamic-key', function(err) {
      if (err) done(err);
      var check_key = function() {
        if (auspice_bootstrap_test.proxy.keys['dynamic-key']) {
          // Turn the proxy.keys object into an array to get its length
          _.keys(auspice_bootstrap_test.proxy.keys).length.should.be.exactly(13);
          done();
        } else setTimeout(check_key, 50);
      };

      check_key();
    });
  });

  it ('should support updating keys dynamically', function(done) {
    keygen.createKey('./test/keys', 8008, 8080, 'dynamic-key', 'happy-fun-key', function(err) {
      if (err) done(err);
      var check_key = function() {
        if (auspice_bootstrap_test.proxy.keys['dynamic-key'] === 'happy-fun-key') {
          // Turn the proxy.keys object into an array to get its length
          _.keys(auspice_bootstrap_test.proxy.keys).length.should.be.exactly(13);
          auspice_bootstrap_test.proxy.keys['dynamic-key'].should.equal('happy-fun-key');
          done();
        } else setTimeout(check_key, 50);
      };

      check_key();
    });
  });

  it ('should support removing keys dynamically', function(done) {
    fs.unlink('./test/keys/8008/8080/dynamic-key', function(err) {
      if (err) done(err);
      var check_key = function() {
        if (auspice_bootstrap_test.proxy.keys['dynamic-key']) setTimeout(check_key, 50);
        else {
          // Turn the proxy.keys object into an array to get its length
          _.keys(auspice_bootstrap_test.proxy.keys).length.should.be.exactly(12);
          done();
        }
      };

      check_key();
    });
  });
});
