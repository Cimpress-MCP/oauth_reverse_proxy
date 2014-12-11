var fs = require('fs');
var should = require('should');
var _ = require('underscore');

var keygen = require('../utils/keygen.js');
var auth_proxy_bootstrap_test = require('./auth_proxy_bootstrap_test.js');

describe('oauth_reverse_proxy key loader', function() {

  it ('should support adding keys dynamically', function(done) {
    keygen.createKey('./test/keys', 8008, 8080, 'dynamic-key', function(err) {
      keygen.createKey('./test/keys', 8008, 8080, 'dynamic-key2', function(err) {
        if (err) done(err);
        var check_key = function() {
          if (auth_proxy_bootstrap_test.proxy.keys['dynamic-key']) {
            // Turn the proxy.keys object into an array to get its length
            auth_proxy_bootstrap_test.proxy.keys.count.should.be.exactly(15);
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
        if (auth_proxy_bootstrap_test.proxy.keys['dynamic-key'] === 'happy-fun-key') {
          // Turn the proxy.keys object into an array to get its length
          auth_proxy_bootstrap_test.proxy.keys.count.should.be.exactly(15);
          auth_proxy_bootstrap_test.proxy.keys['dynamic-key'].should.equal('happy-fun-key');
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
          if (auth_proxy_bootstrap_test.proxy.keys['dynamic-key']) setTimeout(check_key, 50);
          else {
            // Turn the proxy.keys object into an array to get its length
            auth_proxy_bootstrap_test.proxy.keys.count.should.be.exactly(13);
            done();
          }
        };

        check_key();
      });
    });
  });
});
