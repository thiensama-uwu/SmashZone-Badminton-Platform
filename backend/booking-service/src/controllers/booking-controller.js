const { AppError } = require("../../../shared/lib/errors");

function createBookingController(service) {
  return {
    staffCreate: async (req, res, next) => {
      try {
        const result = await service.staffCreateBooking(req.body, req.auth, {
          correlationId: req.correlationId,
        });
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
    hold: async (req, res, next) => {
      try {
        const result = await service.holdSlot(req.body, req.auth, {
          correlationId: req.correlationId,
          idempotencyKey: req.headers["idempotency-key"],
        });
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
    createBooking: async (req, res, next) => {
      try {
        res.status(201).json(await service.createBooking(req.body.bookingId, req.auth, { correlationId: req.correlationId }));
      } catch (error) {
        next(error);
      }
    },
    getBooking: async (req, res, next) => {
      try {
        res.json(await service.getBooking(req.params.id, req.auth));
      } catch (error) {
        next(error);
      }
    },
    history: async (req, res, next) => {
      try {
        res.json(await service.getHistory(req.auth, req.query));
      } catch (error) {
        next(error);
      }
    },
    cancel: async (req, res, next) => {
      try {
        res.json(await service.cancelBooking(req.params.id, req.auth, { correlationId: req.correlationId, ...req.body }));
      } catch (error) {
        next(error);
      }
    },
    reschedule: async (req, res, next) => {
      try {
        res.json(await service.rescheduleBooking(req.params.id, req.body, req.auth, { correlationId: req.correlationId }));
      } catch (error) {
        next(error);
      }
    },
    checkIn: async (req, res, next) => {
      try {
        res.json(await service.checkIn(req.params.id, req.auth));
      } catch (error) {
        next(error);
      }
    },
    complete: async (req, res, next) => {
      try {
        res.json(await service.completeBooking(req.params.id, req.auth));
      } catch (error) {
        next(error);
      }
    },
    confirmPayment: async (req, res, next) => {
      try {
        res.json(await service.staffConfirmPayment(req.params.id, req.auth));
      } catch (error) {
        next(error);
      }
    },
    processRefund: async (req, res, next) => {
      try {
        res.json(await service.staffProcessRefund(req.params.id, req.auth));
      } catch (error) {
        next(error);
      }
    },
    markNoShow: async (req, res, next) => {
      try {
        res.json(await service.markNoShow(req.params.id, req.auth));
      } catch (error) {
        next(error);
      }
    },
    reservations: async (req, res, next) => {
      try {
        res.json({ items: await service.getReservations(req.query, req.headers["x-internal-token"]) });
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = {
  createBookingController,
};
