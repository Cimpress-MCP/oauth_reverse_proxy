require 'oauth'
require 'net/http'

@consumer=OAuth::Consumer.new(
  "super-insecure-test-key",
	"super-insecure-secret",
	:site => "http://localhost:8000/",
  :request_token_path => "",
	:authorize_path => "",
	:access_token_path => "",
	:http_method => :get)
 
access_token = OAuth::AccessToken.new @consumer
 
resp = access_token.get("/job?do=query&strings=kill&us=or&not=&not=would&be=good")
 
puts resp.code + "\r\n"
puts resp.body