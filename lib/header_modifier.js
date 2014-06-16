// Return the host, either by parsing the host header or by determining whether Auspice did ssl
// termination for the request.
function getPortForRequest(req) {
  var port = req.headers.host ? req.headers.host.match(/:(\d+)/) : "";
  return port ?
    port[1] :
    req.connection.pair ? '443' : '80';
}

// If the header already exists, append the new value, comma separated, so the result would look
// something like this:
//      x-forwarded-for: 129.78.138.66, 129.78.64.103
function safelySetHeader(req, header_name, header_value) {
  var current_header = req.headers[header_name];
  if (current_header) req.headers[header_name] = current_header += ',' + header_value;
  else                req.headers[header_name] = header_value;
}

// Append x-forwarded-for, x-forwarded-port, x-forwarded-proto, and x-forwarded-phost to the request
// headers before proxying to the target server.  If these headers are already set, append information
// received by Auspice to the existing headers.
exports.applyXForwardedHeaders = function() {
  return function(req, res, next) {

    var values = {
      for  : req.connection.remoteAddress || req.socket.remoteAddress,
      port : getPortForRequest(req),
      proto: req.isSpdy ? 'https' : (req.connection.pair ? 'https' : 'http')
    };

    ['for', 'port', 'proto'].forEach(function(header) {
      safelySetHeader(req, 'x-forwarded-' + header, values[header]);
    });
    
    next();
  };
};

// TODO: Create correlation id if not present.
exports.applyCorrelationId = function() {
  return function(req, res, next) {
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