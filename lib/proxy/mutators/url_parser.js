/**
 * Parse the input url once and cache the parsed value in the request object.
 */
module.exports = function() {
  return function(req, res, next) {
    req.parsed_url = require('url').parse(req.url, false);
    next();
  };
};
