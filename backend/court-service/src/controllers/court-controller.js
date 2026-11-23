const { AppError } = require("../../../shared/lib/errors");

function createCourtController(service, config) {
  return {
    listCourts: async (req, res, next) => {
      try {
        res.json(await service.listCourts(req.query));
      } catch (error) {
        next(error);
      }
    },
    featuredCourts: async (req, res, next) => {
      try {
        const limit = parseInt(req.query.limit) || 3;
        res.json(await service.getFeaturedCourts(limit));
      } catch (error) {
        next(error);
      }
    },
    getCourt: async (req, res, next) => {
      try {
        const id = req.params.id;
        const bypassCache = req.query.bypassCache === 'true';
        // Try to get by ID first, if fails try by slug
        try {
          const court = await service.getCourt(id, false, bypassCache);
          return res.json(court);
        } catch (err) {
          // If ID search fails, try slug search regardless of error type
          try {
            const court = await service.getCourtBySlug(id);
            return res.json(court);
          } catch (slugErr) {
            // If both fail, throw the original error or the slug error
            throw err;
          }
        }
      } catch (error) {
        next(error);
      }
    },
    getCourtBySlug: async (req, res, next) => {
      try {
        res.json(await service.getCourtBySlug(req.params.slug));
      } catch (error) {
        next(error);
      }
    },
    createCourt: async (req, res, next) => {
      try {
        res.status(201).json(await service.createCourt(req.body));
      } catch (error) {
        next(error);
      }
    },
    updateCourt: async (req, res, next) => {
      try {
        res.json(await service.updateCourt(req.params.id, req.body));
      } catch (error) {
        next(error);
      }
    },
    availability: async (req, res, next) => {
      try {
        res.json(await service.getAvailability(req.query, req.correlationId));
      } catch (error) {
        next(error);
      }
    },
    addPriceSchedule: async (req, res, next) => {
      try {
        res.status(201).json(await service.addPriceSchedule(req.params.id, req.body));
      } catch (error) {
        next(error);
      }
    },
    addPolicy: async (req, res, next) => {
      try {
        res.status(201).json(await service.addPolicy(req.params.id, req.body));
      } catch (error) {
        next(error);
      }
    },
    getPolicy: async (req, res, next) => {
      try {
        res.json(await service.getPolicy(req.params.id));
      } catch (error) {
        next(error);
      }
    },
    getPriceSchedules: async (req, res, next) => {
      try {
        res.json(await service.getPriceSchedules(req.params.id));
      } catch (error) {
        next(error);
      }
    },
    deleteCourt: async (req, res, next) => {
      try {
        res.json(await service.softDeleteCourt(req.params.id, req.auth.sub));
      } catch (error) {
        next(error);
      }
    },
    quote: async (req, res, next) => {
      try {
        res.json(await service.getPriceQuote(req.body));
      } catch (error) {
        next(error);
      }
    },
    invalidateAvailability: async (req, res, next) => {
      try {
        if (req.headers["x-internal-token"] !== config.internalServiceToken) {
          throw new AppError(403, "FORBIDDEN", "Invalid internal token");
        }
        await service.invalidateAvailability(req.body.courtId);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = {
  createCourtController,
};
