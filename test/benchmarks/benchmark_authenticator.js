var authenticator = require('../../lib/proxy/authenticator.js');

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

var validator = authenticator.oauthValidator(proxy);

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

      // This will add parsed_url to req_to_auth
      authenticator.urlParser()(req_to_auth, null, function() {});
      validator(req_to_auth, res, function() {});
    }
  }
}
