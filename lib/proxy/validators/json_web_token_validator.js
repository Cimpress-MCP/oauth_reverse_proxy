var util = require('util');

var jwt = require('express-jwt');

var unauthorized = require('../messages/unauthorized.js');

var ISSUER_HEADER = require('../jwt/constants.js').ISSUER_HEADER;

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
    var issuer = undefined;
    var jwt_validator = jwt({
      secret: function(req, payload, done) {

        proxy.logger.trace("payload:\n%s", util.inspect(payload));

        issuer = payload.iss;
        if (issuer === undefined) return unauthorized(proxy.logger, req, res, "No issuer specified");
        if (keys[issuer] === undefined) return unauthorized(proxy.logger, req, res, "Invalid issuer specified");

        proxy.logger.info("issuer is '%s'", issuer);

        done(null, keys[issuer].secret);
      }
    });

    jwt_validator(req, res, function(err) {
      if (err) return unauthorized(proxy.logger, req, res, "JSON web token validation error " + err);

      // TODO: Grab req.user.admin and create a header out of it?
      req.headers[ISSUER_HEADER] = issuer;

      // We passed validation, so move to the next step in the pipeline.
      next();
    });
  };
};
