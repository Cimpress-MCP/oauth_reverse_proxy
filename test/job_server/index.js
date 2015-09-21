var express = require('express');
var app = express();
var fs = require('fs');
var util = require('util');
var path = require('path');
var body_parser = require('body-parser');
var multer  = require('multer');
var compress = require('compression');

app.use(multer().fields([{'name':'binary_data'}]));
app.use(body_parser.urlencoded({extended: false}));
app.use(body_parser.json());

// Save ourselves the pain and emotional trauma of having to worry about verb case while looping.
app.GET = app.get;
app.POST = app.post;
app.PUT = app.put;
app.DELETE = app.delete;

const CONSUMER_KEY_HEADER = require('../../lib/proxy/oauth/constants.js').CONSUMER_KEY_HEADER;

// The job server represents they types of servers we might expect to see behind oauth_reverse_proxy.
function JobServer() {
  var this_obj = this;

  ['GET', 'DELETE'].forEach(function(verb) {
    app[verb]("/job/:job_id", function(req, res) {
      res.setHeader('Content-Type', 'application/json');
      console.log('%s with key %s', verb, req.headers[CONSUMER_KEY_HEADER]);
      this_obj.emit(verb + " /job", req, res);
      res.send({'status':'ok'});
    });
  });

  app.get("/livecheck", function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    console.log('GET /livecheck');
    this_obj.emit('GET /livecheck', req, res);
    res.send({'status':'ok'});
  });

  app.get("/healthcheck", function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    console.log('GET /healthcheck');
    this_obj.emit('GET /healthcheck', req, res);
    res.send({'status':'ok'});
  });

  // wonky looking path to test encoding
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
    app[verb]('/%7bwonky%20path%7d/is&wonky', function(req, res, next) {
      res.setHeader('Content-Type', 'application/json');
      console.log('%s /{wonky path}/is&wonky with key %s', verb.toUpperCase(), req.headers[CONSUMER_KEY_HEADER]);
      this_obj.emit(verb + ' /{wonky path}/is&wonky', req, res);
      res.send({'status':'ok'});
    });
  });

  // /compressed_content returns gziped content
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
    app[verb]('/compressed_content', function(req, res, next) {

      res.setHeader('Content-Type', 'text/plain');
      console.log('%s /compressed_content with key %s', verb.toUpperCase(), req.headers[CONSUMER_KEY_HEADER]);

      compress()(req, res, function() {
        res.write(fs.readFileSync('./test/resources/lorem_ipsum.txt'), 'utf8');
        res.end();
      });
    });
  });

  // /transactions simulates an endpoint that might return a large, chunked response.
  ['GET', 'POST', 'PUT', 'DELETE'].forEach(function(verb) {
    app[verb]('/transactions', function(req, res) {

      res.setHeader('Content-Type', 'application/json');
      console.log('%s /transactions with key %s', verb.toUpperCase(), req.headers[CONSUMER_KEY_HEADER]);

      // Generate a sizeable chunk of json that will be chunked and returned
      res.write('{\n\t"jobs_list":[');

      for (var i=0; i<1000; ++i) {
        res.write('\t\t"job": ');
        res.write('' + i);
        res.write(',\n');
      }

      process.nextTick(function() {
        res.write('\t\t"job": 1000\n\t]\n}');

        this_obj.emit(verb.toUpperCase() + " /transactions", req, res);
        res.end();
      });
    });
  });

  app.POST('/getProducts', function(req, res) {
    console.log('POST /getProducts with key %s', req.headers[CONSUMER_KEY_HEADER]);

    var data = '';

    req.on('data', function (chunk) {
        data += chunk;
    });

    req.on('end', function () {
      req.body = data;
      this_obj.emit('POST /getProducts', req, res);
      res.sendFile(path.resolve('./test/resources/list_of_products.xml'));
    });


  });

  ['POST', 'PUT'].forEach(function(verb) {

    app[verb]("/job", function(req, res) {
      res.setHeader('Content-Type', 'application/json');
      console.log('%s with key %s', verb, req.headers[CONSUMER_KEY_HEADER]);
      this_obj.emit(verb + " /job", req, res);
      res.send({'status':'ok'});
    });

    // /uploads simulates an endpoint that receives multipart form data for posts and puts
    app[verb]('/uploads', function(req, res) {
      console.log('%s /uploads with key %s', verb.toUpperCase(), req.headers[CONSUMER_KEY_HEADER]);

      var file_path = './test/resources/' + req.files['binary_data'][0].originalname;
      var expected_length = req.files['binary_data'][0].size;

      var is_file_complete = function(cb) {
        fs.stat(file_path, function(err, stat) {
          if (err) return cb(false);
          return cb(stat.size === expected_length);
        });
      };

      var poll_file = function() {
        is_file_complete(function(complete) {
          if (complete) {
            this_obj.emit(verb.toUpperCase() + " /uploads", req, res);
            res.sendfile(file_path);
          } else {
            // If the file is not completely loaded, pause 10ms and try again
            setTimeout(poll_file, 10);
          }
        });
      };
      poll_file();
    });
  });
}

// Configure JobServer as an event emitter and export a new instance.
util.inherits(JobServer, require('events').EventEmitter);
module.exports = new JobServer();

// Init the test server, if necessary.
var initted = false;
module.exports.init = function(port, cb) {
  // If we're already initted, drop out here.
  if (initted) return cb();
  initted = true;
  app.listen(port, '::', function(err) {
    cb(err);
  });
};
