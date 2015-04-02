var MAXIMUM_URL_LENGTH = require('../oauth/constants.js').MAXIMUM_URL_LENGTH;

module.exports = function() {
  return function(req, res, next) {
    if (req.originalUrl.length < MAXIMUM_URL_LENGTH) {
      return next();
    }

    res.writeHead(413, "URL exceeds maximum allowed length for oauth_reverse_proxy");
    res.end();
  };
};
