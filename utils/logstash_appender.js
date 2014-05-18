var net = require('net');

/**
 * Simple layout parser for logstash message
 *
 * @param logEvt
 * @returns {{@timestamp: string, @fields: {category: (categoryName|*), level: (levelStr|*)}}}
 */
function logstashLayout(logEvt, fields) {
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

    return JSON.stringify(message) + '\n';
}

/**
 * The appender, Gives us the function used for log4js.
 * It Supports batching of commands, we use the json_lines codec for this library,
 * so the \n are mandatory
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
        var client = net.connect({host: config.host, port: config.port}, function () {
            client.write(msg);
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
        //do stuff with the logging event
        var data = layout(logEvt, fields);

        if (config.batch === true) {
            messages.push(data);
            clearTimeout(timeOutId);
            if ((process.hrtime(time)[0] >= config.batchTimeout || messages.length > config.batchSize)) {
                pushToStash(config, messages.join());
                time = process.hrtime();
                messages = [];
            } else {
                timeOutId = setTimeout(function () {
                    pushToStash(config, messages.join());
                    time = process.hrtime();
                    messages = [];
                }, 1000);
            }
        } else {
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