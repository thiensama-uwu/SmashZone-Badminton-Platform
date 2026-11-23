function createAuthController(service) {
  return {
    register: async (req, res, next) => {
      try {
        const result = await service.register(req.body, {
          ip: req.ip,
          correlationId: req.correlationId,
        });
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
    login: async (req, res, next) => {
      try {
        const result = await service.login(req.body, {
          ip: req.ip,
          correlationId: req.correlationId,
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
    googleAuth: async (req, res, next) => {
      try {
        const result = await service.loginWithGoogle(req.body, {
          ip: req.ip,
          correlationId: req.correlationId,
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
    refresh: async (req, res, next) => {
      try {
        const result = await service.refresh(req.body);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
    logout: async (req, res, next) => {
      try {
        const result = await service.logout(req.body);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
    changePassword: async (req, res, next) => {
      try {
        const result = await service.changePassword(req.auth.sub, req.body);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
    forgotPassword: async (req, res, next) => {
      try {
        const result = await service.forgotPassword(req.body, { ip: req.ip });
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
    resetPassword: async (req, res, next) => {
      try {
        const result = await service.resetPassword(req.body);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = {
  createAuthController,
};
