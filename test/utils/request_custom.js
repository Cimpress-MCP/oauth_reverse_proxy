var Request = require('request');

/**
 * Comment out the parts of request.js that automatically set a form-urlencoded
 * request to be `charset=utf-8` in this overriden defintion.
 * Refer to https://github.com/request/request/commit/86571c794b75bb637b39eb7574e825e461647151
 */
Request.prototype.form = undefined;
Request.prototype.form = function (form) {
  var self = this
  if (form) {
    // if (!/^application\/x-www-form-urlencoded\b/.test(self.getHeader('content-type'))) {
    //   self.setHeader('content-type', 'application/x-www-form-urlencoded')
    // }
    // self.body = (typeof form === 'string')
    //   ? self._qs.rfc3986(form.toString('utf8'))
    //   : self._qs.stringify(form).toString('utf8')
    // return self
    return self.body = form
  }
  // create form-data object
  self._form = new FormData()
  self._form.on('error', function(err) {
    err.message = 'form-data: ' + err.message
    self.emit('error', err)
    self.abort()
  })
  console.log('NOTICE: Using custom request.js library with overriden Request.prototype.form()')
  return self._form
}

module.exports = Request;
