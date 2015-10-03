var should = require('should');

var _ = require('underscore');

var exec = require('child_process').exec;
var os = require('os');

var job_server = require('./job_server/');

require('./bootstrap_test.js');

// Creates a convenience function for running an external client and validating that the correct
// key is passed to the job server and the correct content is written to disk.
var create_client_test = function(verb, cmd, cwd, key) {
  return function(cb) {
    job_server.once(verb, function(uri, req, res) {
      req.headers.should.have.property('vp_user_key', key);
    });

    exec(cmd, {cwd: cwd}, function(err, stdout, stderr) {
      if (err) return cb(err);
      stderr.should.equal('');
      stdout.trim().should.equal('{"status":"ok"}');
      cb();
    });
  };
};

// These test clients are in the test/clients subdirectory.  Each one tests a limited amount of OAuth
// functionality to validate that requests can be sent through auth_proxy properly using various languages.
describe('An OAuth-compliant reverse proxy', function() {

  // TODO: Refactor these tests so they auto-detect if they can be run on the host system.  This would simplify
  // the platform-specific logic in here and allow for successful tests with less lengthy setup on CI.
  it ('should support requests from Ruby clients', function(done) {
    var rubyTest = create_client_test('GET', 'ruby client.rb', 'test/clients/ruby', 'ruby-test-key')
    rubyTest(done);
  });

  it ('should support requests from Java clients', function(done) {
    var javaTest = create_client_test('POST',
      'java -cp target/OAuthClient-1.0-SNAPSHOT-jar-with-dependencies.jar com.cimpress.mcp.oauth.OAuthClient',
      'test/clients/java/OAuthClient', 'java-test-key')
    javaTest(done);
  });

  it ('should support requests from Node.js clients', function(done) {
    var nodeTest = create_client_test('POST', 'node client.js', 'test/clients/node', 'node-test-key')
    nodeTest(done);
  });

  // TODO: Removing Perl because these tests are failing to run from Travis
  it ('should support requests from Perl clients', function(done) {
    var perlTest = create_client_test('GET', 'perl client.pl', 'test/clients/perl', 'perl-test-key')
    perlTest(done);
  });

  // Mac-specific client tests
  if(os.platform() === "darwin") {
    it ('should support requests from Go clients', function(done) {
      var golangTest = create_client_test('GET', './client', 'test/clients/golang/bin/mac', 'golang-test-key')
      golangTest(done);
    });
  }

  // Linux-specific client tests
  if(os.platform() === "linux") {
    it ('should support requests from Go clients', function(done) {
      var golangTest = create_client_test('GET', './client', 'test/clients/golang/bin/linux', 'golang-test-key')
      golangTest(done);
    });
  }

  // Windows-specific client tests
  if (os.platform().indexOf('win') === 0) {
    it ('should support requests from Powershell clients', function(done) {
	    // For some reason, Powershell only runs cleanly with spawn, not with the simpler exec semantics used
	    // in other tests.
	    var spawn = require("child_process").spawn,child;
	    var output = '';
	    child = spawn("powershell.exe",[".\\client.ps1"], {cwd: 'test/clients/powershell'});
	    child.stdout.on("data",function(data){
        output += data;
	    });

	    child.stderr.on("data",function(data){
        console.log("err: " + data);
      });

      child.on("exit",function(){
        output.trim().should.endWith('{"status":"ok"}');
        done();
      });
      child.stdin.end();
    });

    it ('should support requests from .Net clients using DotNetOpenAuth', function(done) {
      var dotNetTest = create_client_test('POST', 'Auspice\\Client\\bin\\Release\\Client.exe',
        'test/clients/dotnet', 'dotnet-test-key');
      dotNetTest(done);
    });

    it ('should support requests from .Net clients using RestSharp', function(done) {
      var restsharpTest = create_client_test('POST', 'Auspice\\RestSharpClient\\bin\\Release\\RestSharpClient.exe',
        'test/clients/dotnet', 'restsharp-test-key');
      restsharpTest(done);
    });

    it ('should support requests from Go clients', function(done) {
      var golangTest = create_client_test('GET', 'client.exe', 'test\\clients\\golang\\bin\\windows', 'golang-test-key')
      golangTest(done);
    });
  }
  // If it's not a Windows machine, run these tests.
  else {
    it ('should support requests from bash clients', function(done) {
      var bashTest = create_client_test('GET', 'bash client.sh', 'test/clients/bash', 'bash-test-key')
      bashTest(done);
    });

    it ('should support requests from python clients', function(done) {
      var pythonTest = create_client_test('GET', 'python client.py', 'test/clients/python', 'python-test-key')
      pythonTest(done);
    });
  }

});
