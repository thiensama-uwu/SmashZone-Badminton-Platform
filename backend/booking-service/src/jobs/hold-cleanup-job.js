function startHoldSweep(service, config) {
  setInterval(() => {
    service.sweepExpiredHolds().catch((error) => {
      config.logger.error("Hold sweep failed", { reason: error.message });
    });
  }, config.holdSweepIntervalMs);
}

module.exports = {
  startHoldSweep,
};
