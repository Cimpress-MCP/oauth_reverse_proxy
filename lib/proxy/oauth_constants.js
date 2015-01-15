var OAUTH_CONSUMER_KEY = exports.OAUTH_CONSUMER_KEY = 'oauth_consumer_key';
var OAUTH_NONCE = exports.OAUTH_NONCE = 'oauth_nonce';
var OAUTH_SIGNATURE = exports.OAUTH_SIGNATURE = 'oauth_signature';
var OAUTH_SIGNATURE_METHOD = exports.OAUTH_SIGNATURE_METHOD = 'oauth_signature_method';
var OAUTH_TIMESTAMP = exports.OAUTH_TIMESTAMP = 'oauth_timestamp';
var OAUTH_VERSION = exports.OAUTH_VERSION = 'oauth_version';

var CONSUMER_KEY_HEADER = exports.CONSUMER_KEY_HEADER = 'x-oauth-reverse-proxy-consumer-key';

/**
 * All of these parameters must be present in a valid oauth header or query string.
 */
var REQUIRED_OAUTH_PARAMS = exports.REQUIRED_OAUTH_PARAMS = [
  OAUTH_CONSUMER_KEY,
  OAUTH_NONCE,
  OAUTH_SIGNATURE,
  OAUTH_SIGNATURE_METHOD,
  OAUTH_TIMESTAMP
];

var REQUIRED_OAUTH_PARAMS_COUNT = exports.REQUIRED_OAUTH_PARAMS_COUNT = REQUIRED_OAUTH_PARAMS.length;

// Only allow requests within 5 minutes.
var OAUTH_TIMESTAMP_MAX_AGE = exports.OAUTH_TIMESTAMP_MAX_AGE = 5*60*1000;

// Only allow URLs that are 16kB or fewer bytes in length.
var MAXIMUM_URL_LENGTH = exports.MAXIMUM_URL_LENGTH = 16*1024;