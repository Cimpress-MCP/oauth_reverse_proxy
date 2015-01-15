// Adjust the host header to reflect the proxy port.
module.exports = function(proxy) {

  var from_port = proxy.config.from_port;
  var to_port = proxy.config.to_port;

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
