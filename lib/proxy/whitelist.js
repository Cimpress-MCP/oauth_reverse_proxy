var _ = require('underscore');
var util = require('util');

var sprintf = require('../sprintf.js').sprintf;
var logger = require('../logger.js').getLogger();

/**
 * Each whitelist entry can take the form:
 *  {
 *    "path": "/path/string/or/regex",
 *    "method": [ "GET", "POST" ]
 *  }
 *
 * A predicate is considered matched if both conditions (that is, path and method)
 * match an inbound request.  Paths are considered to be regexes and must match the
 * entire path of the request.
 *
 * Either path or method may be omitted.  Note that path is always a string and method
 * is always an array.
 */
function createWhitelistPredicate(config) {
  if (config.path) {
    var path_regex = new RegExp("^" + config.path + "$", "i");
  }

  if (config.methods) {
    var methods = {};
    _.each(config.methods, function(method) {
      methods[method] = true;
    });
  }

  // A whitelist predicate with no valid config should be ignored.
  if (path_regex === undefined && methods === undefined) return undefined;

  return function(req) {
    // A predicate is considered to match if it matches both the path and methods
    // configuration of the predicate.  If either is ommitted, it's assumed to be
    // a match.
    var matches_method = (methods != undefined) ? methods[req.method] != undefined : true;
    var matches_path = (path_regex != undefined) ? path_regex.test(req.parsed_url.pathname) : true;
    return matches_method && matches_path;
  };
}

/**
 * A whitelist is a collection of predicates run on any inbound req.  If any of the predicates
 * returns true when passed the req, the req is said to be whitelisted.
 */
function Whitelist(whitelist_config) {
  var whitelist_config;
  var predicates = [];
  Object.defineProperty(this, 'predicates', {value: predicates});

  whitelist_config.forEach(function(predicate_config) {
    var p = createWhitelistPredicate(predicate_config);
    if (p) predicates.push(p);
    else logger.error("Invalid predicate config %s", util.inspect(predicate_config));
  });
}

/**
 * Pass the request through all predicates.
 */
Whitelist.prototype.applyWhitelist = function(req) {
  for (var i=0; i<this.predicates.length; ++i) {
    if (this.predicates[i](req)) return true;
  }
  return false;
};

module.exports = Whitelist;
