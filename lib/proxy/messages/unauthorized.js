
var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
 * Utility method for returning an authentication failure message.
 */
module.exports = function(logger, req, res, message) {
  logger.info(module_tag, "Rejecting %s %s%s, error %s", req.method, req.headers.host, req.url, message);
  process.nextTick(function() {
    res.writeHead(401, message, { 'Access-Control-Allow-Origin': '*' });
    res.end(message);
  });

  // Return false from this method so it can signal to a calling function that the request failed.
  return false;
};
