#!/bin/bash
CONSUMER_KEY=bash-test-key
CONSUMER_SECRET=`cat ../../keys/8000/8888/$CONSUMER_KEY`\&

TIME=$(($(date +'%s * 1000 + %-N / 1000000')))
NONCE=$(date +%s | shasum | base64 | head -c 32 ; echo)

TO_SIGN="GET&http%3A%2F%2Flocalhost%3A8000%2Fjob&oauth_consumer_key%3D$CONSUMER_KEY%26oauth_nonce%3D$NONCE%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D$TIME%26oauth_version%3D1.0"

SIGNATURE=`echo -n $TO_SIGN | openssl sha1 -hmac "$CONSUMER_SECRET" -binary | base64`

#curl -v -G --data-urlencode "oauth_consumer_key=$CONSUMER_KEY" --data-urlencode "oauth_nonce=$NONCE" --data-urlencode "oauth_signature_method=HMAC-SHA1" --data-urlencode "oauth_signature=$SIGNATURE" --data-urlencode "oauth_version=1.0" --data-urlencode "oauth_timestamp=$TIME" http://localhost:8000/job
curl --silent -G --data-urlencode "oauth_consumer_key=$CONSUMER_KEY" --data-urlencode "oauth_nonce=$NONCE" --data-urlencode "oauth_signature_method=HMAC-SHA1" --data-urlencode "oauth_signature=$SIGNATURE" --data-urlencode "oauth_version=1.0" --data-urlencode "oauth_timestamp=$TIME" http://localhost:8000/job