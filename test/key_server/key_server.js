var express = require('express');
var app = express();
var path = require('path');
var util = require('util');

var uuid = require('node-uuid');
var fs = require('fs');

var sprintf = require('../../utils/sprintf.js').sprintf;
var logger = require('../../utils/logger.js').getLogger('key_server');

try {
  var root_dir = require('../../utils/config_loader.js').getState('../../config.json').root_dir;
} catch(e) {
  logger.error('Failed to load auspice config due to %s', e);
  process.exit(1);
}

app.use(require ('body-parser')());
app.use(require ('method-override')());

function createPath(from_port, key_id) {
  return sprintf('%s%s%skeys%s%s', root_dir, from_port, path.sep, path.sep, key_id);
}

/**
 * Return the secret associated with this key. 
 */
app.get("/proxy/:from_port/key/:key_id/", function(req, res) {
  var keyfile = createPath(req.params.from_port, req.params.key_id);
  logger.trace('Retrieving key %s', keyfile);
  res.sendfile(keyfile);
});

/**
 * Create a new secret for a key in this proxy or replace the secret with a new
 * one if it already exists.  Return the secret in the body of the response.
 */
app.post('/proxy/:from_port/key/', function(req, res) {
  var keyfile = createPath(req.params.from_port, req.body.key_id);
  logger.trace("Attempting to create key %s", keyfile);
  fs.writeFile(keyfile, uuid.v4(), function(err) {
    if (err) return res.send(500, err);
    res.sendfile(keyfile);
  });
});

/**
 * Delete the key and its associated secret, if present.
 */
app.delete("/proxy/:from_port/key/:key_id", function(req, res) {
  var keyfile = createPath(req.params.from_port, req.params.key_id);
  logger.trace("Deleting key %s", keyfile);
  fs.unlink(keyfile, function (err) {
    if (err) return res.send(500, err);
    res.send('ok');
  });
});

/**
 * Only listen for connections on localhost.  This should only be used for test purposes.
 */
var server = app.listen(8787, 'localhost', function() {
  console.log("Listening on port %d", server.address().port);
});
