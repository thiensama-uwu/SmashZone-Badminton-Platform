const { PrismaClient } = require("../generated/prisma");

let prisma = global.__projectCnmPrisma;

if (!prisma) {
  prisma = new PrismaClient();
}

if (process.env.NODE_ENV !== "production") {
  global.__projectCnmPrisma = prisma;
}

module.exports = {
  prisma,
};
