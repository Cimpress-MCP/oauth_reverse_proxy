var _ = require('underscore');
var util = require('util');

var sprintf = require('../sprintf.js').sprintf;
var logger = require('../logger.js');

function Whitelist (config) {
  Object.defineProperty(this, 'whitelist', {value: config.whitelist});
}

// See if our requested path is found in the whitelist
Whitelist.prototype._findMatchingPath = function (path) {    
    return _.find(this.whitelist.paths, function(path_object) {
        var path_regex = new RegExp("^" + path_object.path + "$", "i");
        return (path.match(path_regex) !== null);
    });
}

// Check if our requested method has been allowed for this path
Whitelist.prototype._passesMethodsForPath = function (path, method) {
    // If the request's path is in the whitelist, ensure our method is.
    if ("methods" in path) {
        if(Array.isArray(path.methods) && path.methods.indexOf(method) !== -1) {
            return true
        }
        else if(typeof path.methods === "string" && path.methods === method) {
            return true
        }
    }
    else {
        return true
    }
    
    return false;
}

// Check if the requested method has been blanket whitelisted
Whitelist.prototype._passesMethodsWhitelist = function (method) {
    if ("methods" in this.whitelist) {
        if (typeof this.whitelist.methods === "string" && this.whitelist.methods === method) {
            return true
        }
        else if (Array.isArray(this.whitelist.methods) && this.whitelist.methods.indexOf(method) !== -1)  {
            return true
        }
    }
    
    return false
}

// Check if the requested path AND method has been whitelisted
Whitelist.prototype._passesPathsWhitelist = function (path, method) {
    if ("paths" in this.whitelist) {
        if(Array.isArray(this.whitelist.paths)) {
            var current_path = this._findMatchingPath(path);
        
            if (current_path !== undefined) {
                return this._passesMethodsForPath(current_path, method);
            }
        }
    }
    
    return false;
}

Whitelist.prototype.applyWhitelist = function(req){
    return (this._passesMethodsWhitelist(req.method) 
            || this._passesPathsWhitelist(req.parsed_url.pathname, req.method));
}

/**
 * Use the whitelist to decide if we should let the request through unauthenticated
 */
exports.applyWhitelist = function(config) {
    var whitelist = new Whitelist(config);
    
    return function(req,res,next) {
        req.whitelist_passed = whitelist.applyWhitelist(req);
          
        if(req.whitelist_passed) {
            logger.info("Proxying URL %s %s%s WHITELIST", req.method, req.headers.host, req.url);
        }

        return next();
    };
};

exports.Whitelist = Whitelist;