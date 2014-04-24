var fs = require('fs');

/**
 * Read and parse the config file, return its contents.  Throw an exception if parsing or loading
 * fails.
 */
exports.getState = function(path) {
	var configBlob = fs.readFileSync(path, 'utf8');
  return JSON.parse(configBlob);
};
