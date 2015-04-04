// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');
var validation_tools = require('./utils/validation_tools.js');

// All tests must require bootstrap_test since that creates our proxy, starts our job server,
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./bootstrap_test.js');

// Tests that verbs are handled correctly by oauth_reverse_proxy
describe('quotas', function() {

  // THe quota wait interval is 1s, so we should wait for 1s between tests to make sure we have a clean slate
  afterEach(function(done) {
    setTimeout(done, 1000);
  });

  // Validate that a single request doesn't violate our quota of 1 request per second.
  it ("should accept a single request per second", function(done) {
    request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8009/job/12345', null, 200, done);
  });

  // Validate that a single request doesn't violate our quota of 1 request per second.
  it ("should accept a single request per second and reject the other with the default key", function(done) {
    var success_seen = false;
    var error_seen = false;

    var res_handler = function(err, res, body) {
      if (res.statusCode === 200) success_seen = true;
      if (res.statusCode === 401) error_seen = true;

      if (success_seen && error_seen) done();
    };

    // Send these requests with an undefined expected status code since there's no way to verify order of completion.
    // One of these will be a 200; the other will be a 201.
    request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8009/job/12345', null, undefined, res_handler);
    request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8009/job/12345', null, undefined, res_handler);
  });

  // Validate that a single request doesn't violate our quota of 1 request per second.
  it ("should accept 5 requests per second and reject the other with a privileged key", function(done) {
    var successes_seen = 0;
    var error_seen = false;

    var res_handler = function(err, res, body) {
      if (res.statusCode === 200) successes_seen++;
      if (res.statusCode === 401) error_seen = true;

      if ((successes_seen === 5) && error_seen) done();
    };

    // Send these requests with an undefined expected status code since there's no way to verify order of completion.
    // One of these will be a 200; the other will be a 201.
    for (var i=0; i<6; ++i) {
      request_sender.oauth_headers[0][1] = 'quota-test-key';
      request_sender.sendAuthenticatedRequest('GET', 'http://localhost:8009/job/12345', null, undefined, res_handler);
    }
  });
});
