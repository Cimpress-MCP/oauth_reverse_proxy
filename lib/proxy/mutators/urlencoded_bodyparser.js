var body_parser = require('body-parser');
var util = require('util');
// var iconv = require('iconv-lite');

var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

// HACK: Remove incompatible headers from the request and stash them for later.
function stashHeaders(proxy, req) {
  proxy.logger.trace(module_tag, "%s %s: headers\n", req.method, req.url, req.headers);
  if (req.headers["content-type"] && req.headers["content-type"].match(/\s*charset\s*=(?!utf-8)/i)) {
    req.original_content_type = req.headers["content-type"];
    req.headers["content-type"] = "application/x-www-form-urlencoded";
    proxy.logger.warn(module_tag, "Stashed request header \"Content-Type\": \"%s\"", req.original_content_type);
  }
  return req;
}

// Restore stashed headers for use by the next middleware.
function restoreHeaders(proxy, req) {
  if (req.original_content_type && req.original_content_type !== '') {
    req.headers["content-type"] = req.original_content_type;
    proxy.logger.warn(module_tag, "Restored request header \"Content-Type\": \"%s\", which was temporarily removed", req.original_content_type);
    delete req.original_content_type;
  }
  return req;
}

/**
 * Parse the body of the request for `application/x-www-form-urlencoded`
 * form-data, and handle errors afterwards. Fix body-parser compatability
 * (https://github.com/expressjs/body-parser/issues/100) so that requests with
 * headers specifying a Content-Type other than UTF-8 are parsed correctly.
 * Note that `req.headers[]` has all-lowercase key names (e.g. 'content-type').
 */
module.exports = function(proxy) {
  return function(req, res, next) {
    stashHeaders(proxy, req);
    // convertContent(proxy, req);
    var parser = body_parser.urlencoded({ extended: true, limit: '1mb' });
    parser(req, res, function(err) {
      // Handle errors
      if (err && err.status === 413) {
        return next(err);
      } else if (err && err.status === 415) {
        proxy.logger.error(module_tag, "Failed to handle request due to non-\"utf-8\" charset: req.headers", err, util.inspect(req.headers));
        return next(err);
      } else if (err) {
        proxy.logger.error(module_tag, "Failed to parse body: err", err);
        return next(err);
      }

      // Continue chain
      restoreHeaders(proxy, req);
      next();
    });
  };
};
