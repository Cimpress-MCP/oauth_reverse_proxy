var util = require('util');

var oauth = require('oauth').OAuth;

var oa = new oauth('', '', 'super-insecure-test-key', 'super-insecure-secret', '1.0', null, 'HMAC-SHA1');

var post_body = {
  posts:'should',
  fun: 'kill',
  beans: 'either',
  strings: 'cheese'
//  not: 'true'
};

oa.post("http://localhost:8000/job?do=query&strings=kill&us=or&not=true", "", "", 
  post_body, 'application/x-www-form-urlencoded',
  function (error, data, response) {
    util.puts(data);
  }
);