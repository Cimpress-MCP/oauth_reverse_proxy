var fs = require('fs');
var logger = require('../utils/logger.js').getLogger('environment_validator');

// Delay the startup failure to give log messages an opportunity to reach the logstash agent.
var fail_startup = function(exit_code) {
  setTimeout(function() {
    process.exit(exit_code);
  }, 2000);
}

/**
 * Fail immediately if no AUSPICE_CONFIG environment variable is present.
 *
 * The config directory must be passed as an environment variable to the Auspice process.
 * This is used to locate the keystore on disk.
 */
if (!process.env.AUSPICE_KEYSTORE) {
  logger.error("No keystore defined for Auspice.");
  return fail_startup(1);
}

try {
  var stat = fs.statSync(process.env.AUSPICE_KEYSTORE);
  if (!stat.isDirectory()) {
    logger.error("Keystore %s is not present", process.env.AUSPICE_KEYSTORE);
    return fail_startup(1);
  }
} catch(e) {
  logger.error("Keystore %s is not present", process.env.AUSPICE_KEYSTORE);
  return fail_startup(1);
}

/**
 * Fail immediately if no AUSPICE_SERVICE_NAME environment variable is present.
 *
 * The Auspice service name must be passed as an environment variable to the Auspice process.
 * This is used to provide context for logging.
 */
if (!process.env.AUSPICE_SERVICE_NAME) {
  logger.error("No service name defined for Auspice.");
  return fail_startup(2);
}

/**
 * Fail immediately if no AUSPICE_VERSION environment variable is present.
 *
 * The Auspice version must be passed as an environment variable to the Auspice process.
 * This is used to provide context for logging.
 */
if (!process.env.AUSPICE_VERSION) {
  logger.error("No version defined for Auspice.");
  return fail_startup(3);
}

/**
 * Fail immediately if no AUSPICE_PROXY_PORT environment variable is present.
 *
 * The Auspice proxy port must be passed as an environment variable to the Auspice proccess.
 * Each Auspice service proxies a single port, and knowing a priori which port we are
 * proxying allows us to disambiguate in the case where multiple Auspice proxies are configured
 * to use the same root directory for the keystore.  Without this, we could mave multiple
 * Auspice services attempting to bind to the same port.
 */
if (!process.env.AUSPICE_PROXY_PORT) {
  logger.error("No proxy port defined for Auspice.");
  return fail_startup(4);
}

// If we got here, everything validated, so we can export true as the result of module invocation.
// This will give any callers a simple test as to whether the environment is correctly configured.
module.exports = true;
