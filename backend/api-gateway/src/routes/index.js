const express = require("express");
const multer = require("multer");
const { createGatewayController } = require("../controllers/gateway-controller");

function createGatewayRouter(service) {
  const router = express.Router();
  const controller = createGatewayController(service);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  router.use("/uploads", express.static(service.getUploadsDir()));
  router.post("/uploads/images", upload.single("image"), controller.uploadImage);
  router.get("/docs/openapi.json", controller.docs);
  router.use(controller.proxy);

  return router;
}

module.exports = {
  createGatewayRouter,
};
