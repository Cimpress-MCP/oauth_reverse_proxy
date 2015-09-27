var jwt = require('express-jwt');

var unauthorized = require('../messages/unauthorized.js');

var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
 * Create a JWT validator using the proxy's keystore to lookup secrets based
 * on issued.
 */
module.exports = function(proxy) {
  var keys = proxy.keystore.keys;

  return function(req, res, next) {
    var jwt_validator = jwt({
      secret: function(req, payload, done) {
        // TODO: We need to validate that this was set already
        var issuer = payload.iss;
        if (issuer === undefined) return unauthorized(proxy.logger, req, res, "No issuer specified");
        if (keys[issuer] === undefined) return unauthorized(proxy.logger, req, res, "Invalid issuer specified");
        done(null, keys[issuer]);
      }
    });

    jwt_validator(req, res, function(err) {
      if (err) return unauthorized(proxy.logger, req, res, "JSON web token validation error " + err);

      // TODO: Grab req.user.admin and create a header out of it?

      // We passed validation, so move to the next step in the pipeline.
      next();
    });
  };
};
