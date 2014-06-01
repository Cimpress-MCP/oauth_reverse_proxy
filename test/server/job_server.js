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

app.put("/job", function(req, res) {
  console.log('PUT with key %s', req.headers['vp_user_key']);
  module.exports.emit('PUT', '/job', req, res);
  res.send({'status':'ok'});
});

app.delete("/job/:job_id", function(req, res) {
  console.log('DELETE with key %s', req.headers['vp_user_key']);
  module.exports.emit('DELETE', '/job', req, res);
  res.send({'status':'ok'});
});

app.get("/livecheck", function(req, res) {
  console.log('GET /livecheck');
  module.exports.emit('GET', '/livecheck', req, res);
  res.send({'status':'ok'});
});

app.post("/livecheck", function(req, res) {
  console.log('POST /livecheck');
  module.exports.emit('POST', '/livecheck', req, res);
  res.send({'status':'ok'});
});

var server = app.listen(8080, function() {
  module.exports.emit('started');
});
