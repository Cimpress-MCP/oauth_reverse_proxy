var http = require('http');
var util = require('util');

var consumer_key = 'node-test-key';

var req = http.get("http://localhost:8787/proxy/8000/key/" + consumer_key + "/", function(res) {
  
  var consumer_secret = "";
  
  res.on("data", function(chunk) {
    consumer_secret += chunk;
  });
  
  res.on("end", function() {  
    var oauth = require('oauth').OAuth;
    var oa = new oauth('', '', consumer_key, consumer_secret, '1.0', null, 'HMAC-SHA1');

    var post_body = {
      posts:'should',
      fun: 'kill',
      beans: 'either',
      strings: 'cheese',
      not: 'true'
    };

    oa.post("http://localhost:8000/job?do=query&strings=kill&us=or&not=true", "", "", 
      post_body, 'application/x-www-form-urlencoded',
      function (error, data, response) {
        util.puts(data);
      }
    );
  });
});