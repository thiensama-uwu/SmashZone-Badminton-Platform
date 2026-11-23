function createPaymentController(service, config) {
  return {
    createPayment: async (req, res, next) => {
      try {
        const payment = await service.createPaymentOrder({
          ...req.body,
          userId: req.auth.sub,
          idempotencyKey: req.headers["idempotency-key"],
        }, req.correlationId);
        res.status(201).json(payment);
      } catch (error) {
        next(error);
      }
    },
    getPayment: async (req, res, next) => {
      try {
        res.json(await service.getPayment(req.params.id));
      } catch (error) {
        next(error);
      }
    },
    listRefunds: async (req, res, next) => {
      try {
        res.json({ items: await service.listRefunds(req.query, req.auth) });
      } catch (error) {
        next(error);
      }
    },
    webhook: async (req, res, next) => {
      try {
        await service.processWebhook(req.body, req.headers, req.correlationId);
        res.status(200).json({ success: true });
      } catch (error) {
        next(error);
      }
    },
    refund: async (req, res, next) => {
      try {
        const refund = await service.createRefund({ paymentId: req.params.id, ...req.body }, req.correlationId);
        res.status(201).json(refund);
      } catch (error) {
        next(error);
      }
    },
    refundByBooking: async (req, res, next) => {
      try {
        const payment = (await service.repository.findPaymentByBooking(req.params.bookingId, "booking")) || (await service.repository.findPaymentByBooking(req.params.bookingId, "reschedule"));
        if (!payment) {
          throw new (require("../../../shared/lib/errors").AppError)(404, "PAYMENT_NOT_FOUND", "Payment not found for this booking");
        }
        const refund = await service.createRefund({ paymentId: payment.id, ...req.body }, req.correlationId);
        res.status(201).json(refund);
      } catch (error) {
        next(error);
      }
    },
    markRefundTransferred: async (req, res, next) => {
      try {
        res.json(await service.markRefundTransferred(req.params.id, req.auth));
      } catch (error) {
        next(error);
      }
    },
    manualCompleteRefund: async (req, res, next) => {
      try {
        res.json(await service.manualCompleteRefund(req.params.id, req.body, req.auth, req.correlationId));
      } catch (error) {
        next(error);
      }
    },
    failRefund: async (req, res, next) => {
      try {
        res.json(await service.failRefund(req.params.id, req.body, req.auth));
      } catch (error) {
        next(error);
      }
    },
    retryRefund: async (req, res, next) => {
      try {
        const refund = await service.retryRefund(req.params.id, req.body, req.auth, req.correlationId);
        res.status(201).json(refund);
      } catch (error) {
        next(error);
      }
    },
    signWebhook: async (req, res, next) => {
      try {
        res.json({
          signature: config.signWebhook(`${req.body.paymentId}:${req.body.status}:${req.body.providerTransactionId}`),
        });
      } catch (error) {
        next(error);
      }
    },
    devCompletePayment: async (req, res, next) => {
      try {
        const { paymentId } = req.body;
        if (!paymentId) {
          throw new (require("../../../shared/lib/errors").AppError)(400, "MISSING_PAYMENT_ID", "Payment ID is required");
        }
        await service.repository.updatePayment(paymentId, { status: "COMPLETED" });
        res.json({ status: "COMPLETED" });
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = {
  createPaymentController,
};
