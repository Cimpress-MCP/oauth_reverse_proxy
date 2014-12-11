var request = require('request');

var sendToCoveralls = function(obj, cb){
  var str = JSON.stringify(obj);
console.log("Sending:\n" + str);
  var url = 'https://coveralls.io/api/v1/jobs';
  request.post({url : url, form : { json : str}}, function(err, response, body){
    console.log(body);
    cb(err, response, body);
  });
};

module.exports = sendToCoveralls;
