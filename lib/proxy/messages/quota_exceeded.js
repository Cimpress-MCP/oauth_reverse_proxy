
var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
 * Utility method for returning an authentication failure message.
 */
module.exports = function(logger, req, res, message) {
  logger.info(module_tag, "Rejecting %s %s%s, quota exceeded", req.method, req.headers.host, req.url);
  process.nextTick(function() {
    res.writeHead(429, "quota exceeded");
    res.end();
  });

  // Return false from this method so it can signal to a calling function that the request failed.
  return false;
};
