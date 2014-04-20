var util = require('util');
var httpProxy = require('http-proxy');
var authenticator = require('./lib/authenticator.js');

var logger = require('./utils/logger.js').getLogger('auspice');

var proxy = httpProxy.createProxyServer({});

var server = require('http').createServer(function(req, res) {
  logger.info("Got req:\n%s", util.inspect(req.headers.authorization));
  authenticator.authenticateRequest(req, function(err) {
    if (err) {
      res.writeHead(401);
      res.write(err);
      return res.end();
    }
    proxy.web(req, res, { target: 'http://localhost:8080/'});
  });

});

server.listen(8000);