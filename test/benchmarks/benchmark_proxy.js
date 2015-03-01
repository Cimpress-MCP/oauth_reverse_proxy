var proxy_class = require('../../lib/proxy');
var proxy_config_class = require('../../lib/proxy/config.js');

var proxy_config = new proxy_config_class({
  'service_name': 'proxy_benchmark_service',
  'from_port': 6789,
  'to_port': 7007,
  'oauth_secret_dir': '/tmp/'
});

var CONSUMER_KEY = 'proxy_benchmark_key';
var CONSUMER_SECRET = 'proxy-benchmark-secret';

var proxy = new proxy_class(proxy_config);

var oauth_class = require('oauth').OAuth;
var oauth = new oauth_class('', '', CONSUMER_KEY, CONSUMER_SECRET, '1.0', null, 'HMAC-SHA1');
var header = oauth.authHeader('http://test.cimpress.io/proxy_benchmark', '', '');

// Swap in a fake keystore
proxy.keystore = {
  keys: {},
  quotas: {}
};

proxy.keystore.keys[CONSUMER_KEY] = {
  secret: CONSUMER_SECRET
};

var proxy_app = proxy.getConnectApp();

var res = {
  send: function(msg) {
    console.log('send: ' + msg);
  },
  writeHead: function(code, msg) {
    console.log('head: ' + code + ' ' + msg);
  },
  end: function() {}
};

module.exports = {
  name: 'Proxy Benchmark',
  fn: function() {
    var req_to_auth = {
      method: "GET",
      url: "http://test.cimpress.io/proxy_benchmark",
      headers: {
        'host': 'test.cimpress.io',
        'authorization': header
      },
      connection: {
        remoteAddress: '10.10.10.10'
      }
    };

    proxy_app(req_to_auth, res, function() {});

  }
};