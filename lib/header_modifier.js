var uuid = require('node-uuid');

// Return the port, either by parsing the host header or by determining whether Auspice did ssl
// termination for the request.
function getPortForRequest(req) {
  var port = req.headers.host.match(/:(\d+)/);
  return port ?
    port[1] :
    req.connection.pair ? '443' : '80';
}

// If the header already exists, append the new value, comma separated, so the result would look
// something like this:
//      x-forwarded-for: 129.78.138.66,129.78.64.103
function safelySetHeader(req, header_name, header_value) {
  var current_header = req.headers[header_name];
  if (current_header) {
    req.headers[header_name] = current_header += ',' + header_value;
  } else {
    req.headers[header_name] = header_value;
  }
}

// The Via header value won't change during runtime of this process, so create it once at startup.
var DEFAULT_VIA_HEADER = '1.1 localhost (Auspice v' + process.env.AUSPICE_VERSION + ')';

// Append x-forwarded-for, x-forwarded-port, x-forwarded-proto, x-forwarded-host, and via to the request
// headers before proxying to the target server.  If these headers are already set, append information
// received by Auspice to the existing headers.
exports.applyXForwardedHeaders = function() {
  return function(req, res, next) {

    var values = {
      for  : req.connection.remoteAddress,
      port : getPortForRequest(req),
      proto: (req.isSpdy || req.connection.pair) ? 'https' : 'http'
    };

    // Set or append the x-forwarded-* headers.
    ['for', 'port', 'proto'].forEach(function(header) {
      safelySetHeader(req, 'x-forwarded-' + header, values[header]);
    });

    // Set or append a via header.
    safelySetHeader(req, 'via', DEFAULT_VIA_HEADER);

    next();
  };
};

// This is the header used by ServicePlatform.  Seems like a good enough header name to use for tracking requests
// as they make their way through our infrastructure.
var CORRELATOR_ID_HEADER = exports.CORRELATOR_ID_HEADER = 'x-vp-correlatorid';

// Create correlation id as an RFC 4122 v4 UUID if not present.
exports.applyCorrelationId = function() {
  return function(req, res, next) {
    if (!req.headers[CORRELATOR_ID_HEADER]) {
      req.headers[CORRELATOR_ID_HEADER] = uuid.v4();
    }

    // TODO: We may wish to add this header to responses, but that takes a bit more connect hackery than we would ideally
    // like to do.  For now, we are charitably assuming that the underlying services will be smart enough to return the
    // correlation id in their responses.

    next();
  };
};

// Adjust the host header to reflect the proxy port.
exports.modifyHostHeaders = function(from_port, to_port) {

  // The new host header should take the form :to_port unless to_port is 443 or 80.
  var new_port = (to_port === 443 || to_port === 80) ? '' : ':' + to_port;

  return function(req, res, next) {
    var host = req.headers['host'];

    // If the existing host header includes a port, replace it.  Otherwise, append the value of new_port
    // to the existing host header.
    var idx = host.indexOf(':');
    req.headers['host'] = idx !== -1 ?
      host.substring(0, idx) + new_port :
      host + new_port;

    next();
  };
};
