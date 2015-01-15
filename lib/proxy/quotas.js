/**
 * This object is responsible for managing the state of any per-key quotas.
 */
function ProxyQuotas(config) {
  // The default threshold for keys that don't have a specific threshold defined
  //Object.defineProperty(this, 'default_threshold', {value: config.quotas.default_threshold});

  // The interval for resetting quota counters
}

// Expose Quota class.
module.exports = ProxyQuotas;