var net = require('net');

/**
 * Simple layout parser for logstash message
 *
 * @param logEvt
 * @returns {{@timestamp: string, @fields: {category: (categoryName|*), level: (levelStr|*)}}}
 */
function logstashLayout(logEvt, fields, batch) {
    var key,
        message = {
            '@timestamp': (new Date()).toISOString(),
            '@fields': {
                category: logEvt.categoryName,
                level: logEvt.level.levelStr
            },
            '@message': logEvt.data[0]
        };

    for (key in fields) {
        if (typeof fields[key] !== 'function') {
            message['@fields'][key] = fields[key];
        }
    }

    return JSON.stringify(message);
}

/**
 * The appender, Gives us the function used for log4js.
 * It supports batching of messages using the json_lines codec but individual messages
 * can be sent using the json codec.
 *
 * @param config
 * @param fields
 * @param layout
 * @returns {Function}
 */
function logStashAppender(config, fields, layout) {
    var time = process.hrtime(),
        messages = [],
        timeOutId = 0;

    layout = layout || logstashLayout;

    //Setup the connection to logstash
    function pushToStash(config, msg) {
      
        //console.log("Writing to stash:\n" + msg);
      
        var client = net.connect({host: config.host, port: config.port}, function () {
            client.write(msg);
            if (config.batch == undefined) client.write('\n');
            client.end();
        });
        //Fail silently
        client.on('error', function (evt) {
            if (true === config.debug) {
                console.log('An error happend in the lostash appender!', evt);
            }
        });
    }

    return function (logEvt) {

        if (config.batch === true) {
          //do stuff with the logging event
          var data = layout(logEvt, fields, true);
            messages.push(data);
            clearTimeout(timeOutId);
            if ((process.hrtime(time)[0] >= config.batchTimeout || messages.length > config.batchSize)) {
                pushToStash(config, messages.join('\n'));
                time = process.hrtime();
                messages = [];
            } else {
                timeOutId = setTimeout(function () {
                    pushToStash(config, messages.join('\n'));
                    time = process.hrtime();
                    messages = [];
                }, 10000);
            }
        } else {
            //do stuff with the logging event
            var data = layout(logEvt, fields, false);
            pushToStash(config, data);
        }
    };
}

/**
 * Config method, calls logStashAppender to return the logging function
 *
 * @param config
 * @returns {Function}
 */
function configure(config) {
    var key,
        layout = null,
        fields = {},
        options = {
            port: (typeof config.port === "number") ? config.port : 5959,
            host: (typeof config.host === "string") ? config.host : 'localhost',
            debug: config.debug || false
        };

    if (config.batch) {
        options.batch = true;
        options.batchSize = config.batch.size;
        options.batchTimeout = config.batch.timeout;
    }

    if (config.fields && typeof config.fields === 'object') {
        for (key in config.fields) {
            if (typeof config.fields[key] !== 'function') {
                fields[key] = config.fields[key];
            }
        }
    }
    return logStashAppender(options, fields, layout);
}

exports.appender = logStashAppender;
exports.configure = configure;