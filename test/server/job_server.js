var express = require('express');
var app = express();
var util = require('util');
app.use(require ('body-parser')());
app.use(require ('method-override')());

module.exports = new (require('events').EventEmitter)();

app.get("/job", function(req, res) {
  console.log('GET with key %s', req.headers['vp_user_key']);
  module.exports.emit('GET', '/job', req, res);
  res.send({'status':'ok'});
});

app.post("/job", function(req, res) {
  console.log('POST with key %s', req.headers['vp_user_key']);
  module.exports.emit('POST', '/job', req, res);
  res.send({'status':'ok'});
});

var server = app.listen(8080, function() {
  module.exports.emit('started');
});
