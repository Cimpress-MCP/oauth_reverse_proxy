// Return the port, either by parsing the host header or by determining whether oauth_reverse_proxy did ssl
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

var OAUTH_REVERSE_PROXY_VERSION = process.env.OAUTH_REVERSE_PROXY_VERSION || "tst";

// The Via header value won't change during runtime of this process, so create it once at startup.
var DEFAULT_VIA_HEADER = '1.1 localhost (oauth_reverse_proxy v' + OAUTH_REVERSE_PROXY_VERSION + ')';

// Append x-forwarded-for, x-forwarded-port, x-forwarded-proto, x-forwarded-host, and via to the request
// headers before proxying to the target server.  If these headers are already set, append information
// received by oauth_reverse_proxy to the existing headers.
module.exports = function() {
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
