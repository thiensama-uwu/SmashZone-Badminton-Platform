const { prisma } = require("../../../shared/data/prisma");

function mapAuthUser(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    status: record.status,
    roles: (record.userRoles || []).map((item) => item.role.code),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    passwordHash: record.passwordHash,
  };
}

class AuthRepository {
  async findByEmail(email) {
    const record = await prisma.authUser.findUnique({
      where: { email },
      include: { userRoles: { include: { role: true } } },
    });
    return mapAuthUser(record);
  }

  async findById(id) {
    const record = await prisma.authUser.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
    return mapAuthUser(record);
  }

  async findByPhone(phone) {
    const profile = await prisma.userProfile.findFirst({
      where: { phone },
    });
    if (!profile) return null;
    return this.findById(profile.userId);
  }

  async createUser({ email, phone, passwordHash, roles }) {
    const roleRecords = await prisma.role.findMany({ where: { code: { in: roles } } });
    const created = await prisma.authUser.create({
      data: {
        email,
        passwordHash,
        userRoles: {
          create: roleRecords.map((role) => ({ roleId: role.id })),
        },
      },
      include: { userRoles: { include: { role: true } } },
    });
    return mapAuthUser(created);
  }

  async saveRefreshSession(session) {
    return prisma.refreshSession.create({
      data: {
        userId: session.userId,
        token: session.token,
        expiresAt: session.expiresAt,
      },
    });
  }

  async findRefreshSession(token) {
    return prisma.refreshSession.findUnique({ where: { token } });
  }

  async revokeRefreshSession(token) {
    return prisma.refreshSession.updateMany({
      where: { token, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async saveOtp(userId, otp, expiresAt) {
    return prisma.passwordResetOtp.create({
      data: {
        userId,
        code: otp,
        expiresAt,
      },
    });
  }

  async getOtp(userId, otp) {
    return prisma.passwordResetOtp.findFirst({
      where: {
        userId,
        code: otp,
        consumedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async clearOtp(id) {
    return prisma.passwordResetOtp.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }

  async updatePassword(userId, passwordHash) {
    await prisma.authUser.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return this.findById(userId);
  }
}

module.exports = {
  AuthRepository,
};
