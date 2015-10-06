var qs = require('qs');
var url = require('url');

/**
 * Parse the input url once and cache a parsed representation of the query string.
 */
module.exports = function() {
  return function(req, res, next) {
    req.parsed_url = url.parse(req.url, false);
    req.query = qs.parse(req.parsed_url.query);
    next();
  };
};
