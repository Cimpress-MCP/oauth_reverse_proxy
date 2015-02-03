var fs = require('fs');
var should = require('should');
var _ = require('underscore');

var auth_proxy_bootstrap_test = require('./auth_proxy_bootstrap_test.js');
var request_sender = require('./utils/request_sender.js');

var copy_file = function(source, target, cb) {
  var rd = fs.createReadStream(source);
  rd.on("error", function(err) {
    done(err);
  });
  var wr = fs.createWriteStream(target);
  wr.on("error", function(err) {
    done(err);
  });
  wr.on("close", function(ex) {
    done();
  });
  rd.pipe(wr);

  var cbCalled = false;
  function done(err) {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
};

describe('oauth_reverse_proxy config loader', function() {

  it ('should support adding proxies dynamically', function(done) {
    copy_file('./test/resources/dynamic_config_service.orig.json', './test/config.d/dynamic_config_service.json', function(err) {
      if (err) return done(err);
      var check_config = function() {
        if (auth_proxy_bootstrap_test.proxies['dynamic_config_service.json']) {
          request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8010/job/12345', null, 200, done);
        } else setTimeout(check_config, 50);
      };
      check_config();
    });
  });

  it ('should support updating proxies dynamically', function(done) {
    copy_file('./test/resources/dynamic_config_service.next.json', './test/config.d/dynamic_config_service.json', function(err) {
      if (err) return done(err);
      var check_config = function() {
        if (auth_proxy_bootstrap_test.proxies['dynamic_config_service.json'].config.from_port == 8011) {
          request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8011/job/12345', null, 200, done);
        } else setTimeout(check_config, 50);
      };
      check_config();
    });
  });
/**
  it ('should support removing keys dynamically', function(done) {
    fs.unlink('./test/keys/8008/8080/dynamic-key', function(err) {
      fs.unlink('./test/keys/8008/8080/dynamic-key2', function(err) {
        if (err) done(err);
        var check_key = function() {
          if (auth_proxy_bootstrap_test.proxy.keystore.keys['dynamic-key']) setTimeout(check_key, 50);
          else {
            // Turn the proxy.keys object into an array to get its length
            auth_proxy_bootstrap_test.proxy.keystore.count.should.be.exactly(14);
            done();
          }
        };

        check_key();
      });
    });
  });
**/
});
