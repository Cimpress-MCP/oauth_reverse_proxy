var should = require('should');

var _ = require('underscore');

var exec = require('child_process').exec;
var os = require('os');

var test_server = require('./server/test_server.js'); 
var job_server = test_server.JobServer;

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
// functionality to validate that requests can be sent through Auspice properly using various languages.
describe('Client tests', function() {
  
  // Only test Bash and Python if we're not on Windows.
  if (os.platform().indexOf('win') !== 0) {
    it ('bash', function(done) {
      var bashTest = create_client_test('GET', 'bash client.sh', 'test/clients/bash', 'bash-test-key')
      bashTest(done);
    });
    
    it ('python', function(done) {
      var pythonTest = create_client_test('GET', 'python client.py', 'test/clients/python', 'python-test-key')
      pythonTest(done);
    });
  }
  
  it ('java', function(done) {
    var javaTest = create_client_test('POST', 
      'java -cp target/AuspiceClient-1.0-SNAPSHOT-jar-with-dependencies.jar com.vistaprint.auspice.Client',
      'test/clients/java/AuspiceClient', 'java-test-key')
    javaTest(done);
  });
  
  it ('node.js', function(done) {
    var nodeTest = create_client_test('POST', 'node client.js', 'test/clients/node', 'node-test-key')
    nodeTest(done);
  });
  
  it ('perl', function(done) {
    var perlTest = create_client_test('GET', 'perl client.pl', 'test/clients/perl', 'perl-test-key')
    perlTest(done);
  });
  
  // Only test .Net if we're on Windows.
  if (os.platform().indexOf('win') === 0) {
  /**
    it ('.Net', function(done) {
      var dotNetTest = create_client_test('POST', '.\\AuspiceClient\\AuspiceClient\\bin\\Debug\\AuspiceClient.exe',
        'test/clients/dotnet', 'dotnet-test-key');
      dotNetTest(done);
    });
  **/
  }
  
  it ('ruby', function(done) {
    var rubyTest = create_client_test('GET', 'ruby client.rb', 'test/clients/ruby', 'ruby-test-key')
    rubyTest(done);
  });
  
});