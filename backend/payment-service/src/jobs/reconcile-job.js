function startReconcileJob(service, config) {
  setInterval(() => {
    service.sweepPendingPayments().catch((error) => {
      config.logger.error("Payment timeout sweep failed", { reason: error.message });
    });
  }, config.reconcileIntervalMs);
}

module.exports = {
  startReconcileJob,
};
