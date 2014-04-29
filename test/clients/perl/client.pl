use LWP::UserAgent;
use HTTP::Request::Common;
use Net::OAuth;

my $consumer_key = 'perl-test-key';

my $ua = LWP::UserAgent->new;
my $consumer_secret_request = HTTP::Request->new(GET => "http://localhost:8787/proxy/8000/key/" . $consumer_key . "/");
my $consumer_secret_response = $ua->request($consumer_secret_request);
my $consumer_secret = $consumer_secret_response->content;

print "$consumer_key:$consumer_secret\n";

sub url { 'http://localhost:8000/job'; }

my $oauth_request = Net::OAuth->request('consumer')->new(
  consumer_key => $consumer_key,
  consumer_secret => $consumer_secret,
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