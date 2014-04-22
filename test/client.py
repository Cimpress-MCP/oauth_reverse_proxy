import requests
from oauth_hook import OAuthHook

request = requests.Request('GET', 'http://localhost:8000/job')
oauth_hook = OAuthHook('','', 'super-insecure-test-key', 'super-insecure-secret', True)
request = oauth_hook(request)
prepared = request.prepare()
session = requests.session()
response = session.send(prepared)
print response.content