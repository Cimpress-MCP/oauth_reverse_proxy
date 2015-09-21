var qs = require('qs');
var url = require('url');

/**
 * Parse the input url once and cache a parsed representation of the query string.
 */
module.exports = function() {
  return function(req, res, next) {
    // https://github.com/scottcorgan/connect-query/blob/ff48d524f8bfe59bb36646074338fb9ff7c500d8/index.js
    var parsedUrl = url.parse(req.url);
    req.query = qs.parse(parsedUrl.query);
    next();
  };
};
