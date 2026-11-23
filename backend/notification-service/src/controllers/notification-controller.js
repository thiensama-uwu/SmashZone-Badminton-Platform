function createNotificationController(service) {
  return {
    subscribe: async (req, res, next) => {
      try {
        res.status(201).json(await service.saveSubscription(req.auth.sub, req.body));
      } catch (error) {
        next(error);
      }
    },
    history: async (req, res, next) => {
      try {
        res.json({ items: await service.listHistory(req.auth.sub) });
      } catch (error) {
        next(error);
      }
    },
    markRead: async (req, res, next) => {
      try {
        res.json({ items: await service.markRead(req.auth.sub, req.body.ids || []) });
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = {
  createNotificationController,
};
