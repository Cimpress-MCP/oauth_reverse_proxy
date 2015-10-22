var util = require('util');

var sprintf = require('../../sprintf.js').sprintf;
var encoding = require('../../encoding.js');

var unauthorized = require('../messages/unauthorized.js');

var crypto = require('crypto');

var oauth1a = require('../oauth/signatures/oauth1a.js');

var OAUTH_1A_ALLOWED_SIGNATURE_METHODS = require('../oauth/constants.js').OAUTH_1A_ALLOWED_SIGNATURE_METHODS;
var OAUTH_CONSUMER_KEY = require('../oauth/constants.js').OAUTH_CONSUMER_KEY;
var OAUTH_SIGNATURE = require('../oauth/constants.js').OAUTH_SIGNATURE;
var OAUTH_SIGNATURE_METHOD = require('../oauth/constants.js').OAUTH_SIGNATURE_METHOD;

var CONSUMER_KEY_HEADER = require('../oauth/constants.js').CONSUMER_KEY_HEADER;

var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
 * Create an oauth validator using the provided keys.
 */
module.exports = function(proxy) {
  var keys = proxy.keystore.keys;

  return function(req, res, next) {
    try {
      if (req.whitelist_passed === true) {
        return next();
      }

      proxy.logger.trace(module_tag, "req.body:\n%s", util.inspect(req.body));
      proxy.logger.trace(module_tag, "req.headers:\n%s", util.inspect(req.headers));
      proxy.logger.trace(module_tag, "req.argument_pairs:\n%s", util.inspect(req.argument_pairs));

      // Append & to consumer secret since we'll always have an empty string as the token secret
      var consumer_secret = keys[req.oauth_params[OAUTH_CONSUMER_KEY]].secret + '&';

      // Retrieve two signature bases, the first assuming the scheme is https, and the second assuming http.
      // Process them in this order under the assumption that most services should be going over https.
      var signature_bases = oauth1a.constructStringsToSign(req);

      // Because python (and possibly) some other libraries do not encode the signature, we can avoid spurious
      // validation failures by comparing decoded signatures against the hash value computed by oauth_reverse_proxy.
      req.oauth_params[OAUTH_SIGNATURE] = encoding.decodeData(req.oauth_params[OAUTH_SIGNATURE]);

      while (signature_bases.length > 0) {

        var signature_base = signature_bases.shift();
        proxy.logger.debug(module_tag, "Got signature_base\n%s", signature_base);

        var hash = crypto.createHmac(OAUTH_1A_ALLOWED_SIGNATURE_METHODS[req.oauth_params[OAUTH_SIGNATURE_METHOD]], consumer_secret).update(signature_base).digest("base64");

        proxy.logger.trace(module_tag, "Hash\t%s", hash);
        proxy.logger.trace(module_tag, "Sig\t%s", req.oauth_params[OAUTH_SIGNATURE]);

        if (req.oauth_params[OAUTH_SIGNATURE] === hash) {
          // Update the headers of the message to include the consumer key before proxying.
          var consumer_key = req.oauth_params[OAUTH_CONSUMER_KEY];
          req.headers[CONSUMER_KEY_HEADER] = consumer_key;
          proxy.logger.info(module_tag, "Proxying %s %s%s, consumer key %s", req.method, req.headers.host, req.url, consumer_key);
          return next();
        }
      }

      // If we got here, neither of the signatures (http or https) matched, so we must return a 401.
      return unauthorized(proxy.logger, req, res, "Signature mismatch");
    } catch (e) {
      /* istanbul ignore else */
      if (proxy && proxy.logger)
        proxy.logger.error(module_tag, "Failed to handle request %s %s%s due to %s:\n%s", req.method, req.headers.host, req.url, e, e.stack);

      res.writeHead(500, 'Internal error');
      return res.end();
    }
  };
};
