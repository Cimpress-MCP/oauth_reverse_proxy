require 'oauth'

consumer_key = 'ruby-test-key'
consumer_secret = File.open("../../keys/8008/8080/#{consumer_key}", 'rb').read

# puts "Using key/secret #{consumer_key}/#{consumer_secret}"

@consumer=OAuth::Consumer.new(
	consumer_key,
  consumer_secret,
	:site => "http://localhost:8008/",
  :request_token_path => "",
	:authorize_path => "",
	:access_token_path => "",
	:http_method => :post)
 
#access_token = OAuth::AccessToken.new @consumer
 
#resp = access_token.get("/job?do=query&strings=kill&us=or&not=&not=would&be=good")

#puts resp.code + "\r\n"
#puts resp.body

#resp = access_token.post("/job?do=query&strings=kill&us=or&not=&not=would&be=good", "do=query&strings=kill")

#resp = @consumer.request(:post, '/job?do=query&strings=kill&us=or&not=&not=would&be=good', nil, {}, 'do=query&strings=kill')

resp = @consumer.request(:get, '/job?do=query&strings=kill&do=any&strings=kill')
puts resp.code + "\r\n"
puts resp.body

# TODO: The below won't work because ruby refuses to sign post body
#resp = @consumer.request(:post, '/job', nil, {}, 'do=fun&strings=kill&do=post&strings=kill')
#puts resp.code + "\r\n"
#puts resp.body
