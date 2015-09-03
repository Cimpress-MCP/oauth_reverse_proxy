# oauth_reverse_proxy

[![npm version](https://badge.fury.io/js/oauth_reverse_proxy.svg)](http://badge.fury.io/js/oauth_reverse_proxy)
[![Build Status](https://travis-ci.org/Cimpress-MCP/oauth_reverse_proxy.svg?branch=master)](https://travis-ci.org/Cimpress-MCP/oauth_reverse_proxy)
[![Coverage Status](https://img.shields.io/coveralls/Cimpress-MCP/oauth_reverse_proxy.svg)](https://coveralls.io/r/Cimpress-MCP/oauth_reverse_proxy?branch=master)
[![Dependency Status](https://img.shields.io/david/Cimpress-MCP/oauth_reverse_proxy.svg)](https://david-dm.org/Cimpress-MCP/oauth_reverse_proxy)

Layer to add authentication to APIs by checking caller credentials, reverse-proxying inbound traffic to your API, and then signing outbound traffic back to callers.

##### Motivation

Authentication for web applications, particularly applications created for machine-to-machine use, is often an afterthought or implemented in an insecure or incompatible fashion.  We want a robust implementation of OAuth that can run on Windows or Unix systems in front of any HTTP-serving application and support clients written in any language.  These are two-party connections, so we can use the simplest form of OAuth: zero-legged OAuth 1.0a.

##### Installation

Since this project is published with [npm](https://www.npmjs.com/package/oauth_reverse_proxy), the installation and run commands are the same on Windows, OS X, and Linux. Here's a full bash example that includes configuration:

```bash
# Install the versioned node package from the public npm repo
$ npm install oauth_reverse_proxy

# Make a config file for each API
# NOTE default config dir on linux is '/etc/oauth_reverse_proxy.d/'
$ ls $OAUTH_REVERSE_PROXY_CONFIG_DIR
api_1.json	api_2.json

# Make a directory of keys for each API, and generate keys
# NOTE the location of keystore directories comes from api configuration files
$ sudo mkdir /etc/api_1_keystore # api_1.json configured to use this dir
$ uuidgen | sudo tee /etc/api_1_keystore/example_key
$ sudo mkdir /etc/api_2_keystore # api_2.json configured to use this dir
$ uuidgen | sudo tee /etc/api_2_keystore/example_key

# Run the application
$ npm start

# Optional: run the application in PM2 instead, which makes it a system service
$ npm install -g pm2
$ pm2 start index.js --name "oauth_reverse_proxy" --no-daemon

# Optional: view proxy logs
# NOTE default log dir on linux is '/var/log/oauth_reverse_proxy/proxy.log'
$ cat $OAUTH_REVERSE_PROXY_LOG_DIR/proxy.log
```

##### Description

`oauth_[|reverse_]proxy` provides OAuth 1.0a authentication as both a proxy and a reverse proxy.  In proxy mode, outbound requests routed through `oauth_[|reverse_]proxy` are signed before being forwarded to a target.  In reverse proxy mode, inbound requests have their signatures validated before being proxied to your service.  In the reverse proxy case, the expectation is that you will configure your application to only allow traffic from localhost.  In this way, only authenticated requests will reach your application.

A few key features and design principles:

* Faithfully implements the OAuth spec: This means that any client OAuth 1.0a library you wish to use will work fine with `oauth_[|reverse_]proxy`'s reverse proxy, and it means that traffic signed by `oauth_[|reverse_]proxy`'s proxy will work with any OAuth 1.0a-compatible server.  The [test/clients](https://github.com/Cimpress-MCP/oauth_reverse_proxy/tree/master/test/clients) directory has sample code in 9 languages, and more test clients are always welcome.  Test servers are coming soon.
* Built to perform: A single node can authenticate around 10k requests per second on reasonable hardware.
* Supports inbound requests sent over http and https.
* Is flexible enough to front multiple services: If you run more than one HTTP server per system, as is common in the case of an nginx-fronted application, you can put an instance of `oauth_[|reverse_]proxy` either in front of or behind nginx.  A single instance of `oauth_[|reverse_]proxy` can bind separate proxies or reverse proxies to any number of inbound ports.
* Reverse proxy supports configurable whitelisting: You likely have a load balancer that needs to perform health-checks against your application without performing authentication.  `oauth_[|reverse_]proxy` supports regex-based whitelists, so you can configure an un-authenticated path through to only those routes.
* Supports a quota per key, allowing you to define that a given key should only be allowed to make a certain number of hits per a given time interval.
* Supports dynamic provisioning of proxies and keys: Both the proxy configuration and key stores are actively monitored, and `oauth_[|reverse_]proxy` will load new proxy configuration and keys as file system contents change.  This means proxies can be rolled out or reconfigured without restarting the service.  In fact, existing connections to a proxy will not be dropped even if that proxy's configuration changes.

##### A Note About the Security Model

Zero-legged OAuth 1.0a is built on the assumption that a service provider can securely share a consumer key / consumer secret pair with a client.  The creation of these credentials is outside the scope of `oauth_[|reverse_]proxy`.  This project assumes that key issuance will be performed out-of-band and that a secure mechanism exists to convey the consumer secret to the client.

##### Configuration

`oauth_[|reverse_]proxy` looks for configuration files in either the location specified in the `OAUTH_REVERSE_PROXY_CONFIG_DIR` environment variable or in a sane default location (on Unix, that's `/etc/oauth_reverse_proxy.d`, on Windows, it's `C:\ProgramData\oauth_reverse_proxy\config.d\`).  Each json file in that directory will be treated as the description of a proxy to run.  Config files are only loaded on start.  Invalid proxy config files are ignored and logged; they do not cause a total failure of `oauth_[|reverse_]proxy`.

###### Configuration Format

    {
        "service_name": "jobsservice",
        "from_port": 8008,
        "to_port": 8080,
        "oauth_secret_dir": "./test/keys/8008/8080/",
        "required_uris": [
            "/job"
        ],
        "required_hosts": [ "api.cimpress.com" ],
        "whitelist": [
            {
                "path": "/livecheck",
                "methods": [ "GET" ]
            },
            {
                "path": "/healthcheck",
                "methods": [ "GET" ]
            }
        ],
        "quotas": {
            "default_threshold": 10,
            "interval": 60,
            "thresholds" : [{
                "privileged_consumer" : 1000
            },{
                "unprivileged_consumer" : 1
            }]
        },
        "https": {
            "key": "/var/lib/ssl/key.pem",
            "cert": "/var/lib/ssl/cert.pem"
        }
    }

Proxy configuration files must be JSON, must have a filename ending with `.json`, and cannot have a filename beginning with a dot. All other files will be ignored. The following fields are required in a proxy configuration file:

- **service_name** - The name of the service for which we are proxying.  This is used in logging to disambiguate messages for multiple proxies running within the same process.
- **from_port** - The port this proxy will open to the outside world.  In the case of a reverse proxy, all inbound traffic to your service should be directed to this port to ensure that only authenticated requests reach your application.  Note that only one proxy can be bound to any given `from_port`.
- **oauth_secret_dir** - The directory in which consumer key / consumer secret pairs live.  The name of each file in this directory is the consumer key, and the trimmed contents are the consumer secret.  Consumer secrets must satisfy this regular expression: `/^[-_.=a-zA-Z0-9]+$/`.  That is, the consumer secret must be alphanumeric or contain the characters `-`, `_`, `.`, or `=`.  Any secret that does not match this pattern will not be loaded by `oauth_[|reverse_]proxy`.  A warning will be logged, but proxy startup will continue normally.

The following field is required in a reverse proxy configuration file but not in a proxy configuration file:

- **to_port** - The port to which this reverse proxy will route authenticated traffic.  If your proxy and your application run on the same machine, this should be a port exposed by your application only on the localhost interface so that unauthenticated traffic can not reach your application.  Unlike `from_port`, multiple proxies can forward traffic to the same `to_port`.  This may be useful if you wish to expose your proxy over both HTTP and HTTPS.

The following fields are optional for a reverse proxy:

- **target_host** (optional) - By default, a reverse proxy will redirect traffic to the configured `to_port` on localhost.  To support deployment models where `oauth_reverse_proxy` is on a different system than your application, this parameter configures the host to which proxied traffic should be directed.
- **to_port_is_https** (optional) - If the port to which you are proxying traffic is serving https traffic but is not port 443, you need to set this parameter to `true` so that the reverse proxy knows how to open the connection.  The default is `false`.
- **validate_target_cert** (optional) - If the target host is https, this configuration tells the reverse proxy to forward traffic only if the target host presents a valid certificate.  The default is `true`.

The following fields are optional for a proxy or reverse proxy:

- **required_uris** (optional) - Sometimes you may have a situation where `oauth_[|reverse_]proxy` is sitting in front of another reverse proxy that is deferring to different systems based on the requested route.  In these cases, you may wish to configure your proxy to only allow access to the routes that match a URI in this list.  This is to prevent client applications from authenticating against your proxy but accessing routes that shouldn't be accessible by this proxy.  The entries in `require_uris` are substrings, not regexes, and they are only considered to match if they match from the start of the route.
- **required_hosts** (optional) - Sometimes you may have a situation where `oauth_[|reverse_]proxy` is sitting in front of another reverse proxy that is deferring to different systems based on the `Host` header.  In these cases, you may wish to configure your proxy to only allow access to the routes that match a host in this list.  This is to prevent client applications from authenticating against your proxy but accessing hosts that shouldn't be accessible by this proxy.  The entries in `require_hosts` must exactly match the `Host` header of the inbound request, or the request will be rejected.
- **whitelist** (optional) - Sometimes you might want certain routes to be accessible without authentication.  For example, if you expose a health check route to an upstream load balancer, it's unlikely that the load balancer will be able to authenticate those requests.  In these cases, you can whitelist those specific routes that should not require authentication, and `oauth_[|reverse_]proxy` will pass any matching request through to your application.
    - Whitelist is an array of config objects, each defining a path regex and a set of methods.  For a request to be considered valid, it must match both components.  For example, a `path` of "/livecheck" and a `methods` array containing only "GET" would whitelist any `GET` request against the URL path `/livecheck`.  Keep in mind that the regex is interpreted as being between `^` and `$`, so the entire path must match this regex.  A request for `/livecheck/test/a` would be rejected.  If either path or method are omitted, it is assumed that all paths or methods match.
- **quotas** (optional) - The default behavior of `oauth_[|reverse_]proxy` is to allow an unlimited number of requests per key, but sometimes you want to constrain the volume of requests that can be made by consumers.  The quotas object lets you define thresholds for an allowable volume of hits per key per unit time.
    - `interval` specifies the time interval for which quotas apply: an interval of 1 means our quotas are hits-per-second while an interval of 60 specifies hits-per-minute.
    - The `default_threshold` parameter gives us a catch-all for any key that is not given a specific threshold.  If undefined, keys that lack specific thresholds are allowed to make an unbounded number of requests.  In the example above, keys lacking defined thresholds are allowed to make 10 requests per minute.
    - The `thresholds` array contains 0 or more mappings from a consumer key name to the acceptable threshold for that key.  In the example above, the consumer_key "privileged_key" is allowed to make 1000 requests per second while "unprivileged_key" can only make 1 request per minute.
- **https** (optional) - The default behavior of `oauth_[|reverse_]proxy` is to listen on an HTTP socket.  If you wish to use HTTPS instead, you must specify an `https` object in the configuration for the proxy, providing a path to both a key and certificate pem file.  Note that both a key and cert must be provided or the proxy will not be created.

#### Planned Features ####

You can find the TODO list for upcoming features [here](todo.md).
