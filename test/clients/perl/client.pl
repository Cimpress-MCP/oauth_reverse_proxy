use LWP::UserAgent;
use HTTP::Request::Common;
use Net::OAuth;

sub url { 'http://localhost:8000/job'; }

my $oauth_request = Net::OAuth->request('consumer')->new(
  consumer_key => 'super-insecure-test-key',
  consumer_secret => 'super-insecure-secret',
  request_url => url(),
  request_method => 'GET',
  signature_method => 'HMAC-SHA1',
  timestamp => time,
  nonce => nonce(),
);

$oauth_request->sign;

my $req = HTTP::Request->new(GET => url());
$req->header('Content-type' => 'application/json');
$req->header('Authorization' => $oauth_request->to_authorization_header);

my $ua = LWP::UserAgent->new;
my $oauth_response = $ua->simple_request($req);

print $oauth_response->as_string;

sub nonce {
  my @a = ('A'..'Z', 'a'..'z', 0..9);
  my $nonce = '';
  for(0..31) {
    $nonce .= $a[rand(scalar(@a))];
  }

  $nonce;
}