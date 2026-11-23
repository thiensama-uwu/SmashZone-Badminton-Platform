const { z } = require("zod");

const subscriptionSchema = z.object({
  endpoint: z.string().min(1),
  publicKey: z.string().min(1),
  authSecret: z.string().min(1),
});

const markReadSchema = z.object({
  ids: z.array(z.string()).optional(),
});

module.exports = {
  subscriptionSchema,
  markReadSchema,
};
