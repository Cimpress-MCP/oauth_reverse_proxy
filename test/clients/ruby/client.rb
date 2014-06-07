require 'oauth'

consumer_key = 'ruby-test-key'
consumer_secret = File.open("../../keys/8008/8080/#{consumer_key}", 'rb').read

@consumer=OAuth::Consumer.new(
	consumer_key,
  consumer_secret,
	:site => "http://localhost:8008/",
  :request_token_path => "",
	:authorize_path => "",
	:access_token_path => "",
	:http_method => :post)

resp = @consumer.request(:get, '/job/3513?do=query&strings=kill&do=any&strings=kill')
puts resp.body

# TODO: The below won't work because ruby refuses to sign post body
#resp = @consumer.request(:post, '/job', nil, {}, 'do=fun&strings=kill&do=post&strings=kill')
#puts resp.code + "\r\n"
#puts resp.body
