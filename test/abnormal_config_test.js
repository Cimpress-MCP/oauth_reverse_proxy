var fs = require('fs');
var path = require('path');
var should = require('should');
var _ = require('underscore');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

var oauth_reverse_proxy = require('../lib');
var Proxy = require('../lib/proxy');
var ProxyManager = require('../lib/proxy_manager.js');
var ProxyConfig = require('../lib/proxy/config.js');

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
describe('basic config validation', function() {

  // Before attempting to start oauth_reverse_proxy, clean the malformed directories we need for test purposes.
  beforeEach(slate_cleaner);

  // After we're done with all these tests and we've butchered our keys directory to a fair-thee-well,
  // kill it with fire.
  after(slate_cleaner);

  it ('should reject an attempt to init oauth_reverse_proxy with an unset config_dir parameter', function() {
    (function() { oauth_reverse_proxy.init(null, function() {}) }).
    should.throw('config_directory invalid');
  });

  it ('should reject an attempt to init oauth_reverse_proxy with a config_dir referencing a nonexistent directory', function() {
    var dir = path.resolve('./does-not-exist');
    (function() { oauth_reverse_proxy.init(dir, function() {}) }).
    should.throw(/no such file or directory/);
  });

  it ('should reject an attempt to init oauth_reverse_proxy with a config_dir referencing a non-directory inode', function() {
    (function() { oauth_reverse_proxy.init('./test/abnormal_config_test.js', function() {}) }).
    should.throw("oauth_reverse_proxy config dir is not a directory");
  });

  it ('should not load any config file that has a filename beginning with a dot', function(done) {
    var config_dir = './test/config.d/';
    var config = JSON.parse(fs.readFileSync(path.join(config_dir, '.dotfile.json'), {'encoding': 'utf8'}));
    var pm = ProxyManager;
    pm.init('./test/config.d', function() {
      pm.proxies.should.not.containDeep(config.service_name);
      done();
    });
  });

  it ('should not load any config file that has a filename not ending in \'json\'', function(done) {
    var config_dir = './test/config.d/';
    var config = JSON.parse(fs.readFileSync(path.join(config_dir, 'invalid_file_extension.md'), {'encoding': 'utf8'}));
    var pm = ProxyManager;
    pm.init('./test/config.d', function() {
      pm.proxies.should.not.containDeep(config.service_name);
      done();
    });
  });
});

// Attempt to initiate a proxy with various forms of broken key directories.
describe('detailed config validation', function() {

  // Before attempting to start oauth-reverse_proxy, clean the malformed directories we need for test purposes.
  beforeEach(slate_cleaner);

  // After we're done with all these tests and we've butchered our keys directory to a fair-thee-well,
  // kill it with fire.
  after(slate_cleaner);

  it ('should reject an attempt to init a proxy with an unreadable to_port directory', function(done) {
    mkdirp('./test/keys/8008/', function() {
      fs.writeFile('./test/keys/8008/8080', 'Das ist nicht ein Directory', function(err) {
        var proxy = new Proxy(new ProxyConfig({'from_port': 8008, 'to_port': 8080, 'oauth_secret_dir': './test/keys/8008/8080'}));
        proxy.start(function(err) {
          err.should.startWith('Failed to read key directory ');
          done();
        });
      });
    });
  });

  // Validate all forms of proxy config error.
  [
    { 'filename': 'unnamed_service.json', 'expected_error': 'proxy configuration lacks service_name'},
    { 'filename': 'no_from_port_service.json', 'expected_error': 'proxy configuration lacks from_port'},
    { 'filename': 'no_to_port_service.json', 'expected_error': 'proxy configuration lacks to_port'},
    { 'filename': 'equal_ports_service.json', 'expected_error': 'from_port and to_port can not be identical'},
    { 'filename': 'nonnumeric_quota_interval_service.json', 'expected_error': 'quotas.interval must be a number'},
    { 'filename': 'subsecond_quota_interval_service.json', 'expected_error': 'minimum quotas.interval is 1 second'},
    { 'filename': 'nonnumeric_quota_default_threshold_service.json', 'expected_error': 'quotas.default_threshold must be a number'},
    { 'filename': 'nonpositive_quota_default_threshold_service.json', 'expected_error': 'quotas.default_threshold must be positive'},
    { 'filename': 'nonnumeric_quota_key_threshold_service.json', 'expected_error': 'bogus-key quota threshold must be a number'},
    { 'filename': 'nonpositive_quota_key_threshold_service.json', 'expected_error': 'bogus-key quota threshold must be positive'},
    { 'filename': 'nonnumeric_from_port_service.json', 'expected_error': 'from_port must be a number'},
    { 'filename': 'nonnumeric_to_port_service.json', 'expected_error': 'to_port must be a number'},
    { 'filename': 'negative_from_port_service.json', 'expected_error': 'from_port must be a valid port number'},
    { 'filename': 'negative_to_port_service.json', 'expected_error': 'to_port must be a valid port number'},
    { 'filename': 'giant_from_port_service.json', 'expected_error': 'from_port must be a valid port number'},
    { 'filename': 'giant_to_port_service.json', 'expected_error': 'to_port must be a valid port number'},
    { 'filename': 'no_ssl_cert_service.json', 'expected_error': 'no ssl cert file provided'},
    { 'filename': 'no_ssl_key_service.json', 'expected_error': 'no ssl key file provided'},
    { 'filename': 'invalid_ssl_cert_service.json', 'expected_error': 'https cert file ' + path.resolve(__dirname, '../', './test/resources/cert_oops.pem') + ' does not exist'},
    { 'filename': 'invalid_ssl_key_service.json', 'expected_error': 'https key file ' + path.resolve(__dirname, '../', './test/resources/key_oops.pem') + ' does not exist'},
    { 'filename': 'to_port_on_client_proxy_service.json', 'expected_error': 'proxy configuration has a to_port and shouldn\'t'}
  ].forEach(function(validation) {
    it ('should reject a proxy config with error: ' + validation.expected_error, function() {
      var config_json = JSON.parse(fs.readFileSync(path.join('./test/config.d/', validation.filename), {'encoding': 'utf8'}));
      var proxy_config = new ProxyConfig(config_json);
      proxy_config.isInvalid().should.equal(validation.expected_error);
    });

  });
});
