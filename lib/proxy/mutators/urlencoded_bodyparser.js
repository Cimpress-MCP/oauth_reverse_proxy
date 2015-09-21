var body_parser = require('body-parser').urlencoded({ extended: true, limit: '1mb' });

var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
 * Parse the body of the request for urlencoded form-data.  Note that this will
 * fail if the body is not utf-8.
 */
module.exports = function(proxy) {
  return function(req, res, next) {
    body_parser(req, res, function(err) {
      if (err && err.status === 413) return next(err);
      if (err) proxy.logger.warn(module_tag, "Failed to parse body: %s", err);
      next();
    });
  };
};
