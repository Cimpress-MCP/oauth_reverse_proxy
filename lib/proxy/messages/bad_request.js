/**
 * Utility method for returning a bad request failure message.
 */
module.exports = function(logger, req, res, message) {
  if (req && req.headers) {
    logger.info("Rejecting %s %s%s, error %s", req.method, req.headers.host, req.url, message);
  } else {
    logger.warn('Rejecting malformed request');
  }

  process.nextTick(function() {
    res.writeHead(400, message);
    res.end();
  });

  // Return false from this method so it can signal to a calling function that the request failed.
  return false;
};
