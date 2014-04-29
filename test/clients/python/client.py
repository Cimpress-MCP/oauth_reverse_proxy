import requests
from oauth_hook import OAuthHook

# NOTE: Python does not properly escape the OAuth signature.  This test case can not be used reliably
# until this is fixed.
# Example: 
#  [2014-04-28 22:24:02.402] [TRACE] authenticator - Hash	HG%2Fe1efz%2FcRdArimdeDPFFx0lek%3D
#  [2014-04-28 22:24:02.402] [TRACE] authenticator - Sig	HG/e1efz/cRdArimdeDPFFx0lek%3D
#
# Note that the python version does not escape the / characters.  By RFC, those should be escaped.

consumer_key = 'python-test-key'
consumer_secret_request = requests.Request('GET', 'http://localhost:8787/proxy/8000/key/' + consumer_key + '/')
consumer_secret_response = requests.session().send(consumer_secret_request.prepare())
consumer_secret = consumer_secret_response.content

request = requests.Request('GET', 'http://localhost:8000/job')
oauth_hook = OAuthHook('','', consumer_key, consumer_secret, True)
request = oauth_hook(request)
prepared = request.prepare()
session = requests.session()
response = session.send(prepared)
print response.content