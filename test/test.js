var should = require('should');

var fs = require('fs');
var util = require('util');

var job_server = require(__dirname + '/server/job_server.js');
var job_server_started = false;
job_server.on('started', function() {
  job_server_started = true;
});
var keygen = require(__dirname + '/keygen/');

var http = require('http');
var exec = require('child_process').exec;

describe('Jobs Server', function() {
  
  before(function(done) {
    setTimeout(function() {
      if (job_server_started) return done();
    }, 50);
  });
  
  describe('Unauthenticated GET /job from localhost', function() {
    it ('should return a valid response', function(done) {      
      http.get('http://localhost:8888/job', function(res) {
        res.statusCode.should.equal(200);
        done()
      });
    });
  });
  
  describe('Unauthenticated POST /job from localhost', function() {
    it ('should return a valid response', function(done) {
      
      var content = 'data=happy';
      var options = {
        port: 8888,
        path: '/job',
        method: 'POST',
        
        headers: [
          { 'content-type' : 'x-www-form-urlencoded' },
          { 'content-length' : content.length }
        ]
      };

      var data = '';
      var req = http.request(options, function(res) {
        res.on('data', function (chunk) {
          data += chunk;
        });
        
        res.on('end', function(err) {
          data.should.equal('{"status":"ok"}');
          res.statusCode.should.equal(200);
          done();
        });
      });

      req.on('error', function(e) {
        done(e);
      });

      // write data to request body
      req.write('data=happy');
      req.end();
    });
  });
});

// Auspice is an authenticating proxy.  Let's describe it.
describe('Auspice', function() {
  
  // But first, create the keys we need for test clients.
  before(function(done) {
    keygen.createKey(__dirname + '/keys', 8000, 8888, 'bash-test-key', function(err) {
      keygen.createKey(__dirname + '/keys', 8000, 8888, 'dotnet-test-key', function(err) {
        keygen.createKey(__dirname + '/keys', 8000, 8888, 'java-test-key', function(err) {
          keygen.createKey(__dirname + '/keys', 8000, 8888, 'node-test-key', function(err) {
            keygen.createKey(__dirname + '/keys', 8000, 8888, 'perl-test-key', function(err) {
              keygen.createKey(__dirname + '/keys', 8000, 8888, 'powershell-test-key', function(err) {
                keygen.createKey(__dirname + '/keys', 8000, 8888, 'python-test-key', function(err) {
                  keygen.createKey(__dirname + '/keys', 8000, 8888, 'ruby-test-key', function(err) {
                    done(err);
                  });
                });
              });
            });
          });
        });
      });
    });
  });
  
  var auspice_started = false;
  describe('proxy', function() {
    it ('should start cleanly', function(done) {
      var auspice = require(__dirname + '/../lib');
      auspice.init(__dirname + '/keys', function(err, proxy) {
        if (err) return should.fail('Auspice startup failed: ' + err);
        
        var keys_count = 0;
        for (var key_name in proxy.keys) {
          ++keys_count;
        }
        
        (keys_count).should.be.exactly(8);    
        auspice_started = true;
        done();    
      });
    });
    
    it ('should service requests from a bash client', function(done) {
      exec('bash client.sh', {cwd: 'test/clients/bash'}, function(err, stderr, stdout) {
        if (err) return done(err);
        done();
      });
    });
    
    it ('should service requests from a node client', function(done) {
      exec('node client.js', {cwd: 'test/clients/node'}, function(err, stderr, stdout) {
        if (err) return done(err);
        done();
      });
    });
    
    it ('should service requests from a python client', function(done) {
      exec('python client.py', {cwd: 'test/clients/python'}, function(err, stderr, stdout) {
        if (err) return done(err);
        done();
      });
    });
  });
});
