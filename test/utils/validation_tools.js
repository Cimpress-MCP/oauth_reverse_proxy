var _ = require('underscore');
var fs = require('fs');
var should = require('should');
var stream = require('stream');
var util = require('util');

exports.IGNORABLE_REQUEST_HEADERS = ['authorization', 'x-oauth-reverse-proxy-consumer-key', 'content-type', 'via', 'x-vp-correlatorid'];
['for', 'port', 'proto'].forEach(function(header) {
  exports.IGNORABLE_REQUEST_HEADERS.push('x-forwarded-' + header);
});
exports.IGNORABLE_RESPONSE_HEADERS = [ 'date' ];

exports.LOREM_IPSUM = fs.readFileSync('./test/resources/lorem_ipsum.txt', {encoding:'utf8'});

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

// Creates a convenience function for validating that an http response has the correct status code
// and did not result in a protocol-level error (connection failure, etc).
exports.createResponseValidator = function(expected_status_code, done) {
  return function(err, response, body) {
    if (err) return done(err);
    response.statusCode.should.equal(expected_status_code);
    // Validate that all responses have a connection header of keep-alive.  For performance reasons,
    // oauth_reverse_proxy should never be disabling keep-alives.
    response.headers.connection.should.equal('keep-alive');
    // We know that all requests to the JobServer should return {"status":"ok"}, so add that validation.
    if (expected_status_code === 200 && response.request.path.indexOf('/job') != -1) body.should.equal('{"status":"ok"}');

    // Otherwise, if we made it here, the test is complete.
    done(null, response, body);
  };
};
