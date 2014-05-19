var log4js = require('log4js');
var sprintf = require('./sprintf.js').sprintf;

log4js.configure('vistaprint_log4js.json');

var logstash_appender = require('./logstash_appender.js').configure({
  type: "log4js-logstash",
  host: "localhost",
  port: 5140,
  blatch: {
    size: 20,
    timeout: 1000
  },
  fields: {
    hostname: require('os').hostname(),
    source: "auspice"
  }
});

log4js.addAppender(logstash_appender);

/**
 * Wraps log4js loggers and provides sprintf capabilities for each of the standard log levels.
 * This allows for an arbitrary number of command line parameters composed into the log messaage,
 * but composition only happens if the current log level is enabled.
 *
 * getLogger expects a categoryName.  Typically this is the name of the module in which the logger
 * is requested.
 *
 * config_file is an optional parameter which clears all appenders and replaces them with the
 * configuration found in the provided file.  If this string is blank, log4js will search for a
 * log4js.json somewhere in the require paths.
 */
exports.getLogger = function(categoryName, config_file) {
        if (config_file !== undefined) {
                log4js.clearAppenders();
                log4js.configure(config_file);
        }

        var _logger = log4js.getLogger(categoryName || '[default]');

        // Note: With each of the logging functions, if called with one argument we will force the argument
        // through a %s format.  This avoids nasty bugs if the argument happens to contain % characters, which
        // will be incorrectly interpreted as the start of a format specifier.
        var adjustArguments = function(arguments) {
                if (arguments.length === 1) {
                        return ["%s", arguments[0]];
                } else {
                        return arguments;
                }
        };

        return {
                trace: function() {
                        if(_logger.isTraceEnabled()) _logger.trace(sprintf.apply(this, adjustArguments(arguments)));
                },

                debug: function() {
                        if(_logger.isDebugEnabled()) _logger.debug(sprintf.apply(this, adjustArguments(arguments)));
                },

                info: function() {
                        if(_logger.isInfoEnabled()) _logger.info(sprintf.apply(this, adjustArguments(arguments)));
                },

                warn: function() {
                        if(_logger.isWarnEnabled()) _logger.warn(sprintf.apply(this, adjustArguments(arguments)));
                },

                error: function() {
                        if(_logger.isErrorEnabled()) _logger.error(sprintf.apply(this, adjustArguments(arguments)));
                },

                fatal: function() {
                        var message = sprintf.apply(this, adjustArguments(arguments));

                        // FIXME: Create a similar escalation mechanism for FATALs
                        // require('../ot/stat_collector.js').sendErrorMessage(require('../config.js').getState().site.id, message);
                        if(_logger.isFatalEnabled()) _logger.fatal(message);
                }
        };
};