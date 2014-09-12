var _ = require('underscore');

var job_server = require('./server/test_server.js').JobServer;

// All the messy business of creating and sending requests (both authenticated and unauthenticated)
// lives in request_sender.
var request_sender = require('./utils/request_sender.js');

// All tests must require auspice_bootstrap_test since that creates our proxy, starts our job server, and
// and registers a beforeEach to keep the request_sender and job_server clean between test runs.
require('./auspice_bootstrap_test.js');

describe('Additional request restrictions', function() {

  // Validate that a basic authenticated request works.  Loop over each verb, running the common tests between them.
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
  	it ('should reject ' + verb + ' on non-whitelisted URIs', function(done) {
  		request_sender.sendAuthenticatedRequest(verb, 'http://localhost:8008/funkypath', {}, 401, done);
  	});
  });
});
