require 'oauth'
require 'net/http'

@consumer=OAuth::Consumer.new(
  "super-insecure-client-key",
	"super-insecure-secret",
	:site => "http://localhost:8000/",
  :request_token_path => "",
	:authorize_path => "",
	:access_token_path => "",
	:http_method => :get)
 
access_token = OAuth::AccessToken.new @consumer
 
resp = access_token.get("/job")
 
puts resp.code + "\r\n"
puts resp.body