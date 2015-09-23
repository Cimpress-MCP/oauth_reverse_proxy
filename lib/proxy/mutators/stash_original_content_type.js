var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
 * HACK: Use the fix from https://github.com/expressjs/body-parser/issues/100
 * in order to assume that content is UTF-8, regardless of the headers.
 */
var stash_original_type = function(req, res, next) {
  if (req.headers['Content-Type']) {
    var type = req.headers['Content-Type'].match(/;\s*charset\s*=/);
    req.original_type = type;
    proxy.logger.debug(module_tag, 'Stashed original "Content-Type": %s', type);
    req.headers['Content-Type'] = '';
  }
  next();
}
