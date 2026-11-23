function createGatewayController(service) {
  return {
    docs: async (req, res, next) => {
      try {
        res.json(service.getOpenApi());
      } catch (error) {
        next(error);
      }
    },
    proxy: async (req, res, next) => {
      try {
        await service.proxy(req, res);
      } catch (error) {
        next(error);
      }
    },
    uploadImage: async (req, res, next) => {
      try {
        const data = await service.uploadImage(req, req.file);
        res.status(201).json(data);
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = {
  createGatewayController,
};
