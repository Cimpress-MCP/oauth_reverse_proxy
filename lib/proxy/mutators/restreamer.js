var connect_restreamer = require('connect-restreamer')({stringify:require('querystring').stringify});

module.exports = function() {
  return function(req, res, next) {
    if (req.headers && req.headers['content-type'] &&
        req.headers['content-type'].indexOf('application/x-www-form-urlencoded') === 0) {
      // Reconstitute form body only if necessary.
      connect_restreamer(req, res, next);
    } else {
      next();
    }
  };
}
