oauth_reverse_proxy is an authenticating service proxy that fronts any web server and enforces that callers present the correct OAuth credentials.  

##### Installation

`npm install oauth_reverse_proxy`

##### Description

`oauth_reverse_proxy` works by establishing a proxy that runs on the same server as your application.  All client traffic for a given service is routed to the proxy's inbound port, and the expectation is that you will configure your application to only allow traffic from localhost.  In this way, only authenticated requests will reach your application.

A few key features and design principles:

* Faithfully implements the OAuth spec: This means that any client OAuth library you wish to use will work fine with `oauth_reverse_proxy`.  The [test/clients](https://github.com/Cimpress-MCP/oauth_reverse_proxy/tree/master/test/clients) directory has sample code in 9 languages.
* Built to perform: A single node can authenticate around 10k requests per second on reasonable hardware.

##### A Note About the Security Model

Zero-legged OAuth 1.0a is built on the assumption that a service provider can securely share a consumer key / consumer secret pair with a client.  The creation of these credentials is outside the scope of `oauth_reverse_proxy`.  This project assumes that key issuance will be performed out-of-band.  Just, please, don't use post-its.

##### Configuration

`oauth_reverse_proxy` looks for configuration files in either the location specified in the `OAUTH_REVERSE_PROXY_CONFIG_PATH` environment variable.  Each json file in that directory will be treated as the description of a proxy to run.

###### Configuration Format

    {
        "service_name": "jobsservice",
        "from_port": 8008,
        "to_port": 8080,
        "oauth_secret_dir": "./test/keys/8008/8080/",
        "required_uris": [
            "/getProducts","/uploads","/multipart","/chunked","/compressed","/job","/live","/health","/transactions"
        ],
        "required_hosts": [ "localhost", "::1" ]
    }


#### build status

![Travis Build](https://travis-ci.org/Cimpress-MCP/oauth_reverse_proxy.svg)

#### coverage

[![Coverage Status](https://img.shields.io/coveralls/Cimpress-MCP/oauth_reverse_proxy.svg)](https://coveralls.io/r/Cimpress-MCP/oauth_reverse_proxy?branch=master)