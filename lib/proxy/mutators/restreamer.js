var stringify = require('querystring').stringify;

module.exports = function() {
  return function(req, res, next) {

    // Reconstitute form body only if necessary.
    if (req.headers && req.headers['content-type'] &&
        req.headers['content-type'].indexOf('application/x-www-form-urlencoded') === 0) {
      req.removeAllListeners('data')
      req.removeAllListeners('end')
      if (req.headers['content-length'] !== undefined) {
        req.headers['content-length'] = Buffer.byteLength(stringify(req['body']), 'utf8')
      }
      process.nextTick(function () {
        if (req['body']) {
          req.emit('data', stringify(req['body']))
        }
        req.emit('end');
      })
      next()

    } else {
      next();
    }
  };
}
