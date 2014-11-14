var Whitelist = require('../../lib/whitelist.js').Whitelist

var config_short = {
	whitelist: {
        methods: ["GET"],
		paths: [
		{
			path: "/livecheck"
		},
		{
			path: "/resources/item",
			methods: "PUT"
		},
		{
			path: "/v2/another/route",
			methods: ["DELETE","POST"]
		}]
	}
}

var config_long = {
	whitelist: {
		paths: [
		{
			path: "/livecheck"
		},
		{
			path: "/resources/item",
			methods: "PUT"
		},
		{
			path: "/v2/another/route",
			methods: ["DELETE","POST"]
		},
		{
			path: "/things/details",
			methods: ["PUT"]
		},
		{
			path: "/things/etails",
			methods: ["PUT"]
		},
		{
			path: "/things/tails",
			methods: ["PUT"]
		},
		{
			path: "/things/ails",
			methods: ["PUT"]
		},
		{
			path: "/things/ils",
			methods: ["PUT"]
		},
		{
			path: "/things/ls",
			methods: ["PUT"]
		},
		{
			path: "/things/[\\d]/s",
			methods: ["PUT"]
		}]
	}
}

var req_simple = { method: "GET",
    parsed_url: {
        pathname: "/livecheck"
    }
}

var req_complex = { method: "PUT",
    parsed_url: {
        pathname: "/things/123/details"
    }
}

var whitelist_short = new Whitelist(config_short);
var whitelist_long = new Whitelist(config_long);

module.exports = {
    name: "Whitelist Parsing",
    tests: {
        'Blanket method matching': function(){
            whitelist_short.applyWhitelist({ 
                method: "GET",
                parsed_url: {
                        pathname: "/livecheck"
                }
            });
        },
        'Path matching on a short list': function(){
            whitelist_short.applyWhitelist({ 
                method: "POST",
                parsed_url: {
                    pathname: "/livecheck"
                }
            });
        },
        'Path matching on a long list': function(){
            whitelist_long.applyWhitelist({ 
                method: "PUT",
                parsed_url: {
                    pathname: "/things/123/s"
                }
            });
        }
    }
}
