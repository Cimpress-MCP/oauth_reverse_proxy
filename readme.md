oauth_reverse_proxy is an authenticating service proxy that fronts any web server and enforces that callers present the correct OAuth credentials.  

##### Installation

`npm install oauth_reverse_proxy`

##### Description

`oauth_reverse_proxy` works by establishing a proxy that runs on the same server as your application.  All client traffic for a given service is routed to the proxy's inbound port, and the expectation is that you will configure your application to only allow traffic from localhost.  In this way, only authenticated requests will reach your application.

A few key features and design principles:

* Faithfully implements the OAuth spec: This means that any client OAuth library you wish to use will work fine with `oauth_reverse_proxy`.  The [test/clients](https://github.com/Cimpress-MCP/oauth_reverse_proxy/tree/master/test/clients) directory has sample code in 9 languages.
* Built to perform: A single node can authenticate around 10k requests per second on reasonable hardware.
* Flexible enough to front multiple services: If you run more than one HTTP server per system, as is common in the case of an nginx-fronted application, you can put an instance of `oauth_reverse_proxy` either in front of or behind nginx.  A single instance of `oauth_reverse_proxy` can bind a separate proxy to any number of inbound ports.
* Configurable whitelisting: You likely have a load balancer that needs to perform health-checks against your application without performing authentication.  `oauth_reverse_proxy` supports regex-based whitelists, so you can configure an un-authenticated path through to only those routes.

##### A Note About the Security Model

Zero-legged OAuth 1.0a is built on the assumption that a service provider can securely share a consumer key / consumer secret pair with a client.  The creation of these credentials is outside the scope of `oauth_reverse_proxy`.  This project assumes that key issuance will be performed out-of-band.  Just, please, don't use post-its.

##### Configuration

`oauth_reverse_proxy` looks for configuration files in either the location specified in the `OAUTH_REVERSE_PROXY_CONFIG_PATH` environment variable.  Each json file in that directory will be treated as the description of a proxy to run.  Config files are only loaded on start.  Invalid proxy config files are ignored and logged; they do not cause a total failure of `oauth_reverse_proxy`.

###### Configuration Format

    {
        "service_name": "jobsservice",
        "from_port": 8008,
        "to_port": 8080,
        "oauth_secret_dir": "./test/keys/8008/8080/",
        "required_uris": [
            "/getProducts","/uploads","/multipart","/chunked","/compressed","/job","/live","/health","/transactions"
        ],
        "required_hosts": [ "myapp.company.com" ]
    }

The following fields are required in a proxy configuration file:

**service_name** - The name of the service for which we are proxying.  This is used for logging to separate log lines from multiple proxies running within the same process.

**from_port** - The port this proxy will open to the outside world.  All inbound traffic to your service should be directed to this port to ensure that only authenticated requests reach your application.

**to_port** - The port to which this proxy will route authenticated traffic.  This should be a port exposed by your application on the localhost interface so that unauthenticated traffic can not reach your application.

**oauth_secret_dir** - The directory in which consumer key / consumer secret pairs live.  The name of each file in this directory is the consumer key, and the trimmed contents are the consumer secret.

The following fields are optional:

**required_uris** - Sometimes you may have a situation where `oauth_reverse_proxy` is sitting in front of another reverse proxy that is deferring to different systems based on the requested route.  In these cases, you may wish to configure your proxy to only allow access to the routes that match a URI in this list.  This is to prevent client applications from authenticating against your proxy but accessing routes that shouldn't be accessible by this proxy.  The entries in `require_uris` are substrings, not regexes, and they are only considered to match if they match from the start of the route.

**required_hosts** - Sometimes you may have a situation where `oauth_reverse_proxy` is sitting in front of another reverse proxy that is deferring to different systems based on the `Host` header.  In these cases, you may wish to configure your proxy to only allow access to the routes that match a host in this list.  This is to prevent client applications from authenticating against your proxy but accessing hosts that shouldn't be accessible by this proxy.  The entries in `require_hosts` must exactly match the `Host` header of the inbound request, or the request will be rejected..

#### build status

![Travis Build](https://travis-ci.org/Cimpress-MCP/oauth_reverse_proxy.svg)

#### coverage

[![Coverage Status](https://img.shields.io/coveralls/Cimpress-MCP/oauth_reverse_proxy.svg)](https://coveralls.io/r/Cimpress-MCP/oauth_reverse_proxy?branch=master)