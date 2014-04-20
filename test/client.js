var util = require('util');

var logger = require('../utils/logger.js').getLogger('test-client');

var oauth = require('oauth').OAuth;

var oa = new oauth('', '', 'super-insecure-test-key', 'super-insecure-secret', '1.0', null, 'HMAC-SHA1');

oa.getProtectedResource("http://localhost:8000/job", "GET", null, null, 
  function (error, data, response) {
    util.puts(data);
  }
);