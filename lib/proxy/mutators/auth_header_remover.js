/**
 * Strip the auth header once we have validated the request.
 */
module.exports = function() {
  return function(req, res, next) {
    delete req.headers['authorization'];
    next();
  };
};
