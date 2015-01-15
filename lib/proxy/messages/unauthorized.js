/**
 * Utility method for returning an authentication failure message.
 */
module.exports = function(logger, req, res, message) {
  logger.info("Rejecting %s %s%s, error %s", req.method, req.headers.host, req.url, message);
  process.nextTick(function() {
    res.writeHead(401, message);
    res.end();
  });

  // Return false from this method so it can signal to a calling function that the request failed.
  return false;
};