var util = require('util');

var sprintf = require('../sprintf.js').sprintf;
var encoding = require('../encoding.js');

var badrequest = require('./messages.js').badrequest;
var unauthorized = require('./messages.js').unauthorized;

var crypto = require('crypto');

var Whitelist = require('./whitelist.js');

var OAUTH_CONSUMER_KEY = require('./oauth_params.js').OAUTH_CONSUMER_KEY;
var OAUTH_SIGNATURE = require('./oauth_params.js').OAUTH_SIGNATURE;

var CONSUMER_KEY_HEADER = exports.CONSUMER_KEY_HEADER = 'x-oauth-reverse-proxy-consumer-key';

/**
 * Sorts the encoded key value pairs by encoded name, then encoded value
 */
function sortRequestParams(argument_pairs) {
  // Sort by name, then value.
  return argument_pairs.sort(function(a,b) {
      if ( a[0] === b[0] )  {
        return a[1] < b[1] ? -1 : 1;
      } else {
        return a[0] < b[0] ? -1 : 1;
      }
  });
}

function normaliseRequestParams(argument_pairs) {

  var i;

  // First encode them http://tools.ietf.org/html/rfc5849#section-3.4.1.3.2 .1
  for(i=0;i<argument_pairs.length;i++) {
    argument_pairs[i][0] = encoding.encodeData(argument_pairs[i][0]);
    argument_pairs[i][1] = encoding.encodeData(argument_pairs[i][1]);
  }

  // Then sort them http://tools.ietf.org/html/rfc5849#section-3.4.1.3.2 .2
  argument_pairs = sortRequestParams(argument_pairs);

  // Then concatenate together http://tools.ietf.org/html/rfc5849#section-3.4.1.3.2 .3 & .4
  var args= "";
  for(i=0;i<argument_pairs.length;i++) {
    // wrb: If this array element is identical to the one after it, skip it.  This is because most
    // implementations do not duplicate parameters in the case of an exact match.  However, this doesn't
    // match up with anything in the RFC, so I'm going to leave it commented out for now.
    /**
    if (i < argument_pairs.length-1 &&
      argument_pairs[i][0] === argument_pairs[i+1][0] && argument_pairs[i][1] === argument_pairs[i+1][1]) {
      continue;
    }
    **/
    args += sprintf("%s=%s", argument_pairs[i][0], argument_pairs[i][1]);
    if (i < argument_pairs.length-1) {
      args+= "&";
    }
  }

  return args;
}

// Create signable base strings starting with https and http, if necessary.  Ideally, we only want to create the
// https signature, but we take the pessimistic approach that upstream proxies can not be trusted to set the headers
// we need.  We will return an http-based string unless we see an x-forwarded-proto header that starts with https.
function constructStringsToSign(req) {
  var parameters = encoding.encodeData(normaliseRequestParams(req.argument_pairs));
  var method = req.method.toUpperCase();

  // Optimistically assume we will only need to sign an https string.
  var signable_strings =  [
    sprintf("%s&%s&%s", method, encoding.encodeData(sprintf("https://%s%s", req.headers.host, req.parsed_url.pathname)), parameters)
  ];

  // If x-forwarded-proto is present and starts with https, we know that the original request was for an https url and
  // can return the signable_strings array with a single entry.
  if (req.headers['x-forwarded-proto'] && (req.headers['x-forwarded-proto'].toLowerCase().indexOf('https') === 0)) {
    return signable_strings;
  }

  // If we don't know whether the inbound request was https or http, return both.
  signable_strings.push(sprintf("%s&%s&%s", method, encoding.encodeData(sprintf("http://%s%s", req.headers.host, req.parsed_url.pathname)), parameters));

  return signable_strings;
};

/**
 * Parse the input url once and cache the parsed value in the request object.
 */
exports.urlParser = function() {
  return function(req, res, next) {
    req.parsed_url = require('url').parse(req.url, false);
    next();
  };
};

/**
 * Create a whitelist validator.  If the request passes the whitelist, it is automatically proxied through.
 */
exports.whitelistValidator = function(proxy){

    var whitelist = new Whitelist(proxy.config.whitelist);

    return function(req,res,next) {
        req.whitelist_passed = whitelist.applyWhitelist(req);

        if(req.whitelist_passed) {
            proxy.logger.info("Proxying URL %s %s%s WHITELIST", req.method, req.headers.host, req.url);
        }

        return next();
    };
};

/**
 * Create a request sanity validator.  If the request does not pass these tests, it is a failed request and
 * shouldn't make it to any of the other phases of validation.
 */
exports.requestValidator = function(proxy) {

  var keys = proxy.keys;

  return function(req, res, next) {
    if (!req || !req.headers || !req.method || !req.url) {
      return badrequest(proxy.logger, req, res, 'Invalid request');
    }

    var check_collection = function(coll, comparison_string, error_message) {
      for (var i=0; i<coll.length; ++i) {
        var val = coll[i];
        if (comparison_string.indexOf(val) !== -1) {
          return true;
        }
      }

      return unauthorized(proxy.logger, req, res, error_message);
    };

    /* istanbul ignore else */
    if (proxy.config.required_uris && !check_collection(proxy.config.required_uris, req.url, 'Unmatched URI')) {
      return false;
    }

    /* istanbul ignore else */
    if (proxy.config.required_hosts && !check_collection(proxy.config.required_hosts, req.headers.host, 'Unmatched Host header')) {
      return false;
    }

    next();
  };
};

/**
 * Create an oauth validator using the provided keys.
 */
exports.oauthValidator = function(proxy) {

  var keys = proxy.keys;

  return function(req, res, next) {
    try {
      if (req.whitelist_passed === true) {
        return next();
      }

      proxy.logger.trace("req.body:\n%s", util.inspect(req.body));
      proxy.logger.trace("req.headers:\n%s", util.inspect(req.headers));

      proxy.logger.trace("Parsed auth header into:\n%s", util.inspect(req.oauth_params));

      // Append & to consumer secret since we'll always have an empty string as the token secret
      var consumer_secret = keys[req.oauth_params[OAUTH_CONSUMER_KEY]] + '&';

      // Retrieve two signature bases, the first assuming the scheme is https, and the second assuming http.
      // Process them in this order under the assumption that most services should be going over https.
      var signature_bases = constructStringsToSign(req, consumer_secret);

      // Because python (and possibly) some other libraries do not encode the signature, we can avoid spurious
      // validation failures by comparing decoded signatures against the hash value computed by oauth_reverse_proxy.
      req.oauth_params[OAUTH_SIGNATURE] = encoding.decodeData(req.oauth_params[OAUTH_SIGNATURE]);

      while (signature_bases.length > 0) {

        var signature_base = signature_bases.shift();
        proxy.logger.debug("Got signature_base\n%s", signature_base);

        var hash = crypto.createHmac("sha1", consumer_secret).update(signature_base).digest("base64");

        proxy.logger.trace("Hash\t%s", hash);
        proxy.logger.trace("Sig\t%s", req.oauth_params[OAUTH_SIGNATURE]);

        if (req.oauth_params[OAUTH_SIGNATURE] === hash) {
          // Update the headers of the message to include the consumer key before proxying.
          var consumer_key = req.oauth_params[OAUTH_CONSUMER_KEY];
          req.headers[CONSUMER_KEY_HEADER] = consumer_key;
          proxy.logger.info("Proxying %s %s%s, consumer key %s", req.method, req.headers.host, req.url, consumer_key);
          return next();
        }
      }

      // If we got here, neither of the signatures (http or https) matched, so we must return a 401.
      return unauthorized(proxy.logger, req, res, "Signature mismatch");
    } catch (e) {
      /* istanbul ignore else */
      if (proxy && proxy.logger) proxy.logger.error("Failed to handle request %s %s%s due to %s:\n%s", req.method, req.headers.host, req.url, e, e.stack);
      res.writeHead(500, 'Internal error');
      return res.end();
    }
  };
};
