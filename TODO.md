* ✓ Create a readme.md
* Populate a readme.md
* Finish off OAuth support
  * Add POST support
  * Scour RFC for any misses
* Create mechanism for loading hosts and keys in the proxy
* Migrate tests to use local key store rather than hard-coded strings
* Create tool for generating hosts and keys on the fly at test time
* Create a test web server to sit behind the proxy
  * Support GET and POST routes for test web server
  * Add POST tests to demo clients
* Convert test clients into true cucumber tests
* Add a rakefile for running tests and enabling packaging
* Create jenkins job for packaging this up and publishing to artifactory
* Create Puppet modules
  * Install node.js
  * Install and configure auspice
* Document process for clients to include these modules in their packages using librarian-puppet