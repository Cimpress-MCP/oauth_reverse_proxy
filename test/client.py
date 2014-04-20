import oauth2
import time

api_method = "http://localhost:8000/job";

# uses 0-legged OAuth signature validation
params = {
    'oauth_version': "1.0",
    'oauth_nonce': oauth2.generate_nonce(),
    'oauth_timestamp': int(time.time())
}

consumer = oauth2.Consumer(key="super-insecure-test-key", secret="super-insecure-secret")
params['oauth_consumer_key'] = consumer.key
req = oauth2.Request(method='GET', url=api_method, parameters=params)
signature_method = oauth2.SignatureMethod_HMAC_SHA1()
req.sign_request(signature_method, consumer, None)
print req.to_url()