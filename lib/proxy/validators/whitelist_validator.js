var Whitelist = require('../whitelist.js');

/**
 * Create a whitelist validator.  If the request passes the whitelist, it is automatically proxied through.
 */
module.exports = function(proxy){

  var whitelist = new Whitelist(proxy.config.whitelist);

  return function(req, res, next) {
    req.whitelist_passed = whitelist.applyWhitelist(req);

    if(req.whitelist_passed) {
      proxy.logger.info("Proxying URL %s %s%s WHITELIST", req.method, req.headers.host, req.url);
    }

    return next();
  };
};
