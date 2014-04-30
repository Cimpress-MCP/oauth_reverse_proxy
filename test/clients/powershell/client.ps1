[Reflection.Assembly]::LoadWithPartialName("System.Security")
[Reflection.Assembly]::LoadWithPartialName("System.Net")

$oauth_consumer_key = "powershell-test-key";

$client = new-object System.Net.WebClient;
$oauth_consumer_secret = $client.DownloadString("http://localhost:8787/proxy/8000/key/" + $oauth_consumer_key + "/");

$oauth_token_secret = "";
$oauth_nonce = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes([System.DateTime]::Now.Ticks.ToString()));
# TODO: Should we enforce that all clients use GMT epoch time?
$oauth_timestamp = [int][double]::Parse($(Get-Date -date (Get-Date).ToUniversalTime()-uformat %s));

$signature = "GET&";
$signature += [System.Uri]::EscapeDataString("http://localhost:8000/job") + "&";
$signature += [System.Uri]::EscapeDataString("oauth_consumer_key=" + $oauth_consumer_key + "&");
$signature += [System.Uri]::EscapeDataString("oauth_nonce=" + $oauth_nonce + "&"); 
$signature += [System.Uri]::EscapeDataString("oauth_signature_method=HMAC-SHA1&");
$signature += [System.Uri]::EscapeDataString("oauth_timestamp=" + $oauth_timestamp + "&");
$signature += [System.Uri]::EscapeDataString("oauth_version=1.0");

$signature_key = [System.Uri]::EscapeDataString($oauth_consumer_secret) + "&";

$hmacsha1 = new-object System.Security.Cryptography.HMACSHA1;  
$hmacsha1.Key = [System.Text.Encoding]::ASCII.GetBytes($signature_key);

$oauth_signature = [System.Convert]::ToBase64String($hmacsha1.ComputeHash([System.Text.Encoding]::ASCII.GetBytes($signature)));  

$oauth_authorization = 'OAuth ';
$oauth_authorization += 'oauth_consumer_key="' + [System.Uri]::EscapeDataString($oauth_consumer_key) + '",';
$oauth_authorization += 'oauth_nonce="' + [System.Uri]::EscapeDataString($oauth_nonce) + '",';
$oauth_authorization += 'oauth_signature="' + [System.Uri]::EscapeDataString($oauth_signature) + '",';
$oauth_authorization += 'oauth_signature_method="HMAC-SHA1",'
$oauth_authorization += 'oauth_timestamp="' + [System.Uri]::EscapeDataString($oauth_timestamp) + '",'
$oauth_authorization += 'oauth_version="1.0"';

[System.Net.HttpWebRequest] $request = [System.Net.WebRequest]::Create("http://localhost:8000/job");  
$request.Method = "GET";
$request.Headers.Add("Authorization", $oauth_authorization);
$response = $request.GetResponse();

$reqstream = $response.GetResponseStream()
$sr = new-object System.IO.StreamReader $reqstream
$result = $sr.ReadToEnd()
$result

$response.close()