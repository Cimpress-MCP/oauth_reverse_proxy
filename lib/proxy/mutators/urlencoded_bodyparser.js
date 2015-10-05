var body_parser = require('body-parser');
var iconv = require('iconv-lite');
var util = require('util');

var module_tag = {
  module: require('../../logger.js').getModulePath(__filename)
};

// HACK: Remove incompatible headers from the request and stash them for later.
function stashHeaders(proxy, req) {
  proxy.logger.debug(module_tag, "%s %s: headers\n", req.method, req.url, req.headers);
  if (typeof req.headers['content-encoding'] !== 'undefined' && req.headers['content-encoding'] !== '') {
    req.original_content_encoding = req.headers['content-encoding'];
    req.headers['content-encoding'] = '';
    proxy.logger.warn(module_tag, 'Stashed request header "Content-Encoding": "%s"', req.original_content_type);
  }
  if (typeof req.headers['content-type'] !== 'undefined' && req.headers['content-type'].match(/\s*charset\s*=(?!utf-8)/i)) {
    req.original_content_type = req.headers['content-type'];
    req.headers['content-type'] = 'application/x-www-form-urlencoded';
    proxy.logger.warn(module_tag, 'Stashed request header "Content-Type": "%s"', req.original_content_type);
  }
}

// Restore stashed headers for use by the next middleware.
function restoreHeaders(proxy, req) {
  if (typeof req.original_content_encoding !== 'undefined' && req.original_content_encoding !== '') {
    req.headers['content-encoding'] = req.original_content_encoding;
    proxy.logger.warn(module_tag, 'Restored request header "Content-Encoding": "%s", which was temporarily removed', req.original_content_encoding);
    delete req.original_content_encoding;
  }
  if (typeof req.original_content_type !== 'undefined' && req.original_content_type !== '') {
    req.headers['content-type'] = req.original_content_type;
    proxy.logger.warn(module_tag, 'Restored request header "Content-Type": "%s", which was temporarily removed', req.original_content_type);
    delete req.original_content_type;
  }
}

// Convert convertible content to UTF-8, as necessary.
function convertContent(proxy, req) {
  var test = /^.*?charset\s*=([A-z0-9-_]+)\s*(;|\s)?/i;
  var original_charset = (req.original_content_encoding || req.original_content_type || '').replace(test, '$1');
  if (original_charset !== '' && iconv.encodingExists(original_charset)) {
    req.encoding = original_charset;
    req.charset = original_charset;
    if (typeof req.url !== 'undefined' && req.url !== '') {
      var original_url = req.url;
      req.url = iconv.decode(new Buffer(original_url), original_charset);
      proxy.logger.debug(module_tag, 'req.url: (%s) %s changed to (UTF-8) %s', original_charset, util.inspect(original_url), util.inspect(req.url));
    }
    if (typeof req.body !== 'undefined' && req.body !== '') {
      var original_body = req.body;
      req.body = iconv.decode(new Buffer(original_body), original_charset);
      proxy.logger.debug(module_tag, 'req.body: (%s) %s changed to (UTF-8) %s', original_charset, util.inspect(original_body), util.inspect(req.body));
    }
    if (typeof req.ordered_query !== 'undefined' && req.ordered_query) {
      var converted_list = [];
      for (var key in req.ordered_query) {
        var converted_key = iconv.decode(new Buffer(key), original_charset);
        var converted_value = iconv.decode(new Buffer(req.ordered_query[key]), original_charset);
        var tuple = {};
        tuple[converted_key] = converted_value;
        converted_list.push(tuple);
      }
      proxy.logger.debug(module_tag, 'req.ordered_query: (%s) %s changed to (UTF-8) %s', original_charset, util.inspect(req.ordered_query), util.inspect(converted_list));
      delete req.ordered_query;
      req.ordered_query = converted_list;
    }
  } else if (original_charset !== '') {
    proxy.logger.error(module_tag, 'Interpreted charset "%s" is invalid', original_charset);
  }
}

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
    if (req.headers['content-type'] && req.headers['content-type'].indexOf('application/x-www-form-urlencoded') === 0) {
      req.cached_header = req.headers['content-type'];
      req.headers['content-type'] = 'application/x-www-form-urlencoded';
      proxy.logger.warn(module_tag, 'Ignoring invalid header \"Content-Type\": \"%s\" during body parsing', req.cached_header);
    }

    var parser = body_parser.urlencoded({ extended: true, limit: '1mb' });
    parser(req, res, function(err) {
      // Handle errors
      if (err) return next(err);

      if (req.cached_header) {
        req.headers['content-type'] == req.cached_header;
        proxy.logger.warn(module_tag, 'Restored invalid header \"Content-Type\": \"%s\"', req.cached_header);
      }

      // Continue chain
      next();
    });
  };
};
