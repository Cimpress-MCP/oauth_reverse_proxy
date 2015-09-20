var crypto = require('crypto');
var util = require('util');

var encoding = require('../../encoding.js');
var sprintf = require('../../sprintf.js').sprintf;

var oauth_constants = require('../oauth/constants.js');
var oauth1a_signature_utils = require('../oauth/signatures/oauth1a.js');

var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

var SIGNATURE_METHOD = oauth_constants.OAUTH_1A_SIGNATURE_METHOD;

/**
 * The oauth_param_generator serves an inverse purpose to the reverse proxy's oauth_param_collector
 * function: this mutator gathers state from the inbound request and adds an OAuth signature for
 * transmission to a remote host.
 */
module.exports = function(proxy) {

  var keys = proxy.keystore.keys;

  return function(req, res, next) {
    try {
      proxy.logger.trace(module_tag, "req.body:\n%s", util.inspect(req.body));
      proxy.logger.trace(module_tag, "req.url:\n%s", util.inspect(req.url));
      proxy.logger.trace(module_tag, "req.parsed_url:\n%s", util.inspect(req.parsed_url));
      proxy.logger.trace(module_tag, "req.headers:\n%s", util.inspect(req.headers));

      // A pre-condition of this function is that we have already created req.argument_pairs
      // and populated it with the desired consumer_key.
      var consumer_key = req.oauth_params[oauth_constants.OAUTH_CONSUMER_KEY];

      proxy.logger.info(module_tag, "Looking for secret matching key %s", consumer_key);

      // Append & to consumer secret since we'll always have an empty string as the token secret (note,
      // we can always revisit this in the future if we decide to support tokens).
      var consumer_secret = keys[consumer_key].secret + '&';

      // Add the required OAuth params to our outbound argument_pairs.
      var nonce = crypto.randomBytes(16).toString('hex');
      req.argument_pairs.push([oauth_constants.OAUTH_SIGNATURE_METHOD, SIGNATURE_METHOD]);
      req.argument_pairs.push([oauth_constants.OAUTH_NONCE, nonce]);
      var timestamp = new Date().getTime();
      req.argument_pairs.push([oauth_constants.OAUTH_TIMESTAMP, timestamp]);
      req.argument_pairs.push([oauth_constants.OAUTH_VERSION, '1.0']);

      // Add query params
      oauth1a_signature_utils.collectParams(req, req.query);

      // Add POST body params.  This will noop if the request is not a POST or is not form-urlencoded.
      // If the parameter is an oauth param, track it for easy lookup.  Note that it's seriously non-standard
      // to send oauth parameters in the POST body, but DotNetOpenAuth does it in some circumstances.
      oauth1a_signature_utils.collectParams(req, req.body);

      // Retrieve the signature bases.  Unlike with signature validation, we know whether the request
      // should be https or http, so this method should always return an array of length 1.  If a
      // future coding error makes that not the case, we'll catch an exception and return a 500.
      var signature_base = oauth1a_signature_utils.constructStringsToSign(req)[0];

      proxy.logger.debug(module_tag, "Got signature_base\n%s", signature_base);

      var signature = crypto.createHmac("sha1", consumer_secret).update(signature_base).digest("base64");

      // Construct an Auth header with this signature.
      req.headers['Authorization'] =
        sprintf('OAuth oauth_consumer_key="%s",oauth_signature_method="%s",oauth_signature="%s",oauth_nonce="%s",oauth_timestamp="%s",oauth_version="1.0"',
          consumer_key,
          SIGNATURE_METHOD,
          encoding.encodeData(signature),
          nonce,
          timestamp
        );

      proxy.logger.info(module_tag, "Proxying %s %s%s, consumer key %s", req.method, req.headers.host, req.url, consumer_key);
      return next();

    } catch (e) {
      /* istanbul ignore next */
      if (proxy && proxy.logger)
        proxy.logger.error(module_tag, "Failed to handle request %s %s%s due to %s:\n%s", req.method, req.headers.host, req.url, e, e.stack);
      /* istanbul ignore next */
      res.writeHead(500, 'Internal error');
      /* istanbul ignore next */
      return res.end();
    }
  };
};
