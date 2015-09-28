var body_parser = require('body-parser');

var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
 * Parse the body of the request for `application/x-www-form-urlencoded`
 * form-data, and handle errors afterwards. Fix body-parser compatability
 * (https://github.com/expressjs/body-parser/issues/100) so that requests with
 * headers specifying a Content-Type other than UTF-8 are parsed correctly.
 * Note that `req.headers[]` has all-lowercase key names (e.g. 'content-type').
 */
module.exports = function(proxy) {
  return function(req, res, next) {
    // HACK: Remove incompatible headers from the request, and stash them for later.
    proxy.logger.debug(module_tag, "HTTP/%s %s %s: headers\n", req.httpVersion, req.method, req.url, req.headers);
    if (typeof req.headers['content-encoding'] !== 'undefined' && req.headers['content-encoding'] !== '') {
      req.original_content_encoding = req.headers['content-encoding'];
      delete req.headers['content-encoding'];
      proxy.logger.warn(module_tag, 'Stashed original "Content-Encoding": "%s"', req.original_content_type);
    }
    if (typeof req.headers['content-type'] !== 'undefined' && req.headers['content-type'].match(/\s*charset\s*=(?!utf-8)/i)) {
      req.original_content_type = req.headers['content-type'];
      delete req.headers['content-type'];
      proxy.logger.warn(module_tag, 'Stashed original "Content-Type": "%s"', req.original_content_type);
    }

    var parser = body_parser.urlencoded({ extended: true, limit: '1mb' });
    parser(req, res, function(err) {
      // Handle errors
      if (err && err.status === 413) {
        return next(err);
      } else if (err && err.status === 415) {
        proxy.logger.error(module_tag, 'Failed to handle request due to non-"utf-8" charset', err, req.headers);
        return next(err);
      } else if (err) {
        proxy.logger.error(module_tag, 'Failed to parse body: %s', err);
        return next(err);
      }

      // Restore stashed headers for use by the next middleware.
      if (typeof req.original_content_type !== 'undefined' && req.original_content_type !== '') {
        req.headers['Content-Type'] = req.original_content_type;
        proxy.logger.warn(module_tag, 'Restored request header "Content-Type": "%s", which was temporarily removed', req.original_content_type);
      }
      if (typeof req.original_content_encoding !== 'undefined' && req.original_content_encoding !== '') {
        req.headers['Content-Encoding'] = req.original_content_encoding;
        proxy.logger.warn(module_tag, 'Restored request header "Content-Encoding": "%s", which was temporarily removed', req.original_content_encoding);
      }

      // Continue chain
      next();
    });
  };
};
