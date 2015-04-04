var fs = require('fs');
var should = require('should');
var _ = require('underscore');

var keygen = require('../utils/keygen.js');
var bootstrap_test = require('./bootstrap_test.js');

describe('dynamic key loader', function() {

  it ('should support adding keys dynamically', function(done) {
    keygen.createKey('./test/keys', 8008, 8080, 'dynamic-key', function(err) {
      keygen.createKey('./test/keys', 8008, 8080, 'dynamic-key2', function(err) {
        if (err) done(err);
        var check_key = function() {
          if (bootstrap_test.proxy.keystore.keys['dynamic-key']) {
            // Turn the proxy.keys object into an array to get its length
            bootstrap_test.proxy.keystore.count.should.be.exactly(16);
            done();
          } else setTimeout(check_key, 50);
        };

        check_key();
      });
    });
  });

  it ('should support updating keys dynamically', function(done) {
    keygen.createKey('./test/keys', 8008, 8080, 'dynamic-key', 'happy-fun-key', function(err) {
      if (err) done(err);
      var check_key = function() {
        if (bootstrap_test.proxy.keystore.keys['dynamic-key'].secret === 'happy-fun-key') {
          // Turn the proxy.keys object into an array to get its length
          bootstrap_test.proxy.keystore.count.should.be.exactly(16);
          done();
        } else setTimeout(check_key, 50);
      };

      check_key();
    });
  });

  it ('should support removing keys dynamically', function(done) {
    fs.unlink('./test/keys/8008/8080/dynamic-key', function(err) {
      fs.unlink('./test/keys/8008/8080/dynamic-key2', function(err) {
        if (err) done(err);
        var check_key = function() {
          if (bootstrap_test.proxy.keystore.keys['dynamic-key']) setTimeout(check_key, 50);
          else {
            // Turn the proxy.keys object into an array to get its length
            bootstrap_test.proxy.keystore.count.should.be.exactly(14);
            done();
          }
        };

        check_key();
      });
    });
  });
});