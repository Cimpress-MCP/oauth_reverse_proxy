var proxy = {
  // no-op logging
  logger: {
    info: function() {
      //console.log.apply(this, arguments);
    },
    debug: function() {
      //console.log.apply(this, arguments);
    },
    trace: function() {
      //console.log.apply(this, arguments);
    }
  },
  config: {},
  keys: {
    'test-key': 'test-secret'
  }
};

var parse_url = require('../../lib/proxy/mutators/url_parser.js')(proxy);
var collect_oauth_params = require('../../lib/proxy/mutators/oauth_param_collector.js')(proxy);
var validate_oauth_signature = require('../../lib/proxy/validators/oauth_signature_validator.js')(proxy);

var res = {
  send: function() {},
  end: function() {},
  writeHead: function() {}
}

module.exports = {
  name: "Authentication",
  tests: {
    'Full signature': function(){

      var req_to_auth = {
        method: "GET",
        url: "/job/123",
        headers: {
          'host': 'test.cimpress.com',
          'authorization': 'OAuth oauth_consumer_key="test-key", oauth_nonce="1341234123431", oauth_signature_method="HMAC-SHA1", oauth_timestamp="' +
            (new Date().getTime()) + '", oauth_version="1.0", oauth_signature="0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff"'
        }
      };

      parse_url(req_to_auth, res, function() {});
      collect_oauth_params(req_to_auth, res, function() {});
      validate_oauth_signature(req_to_auth, res, function() {});
    }
  }
}
