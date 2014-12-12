var fs = require('fs');

var Whitelist = require('../../lib/proxy/whitelist.js');

var config_short = JSON.parse(fs.readFileSync('./test/resources/short_whitelist.json', {'encoding':'utf8'}));
var config_long = JSON.parse(fs.readFileSync('./test/resources/long_whitelist.json', {'encoding':'utf8'}));

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
