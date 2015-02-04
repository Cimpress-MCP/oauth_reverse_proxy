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
      copy_file('./test/resources/dynamic_whitelist_config_service.orig.json', './test/config.d/dynamic_whitelist_config_service.json', function(err) {
        if (err) return done(err);
        var check_config = function() {
          if (auth_proxy_bootstrap_test.proxies['dynamic_config_service.json']) {
            request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8010/job/12345', null, 200, function(err) {
              if (err) return done(err);

              request_sender.sendRequest('GET', 'http://localhost:8012/superlivecheck', null, 404, done);
            });
          } else setTimeout(check_config, 50);
        };
        check_config();
      });
    });
  });

  it ('should support updating proxies dynamically', function(done) {
    copy_file('./test/resources/dynamic_config_service.next.json', './test/config.d/dynamic_config_service.json', function(err) {
      if (err) return done(err);
      copy_file('./test/resources/dynamic_whitelist_config_service.next.json', './test/config.d/dynamic_whitelist_config_service.json', function(err) {
        if (err) return done(err);
        var check_config = function() {
          // We poll until the config for dynamic_config_service.json has been updated to listen on port 8011 instead of 8010.  This tells us that
          // the proxy manager has reloaded config.
          if (auth_proxy_bootstrap_test.proxies['dynamic_config_service.json'].config.from_port == 8011) {
            request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8011/job/12345', null, 200, function(err) {
              if (err) return done(err);
              request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8010/job/12345', null, 500, function(err) {
                err.message.should.equal('connect ECONNREFUSED');

                // Validate that dynamic_whitelist_config_service has been updated to reflect the whitelist in dynamic_whitelist_config_service.next.json.
                // /superlivecheck should no longer be whitelisted, but /superduperlivecheck will be.
                request_sender.sendRequest('GET', 'http://localhost:8012/superlivecheck', null, 400, function(err) {
                  if (err) return done(err);
                  request_sender.sendRequest('GET', 'http://localhost:8012/superduperlivecheck', null, 404, done);
                });
              });
            });
          } else setTimeout(check_config, 50);
        };
        check_config();
      });
    });
  });

  it ('should support removing proxies dynamically', function(done) {
    fs.unlink('./test/config.d/dynamic_config_service.json', function(err) {
      if (err) done(err);
      var check_config = function() {
        if (auth_proxy_bootstrap_test.proxies['dynamic_config_service.json'] === undefined) {
          request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8011/job/12345', null, 500, function(err) {
            err.message.should.equal('connect ECONNREFUSED');
            done();
          });
        } else setTimeout(check_config, 50);
      };

      check_config();
    });
  });
});
