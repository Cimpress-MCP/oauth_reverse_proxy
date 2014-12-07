var fs = require('fs');
var util = require('util');

var logger = require('../logger.js');

/**
 * The proxy config is a representation of a JSON configuration file from the Auspice
 * config directory.  This class is responsible for exposing only those fields in the
 * JSON that map to valid proxy configuration and for validating that the configuration
 * is legitimate.
 */
function ProxyConfig(config) {
	var this_obj = this;

	// We want all of these parameters to be immutable.
	Object.defineProperty(this_obj, 'from_port', { 'value': config.from_port, writable: false });
	Object.defineProperty(this_obj, 'to_port', { 'value': config.to_port, writable: false });
	Object.defineProperty(this_obj, 'keystore', { 'value': config.keystore, writable: false });

	// Use a default whitelist config if none is provided.
	var whitelist = config.whitelist || [{
        path: "/livecheck",
        methods: [ "GET" ]
    },
    {
        path: "healthcheck",
        methods: [ "GET" ]
    }];

	Object.defineProperty(this_obj, 'whitelist', { 'value': whitelist, writable: false });
}

function error(msg) {
	logger.error(msg);
	return false;
}

ProxyConfig.prototype.validate = function() {

	if (!this.from_port) return error("Proxy configuration lacks from_port");
	if (!this.to_port) return error("Proxy configuration lacks to_port");
	if (this.from_port === this.to_port) return error("from_port and to_port can not be identical");
	if (this.whitelist == null || this.whitelist == undefined) return error("Whitelist must be defined");
	if (!util.isArray(this.whitelist)) return error("Whitelist must be an array");

	return true;
};

var pc = new ProxyConfig({
	'from_port': 8888,
	'to_port': 7000,
	'keystore': '/var/lib/auspice/8888/7000'
});

logger.info(pc.from_port);
logger.info(pc.validate());
