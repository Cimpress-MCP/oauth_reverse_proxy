var body_parser = require('body-parser');

var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
 * Parse the body of the request for `application/x-www-form-urlencoded`
 * form-data, and handle errors afterwards.
 */
module.exports = function(proxy) {
  return function(req, res, next) {
    // HACK: Use the fix from https://github.com/expressjs/body-parser/issues/100
    // in order to assume that content is UTF-8, regardless of the headers.
    if (req.headers['Content-Encoding']) {
      req.original_content_encoding = req.headers['Content-Encoding'];
      delete req.headers['Content-Encoding'];
      proxy.logger.warn(module_tag, 'Stashed original "Content-Encoding": "%s"', req.original_content_type);
    }
    if (req.headers['Content-Type'] && req.headers['Content-Type'].match(/;\s*charset\s*=/)) {
      req.original_content_type = req.headers['Content-Type'];
      delete req.headers['Content-Type'];
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

      // Unstash
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
