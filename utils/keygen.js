var path = require('path');

var uuid = require('node-uuid');
var fs = require('fs');

var sprintf = require('./sprintf.js').sprintf;

function createKeystorePath(root_dir, from_port, to_port) {
  return sprintf('%s%s%s%s%s', root_dir, path.sep, from_port, path.sep, to_port);
}

/**
 * Create a key with a randomized secret at file location /root_dir/from_port/to_port/key_id
 */
exports.createKey = function(root_dir, from_port, to_port, key_id, secret, cb) {
  if (!cb) { 
    cb = secret; 
    secret = uuid.v4();
  }

  var keystore_path = createKeystorePath(root_dir, from_port, to_port, key_id);
  require('mkdirp')(keystore_path, function(err) {
    if (err) return cb(err);

    var keyfile = keystore_path + path.sep + key_id;
    fs.writeFile(keyfile, secret, function(err) {
      return cb(err);
    });
  });
}

// Invoked from the command line with the correct number of args
if (process.argv[1].indexOf('keygen') != -1) {
  if (process.argv.length === 6) {
    var args = process.argv;
    exports.createKey(args[2], args[3], args[4], args[5], function() {
      console.log("Key " + args[5] + " created.");
    });
  } else {
    console.log('usage: node ./test/keygen/ root_dir from_port to_port key_id');
  }
}