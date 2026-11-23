const { AppError } = require("../../../shared/lib/errors");

function createUserController(service, config) {
  return {
    bootstrapProfile: async (req, res, next) => {
      try {
        if (req.headers["x-internal-token"] !== config.internalServiceToken) {
          throw new AppError(403, "FORBIDDEN", "Invalid internal service token");
        }

        res.status(201).json(await service.bootstrapProfile(req.body));
      } catch (error) {
        next(error);
      }
    },
    me: async (req, res, next) => {
      try {
        res.json(await service.getMe(req.auth.sub));
      } catch (error) {
        next(error);
      }
    },
    updateMe: async (req, res, next) => {
      try {
        res.json(await service.updateMe(req.auth.sub, req.body));
      } catch (error) {
        next(error);
      }
    },
    adminCreateUser: async (req, res, next) => {
      try {
        const user = await service.adminCreateUser(req.body);
        res.status(201).json(user);
      } catch (error) {
        next(error);
      }
    },
    listUsers: async (req, res, next) => {
      try {
        res.json(await service.listUsers(req.query));
      } catch (error) {
        next(error);
      }
    },
    getUser: async (req, res, next) => {
      try {
        res.json(await service.getUser(req.params.id));
      } catch (error) {
        next(error);
      }
    },
    updateUser: async (req, res, next) => {
      try {
        res.json(await service.updateUser(req.params.id, { ...req.body, actorId: req.auth.sub }));
      } catch (error) {
        next(error);
      }
    },
    deleteUser: async (req, res, next) => {
      try {
        await service.hardDeleteUser(req.params.id);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
    submitContact: async (req, res, next) => {
      try {
        // Here we could send an email or save to DB. For now, just log and return 200.
        console.log("Contact form submitted:", req.body);
        res.status(200).json({ success: true, message: "Contact form submitted successfully." });
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = {
  createUserController,
};
