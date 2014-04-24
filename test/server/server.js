var express = require('express');
var app = express();
app.use(require ('body-parser')());
app.use(require ('method-override')());

app.get("/job", function(req, res) {
  res.send({'status':'ok'});
});

var server = app.listen(8888, function() {
  console.log('Listening on port %d', server.address().port);
});