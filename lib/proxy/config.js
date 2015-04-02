var fs = require('fs');
var util = require('util');

var _ = require('underscore');

/**
 * The proxy config is a representation of a JSON configuration file from the oauth_reverse_proxy
 * config directory.  This class is responsible for exposing only those fields in the JSON that
 * map to valid proxy configuration and for validating that the configuration is legitimate.
 */
function ProxyConfig(config) {
    var this_obj = this;

    // oauth_[reverse_|]proxy supports two modes of operation: a proxy for signing outbound requests on behalf
    // of clients and a reverse proxy for authenticating requests before they reach a server.  The default is
    // reverse proxy.
    var mode = 'reverse_proxy';
    if (config.mode === 'proxy') mode = config.mode;
    Object.defineProperty(this_obj, 'mode', { 'value': mode, writable: false, enumerable: true });

    // We want all of these parameters to be immutable.  While writeable defaults to false, having it explicitly
    // set here is good for readability.
    Object.defineProperty(this_obj, 'service_name', { 'value': config.service_name, writable: false, enumerable: true });
    Object.defineProperty(this_obj, 'from_port', { 'value': config.from_port, writable: false, enumerable: true });
    Object.defineProperty(this_obj, 'to_port', { 'value': config.to_port, writable: false, enumerable: true });
    Object.defineProperty(this_obj, 'oauth_secret_dir', { 'value': config.oauth_secret_dir, writable: false, enumerable: true });

    // An optional list of allowed Host header or URI path parameters can be specified as environment
    // variables.  Each of these is a substring match with no wildcards.  A string that matches the
    // substring is allowed.  All others are rejected.  Multiple of either setting can be provided.
    Object.defineProperty(this_obj, 'required_uris', { 'value': config.required_uris, writable: false, enumerable: true });
    Object.defineProperty(this_obj, 'required_hosts', { 'value': config.required_hosts, writable: false, enumerable: true });

    // Whether this proxy listens on an HTTPS socket on from_port.  Defaults to false.
    Object.defineProperty(this_obj, 'https', { 'value': config.https != undefined || false, writable: false, enumerable: true });
    if (this_obj.https) {
      Object.defineProperty(this_obj, 'https_key_file', { 'value': config.https.key, writable: false, enumerable: true });
      Object.defineProperty(this_obj, 'https_cert_file', { 'value': config.https.cert, writable: false, enumerable: true });
    }

    // An optional object defining quotas to apply to inbound requests.
    Object.defineProperty(this_obj, 'quotas', { 'value': (config.quotas || {thresholds:{}}), writable: false, enumerable: true});

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

    Object.defineProperty(this_obj, 'whitelist', { 'value': whitelist, writable: false, enumerable: true });
}

/**
 * Performs a deep comparison of proxy configs and returns true iff configurations are identical.
 */
ProxyConfig.prototype.equals = function(other_proxy_config) {
  return _.isEqual(this, other_proxy_config);
};

/**
 * Returns true if we are in 'reverse_proxy' mode, false else.
 */
ProxyConfig.prototype.isReverseProxy = function() {
  return this.mode === 'reverse_proxy';
};

/**
 * Returns a string matching the first validation that failed when evaluating this proxy config or returns
 * undefined if the configuration is valid.
 */
ProxyConfig.prototype.isInvalid = function() {

    if (!this.service_name)
      return "proxy configuration lacks service_name";
    if (!this.from_port)
      return "proxy configuration lacks from_port";

    // A reverse proxy needs a to_port.
    if (!this.to_port && this.isReverseProxy())
      return "proxy configuration lacks to_port";
    // A proxy shouldn't have a to_port: the to_port is contained in the URLs sent to the proxy.
    if (this.to_port && !this.isReverseProxy())
      return "proxy configuration has a to_port and shouldn't";

    if (this.from_port === this.to_port)
      return "from_port and to_port can not be identical";

    // Validate quota config, if present
    if (this.quotas !== undefined) {
      if (this.quotas.interval !== undefined) {
        var interval = parseInt(this.quotas.interval);
        if (isNaN(interval))
          return "quotas.interval must be a number";
        if (interval < 1)
          return "minimum quotas.interval is 1 second";
      }

      if (this.quotas.default_threshold !== undefined) {
        var default_threshold = parseInt(this.quotas.default_threshold);
        if (isNaN(default_threshold))
          return "quotas.default_threshold must be a number";
        if (default_threshold <= 0)
          return "quotas.default_threshold must be positive";
      }

      if (this.quotas.thresholds !== undefined) {
        for (var key in this.quotas.thresholds) {
          var threshold = parseInt(this.quotas.thresholds[key]);
          if (isNaN(threshold))
            return key + " quota threshold must be a number";
          if (threshold <= 0)
            return key + " quota threshold must be positive";
        }
      }
    }

    if (this.https) {
      // Validate that the key and cert files exist
      if (this.https_key_file == undefined)
        return "no ssl key file provided";

      try {
        fs.statSync(this.https_key_file);
      } catch(e) {
        return "https key file " + this.https_key_file + " does not exist";
      }

      if (this.https_cert_file == undefined)
        return "no ssl cert file provided";

      try {
        fs.statSync(this.https_cert_file);
      } catch(e) {
        return "https cert file " + this.https_cert_file + " does not exist";
      }
    }

    var my_from_port = parseInt(this.from_port);
    if (isNaN(my_from_port))
      return "from_port must be a number";
    if (my_from_port > 65535 || my_from_port < 1)
      return "from_port must be a valid port number";

    if (this.isReverseProxy()) {
      var my_to_port = parseInt(this.to_port);
      if (isNaN(my_to_port))
        return "to_port must be a number";
      if (my_to_port > 65535 || my_to_port < 1)
        return "to_port must be a valid port number";
    }

    return undefined;
};

module.exports = ProxyConfig;
