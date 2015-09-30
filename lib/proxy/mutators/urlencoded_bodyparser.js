var body_parser = require('body-parser');
var iconv = require('iconv-lite');
var util = require('util');

var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

/**
 * Parse the body of the request for `application/x-www-form-urlencoded`
 * form-data, and handle errors afterwards. Fix body-parser compatability
 * (https://github.com/expressjs/body-parser/issues/100) so that requests with
 * headers specifying a Content-Type other than UTF-8 are parsed correctly.
 * Note that `req.headers[]` has all-lowercase key names (e.g. 'content-type').
 */
module.exports = function(proxy) {
  return function(req, res, next) {
    // HACK: Remove incompatible headers from the request, and stash them for later.
    proxy.logger.debug(module_tag, "%s %s: headers\n", req.method, req.url, req.headers);
    // if (typeof req.headers['content-encoding'] !== 'undefined' && req.headers['content-encoding'] !== '') {
    //   req.original_content_encoding = req.headers['content-encoding'];
    //   delete req.headers['content-encoding'];
    //   proxy.logger.warn(module_tag, 'Stashed original "Content-Encoding": "%s"', req.original_content_type);
    // }
    if (typeof req.headers['content-type'] !== 'undefined' && req.headers['content-type'].match(/\s*charset\s*=(?!utf-8)/i)) {
      req.original_content_type = req.headers['content-type'];
      delete req.headers['content-type'];
      req.encoding = req.original_content_type;
      proxy.logger.warn(module_tag, 'Stashed original "Content-Type": "%s"', req.original_content_type);
    }

    // If the headers indicate that the content is not UTF-8, then convert the contents to UTF-8.
    var test = /^.*?charset\s*=([A-z0-9-_]+)\s*(;|\s)?/i;
    var original_encoding = (req.original_content_encoding || req.original_content_type || '').replace(test, '$1');
    if (original_encoding !== '' && iconv.encodingExists(original_encoding)) {
      if (req.url !== '') {
        var original_url = req.url;
        req.url = iconv.decode(original_url, original_encoding);
        proxy.logger.debug(module_tag, 'req.url: (%s) %s changed to (UTF-8) %s', original_encoding, util.inspect(original_url), util.inspect(req.url));
      }
      if (typeof req.body !== 'undefined' && req.body !== '') {
        var original_body = req.body;
        req.body = iconv.decode(original_body, original_encoding);
        proxy.logger.debug(module_tag, 'req.body: (%s) %s changed to (UTF-8) %s', original_encoding, util.inspect(original_body), util.inspect(req.body));
      }
    } else {
      proxy.logger.error(module_tag, 'Interpreted charset "%s" is invalid', original_encoding);
    }

    var parser = body_parser.urlencoded({ extended: true, limit: '1mb' });
    parser(req, res, function(err) {
      // Handle errors
      if (err && err.status === 413) {
        return next(err);
      } else if (err && err.status === 415) {
        proxy.logger.error(module_tag, 'Failed to handle request due to non-"utf-8" charset: req.headers', err, util.inspect(req.headers));
        return next(err);
      } else if (err) {
        proxy.logger.error(module_tag, 'Failed to parse body: %s', err);
        return next(err);
      }

      // Restore stashed headers for use by the next middleware.
      // if (typeof req.original_content_encoding !== 'undefined' && req.original_content_encoding !== '') {
      //   req.headers['Content-Encoding'] = req.original_content_encoding;
      //   proxy.logger.warn(module_tag, 'Restored request header "Content-Encoding": "%s", which was temporarily removed', req.original_content_encoding);
      // }
      if (typeof req.original_content_type !== 'undefined' && req.original_content_type !== '') {
        req.headers['Content-Type'] = req.original_content_type;
        proxy.logger.warn(module_tag, 'Restored request header "Content-Type": "%s", which was temporarily removed', req.original_content_type);
      }

      // Continue chain
      next();
    });
  };
};
