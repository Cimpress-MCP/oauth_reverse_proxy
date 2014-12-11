var fs = require('fs');
var util = require('util');

var logger = require('../logger.js');

/**
 * The proxy config is a representation of a JSON configuration file from the oauth_reverse_proxy
 * config directory.  This class is responsible for exposing only those fields in the JSON that
 * map to valid proxy configuration and for validating that the configuration is legitimate.
 */
function ProxyConfig(config) {
	var this_obj = this;

	// We want all of these parameters to be immutable.  While writeable defaults to false, having it explicitly
	// set here is good for readability.
	Object.defineProperty(this_obj, 'service_name', { 'value': config.service_name, writable: false });
	Object.defineProperty(this_obj, 'from_port', { 'value': config.from_port, writable: false });
	Object.defineProperty(this_obj, 'to_port', { 'value': config.to_port, writable: false });
	Object.defineProperty(this_obj, 'oauth_secret_dir', { 'value': config.oauth_secret_dir, writable: false });

	// An optional list of allowed Host header or URI path parameters can be specified as environment
	// variables.  Each of these is a substring match with no wildcards.  A string that matches the
	// substring is allowed.  All others are rejected.  Multiple of either setting can be provided.
	Object.defineProperty(this_obj, 'required_uris', { 'value': config.required_uris, writable: false });
	Object.defineProperty(this_obj, 'required_hosts', { 'value': config.required_hosts, writable: false });

	// Use a default whitelist config if none is provided.
	var whitelist = config.whitelist || {
		paths: [{
	        path: "/livecheck",
	        methods: [ "GET" ]
	    },
	    {
	        path: "healthcheck",
	        methods: [ "GET" ]
	    }]
	};

	Object.defineProperty(this_obj, 'whitelist', { 'value': whitelist, writable: false });
}

function error(msg) {
	logger.error(msg);
	return false;
}

ProxyConfig.prototype.isValid = function() {

	if (!this.service_name) return error("Proxy configuration lacks service_name");
	if (!this.from_port) return error("Proxy configuration lacks from_port");
	if (!this.to_port) return error("Proxy configuration lacks to_port");
	if (this.from_port === this.to_port) return error("from_port and to_port can not be identical");
	if (this.whitelist == null || this.whitelist == undefined) return error("Whitelist must be defined");

	return true;
};

module.exports = ProxyConfig;
