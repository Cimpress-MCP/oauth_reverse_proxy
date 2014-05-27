
var logger = require('../utils/logger.js').getLogger('environment_validator');

/**
 * Fail immediately if no AUSPICE_CONFIG environment variable is present.
 *
 * The config directory must be passed as an environment variable to the Auspice process.
 * This is used to locate the keystore on disk.
 */
if (!process.env.AUSPICE_CONFIG) {
  logger.error("No config file defined for Auspice.");
  process.exit(1);
}

/**
 * Fail immediately if no AUSPICE_SERVICE_NAME environment variable is present.
 *
 * The Auspice service name must be passed as an environment variable to the Auspice process.
 * This is used to provide context for logging.
 */
if (!process.env.AUSPICE_SERVICE_NAME) {
  logger.error("No service name defined for Auspice.");
  process.exit(2);
}

/**
 * Fail immediately if no AUSPICE_VERSION environment variable is present.
 *
 * The Auspice version must be passed as an environment variable to the Auspice process.
 * This is used to provide context for logging.
 */
if (!process.env.AUSPICE_VERSION) {
  logger.error("No version defined for Auspice.");
  process.exit(3);
}

/**
 * Fail immediately if no AUSPICE_VERSION environment variable is present.
 *
 * The Auspice proxy port must be passed as an environment variable to the Auspice proccess.
 * Each Auspice service proxies a single port, and knowing a priori which port we are
 * proxying allows us to disambiguate in the case where multiple Auspice proxies are configured
 * to use the same root directory for the keystore.  Without this, we could mave multiple
 * Auspice services attempting to bind to the same port.
 */
if (!process.env.AUSPICE_PROXY_PORT) {
  logger.error("No proxy port defined for Auspice.");
  process.exit(4);
}