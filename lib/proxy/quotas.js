/**
 * This object is responsible for managing the state of any per-key quotas.
 */
function ProxyQuotas(config) {
  // The default threshold for keys that don't have a specific threshold defined
  Object.defineProperty(this, 'default_threshold', {value: parseInt(config.quotas.default_threshold) });

  // The interval for resetting quota counters
  Object.defineProperty(this, 'interval', {value: parseInt(config.quotas.interval) });

  // The interval for resetting quota counters
  Object.defineProperty(this, 'thresholds', {value: {} });

  for (var key in config.quotas.thresholds) {
  	Object.defineProperty(this.thresholds, key, {value: parseInt(config.quotas.thresholds[key]) });
  }
}

// Expose Quota class.
module.exports = ProxyQuotas;