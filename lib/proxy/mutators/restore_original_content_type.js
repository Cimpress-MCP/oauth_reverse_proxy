var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
 * If a 'Content-Type' value was stashed, restore it.
 */
var unstash_original_type = function(req, res, next) {
  var type = req.headers['Content-Type'];
  if (req.original_type) {
    req.headers['Content-Type'] = req.original_type;
    proxy.logger.debug(module_tag, 'Restored original "Content-Type" (from "%s") to "%s"', type, req.original_type);
  }
  next();
}
