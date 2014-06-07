var _ = require('underscore');
var fs = require('fs');
var should = require('should');
var stream = require('stream');

exports.IGNORABLE_REQUEST_HEADERS = ['authorization', 'host', 'vp_user_key', 'content-type'];
exports.IGNORABLE_RESPONSE_HEADERS = [ 'date' ];

exports.STOCK_JSON_CONTENTS = fs.readFileSync('./test/resources/test.json', {encoding:'utf8'});
exports.STOCK_JSON_OBJECT = JSON.parse(exports.STOCK_JSON_CONTENTS);

exports.STOCK_JSON_STREAM = new stream();
exports.STOCK_JSON_STREAM.pipe = function(target) {
  target.write(exports.STOCK_JSON_CONTENTS);
}

exports.STOCK_XML_CONTENTS = fs.readFileSync('./test/resources/get_list_of_products.xml', {encoding:'utf8'});
exports.STOCK_XML_STREAM = new stream();
exports.STOCK_XML_STREAM.pipe = function(target) {
  target.write(exports.STOCK_XML_CONTENTS);
}

// Compare the two sets of headers and return true only if they are equal in both name and
// value, aside from the keys listed in keys_to_ignore.
module.exports.compareHeaders = function(auth, unauth, keys_to_ignore) {
  
  // Default to an empty set if no keys were provided.
  keys_to_ignore = keys_to_ignore || {};

  // Deep compare the objects after omitting the set of keys that may differ between calls.
  var rvalue = _.isEqual(
    _.omit(auth, keys_to_ignore),
    _.omit(unauth, keys_to_ignore)
  );
  
  // If we have a header difference, this may the result of a transient condition and very difficult
  // to reproduce.  Log the headers to make sure we know what happened.
  if (!rvalue) 
    console.log('auth:\n%s\n,unauth:\n%s\nto_ignore:\n%s', util.inspect(auth), util.inspect(unauth), util.inspect(keys_to_ignore));
    
  return rvalue;
};
