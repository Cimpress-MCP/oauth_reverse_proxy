var body_parser = require('body-parser');

var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
 * Parse the body of the request for `application/x-www-form-urlencoded`
 * form-data, and handle errors afterwards.
 */
module.exports = function() {
  var parser = body_parser.urlencoded({ extended: true, limit: '1mb' });
  return function(req, res, next) {
    parser(req, res, function(err) {
      if (err && err.status === 413) return next(err);
      if (err) proxy.logger.warn(module_tag, 'Failed to parse body: %s', err);
      next();
    });
  };
};
