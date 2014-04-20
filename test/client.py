import requests
from oauth_hook import OAuthHook

oauth_hook = OAuthHook('','', 'super-insecure-test-key', 'super-insecure-secret', True)
client = requests.session(hooks={'pre_request': oauth_hook})
response = client.get('http://localhost:8000/job')
results = json.loads(response.content)