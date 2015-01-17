var fs = require('fs');
var util = require('util');

var logger = require('../logger.js').getLogger();

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

    // An optional object defining quotas to apply to inbound requests.
    Object.defineProperty(this_obj, 'quotas', { 'value': (config.quotas || {thresholds:{}}), writable: false});

    // Use a default whitelist config if none is provided.
    var whitelist = config.whitelist ||
        [{
            path: "/livecheck",
            methods: [ "GET" ]
        },
        {
            path: "/healthcheck",
            methods: [ "GET" ]
        }];

    Object.defineProperty(this_obj, 'whitelist', { 'value': whitelist, writable: false });
}

/**
 * Returns a string matching the first validation that failed when evaluating this proxy config or returns
 * undefined if the configuration is valid.
 */
ProxyConfig.prototype.isInvalid = function() {

    if (!this.service_name)
      return "proxy configuration lacks service_name";
    if (!this.from_port)
      return "proxy configuration lacks from_port";
    if (!this.to_port)
      return "proxy configuration lacks to_port";
    if (this.from_port === this.to_port)
      return "from_port and to_port can not be identical";

    // Validate quota config, if present
    if (this.quotas) {
      if (this.quotas.interval) {
        var interval = parseInt(this.quotas.interval);
        if (isNaN(interval))
          return "quota.interval must be a number";
        if (interval < 1)
          return "minimum quota.interval is 1 second";
      }

      if (this.quotas.default_threshold) {
        var default_threshold = parseInt(this.quotas.default_threshold);
        if (isNaN(default_threshold))
          return "quota.default_threshold must be a number";
        if (default_threshold <= 0)
          return "quota.default_threshold must be positive";
      }

      if (this.quotas.thresholds) {
        for (var key in this.quotas.thresholds) {
          var threshold = parseInt(this.quotas.thresholds[key]);
          if (isNaN(threshold))
            return key + " threshold must be a number";
          if (threshold <= 0)
            return key + " threshold must be positive";
        }
      }
    }

    var my_from_port = parseInt(this.from_port);
    var my_to_port = parseInt(this.to_port);

    if (isNaN(my_from_port))
      return "from_port must be a number";
    if (isNaN(my_to_port))
      return "to_port must be a number";

    if (my_from_port > 65535 || my_from_port < 1)
      return "from_port must be a valid port number";
    if (my_to_port > 65535 || my_to_port < 1)
      return "to_port must be a valid port number";

    return undefined;
};

module.exports = ProxyConfig;
