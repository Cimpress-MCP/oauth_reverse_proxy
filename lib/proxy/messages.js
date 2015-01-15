
/**
 * Utility method for returning a bad request failure message.
 */
exports.badrequest = function(logger, req, res, message) {
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

/**
 * Utility method for returning an authentication failure message.
 */
exports.unauthorized = function(logger, req, res, message) {
  logger.info("Rejecting %s %s%s, error %s", req.method, req.headers.host, req.url, message);
  process.nextTick(function() {
    res.writeHead(401, message);
    res.end();
  });

  // Return false from this method so it can signal to a calling function that the request failed.
  return false;
};