// Adjust the host header to reflect the proxy port.
module.exports = function(proxy) {

  var target_host = proxy.config.target_host;
  var to_port = proxy.config.to_port;

  // The new host header should take the form target_host:to_port unless to_port is 443 or 80.
  var new_port = (to_port === 443 || to_port === 80) ? '' : ':' + to_port;
  var target_hostport = target_host + new_port;

  return function(req, res, next) {
    req.headers['host'] = target_hostport;
    next();
  };
};
