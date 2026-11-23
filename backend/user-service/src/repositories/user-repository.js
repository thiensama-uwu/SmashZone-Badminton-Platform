const { prisma } = require("../../../shared/data/prisma");

function mergeUserProfile(authUser, profile) {
  if (!authUser) return null;
  return {
    id: authUser.id,
    email: authUser.email,
    roles: (authUser.userRoles || []).map((ur) => ur.role.code),
    fullName: profile?.fullName || null,
    phone: profile?.phone || null,
    gender: profile?.gender || null,
    avatarUrl: profile?.avatarUrl || null,
    createdAt: authUser.createdAt,
    updatedAt: authUser.updatedAt,
  };
}

class UserRepository {
  async bootstrapProfile(input) {
    const profile = await prisma.userProfile.upsert({
      where: { userId: input.userId },
      update: {
        email: input.email,
        fullName: input.fullName,
      },
      create: {
        userId: input.userId,
        email: input.email,
        fullName: input.fullName,
        phone: input.phone || null,
        gender: input.gender || null,
        birthDate: input.birthDate ? new Date(input.birthDate) : null,
      },
    });

    await prisma.profileAuditLog.create({
      data: {
        profileId: profile.id,
        action: "PROFILE_BOOTSTRAPPED",
        changedBy: input.userId,
        payload: input,
      },
    });

    return profile;
  }

  async findByUserId(userId) {
    const [profile, authUser] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.authUser.findUnique({
        where: { id: userId },
        include: { userRoles: { include: { role: true } } },
      }),
    ]);

    if (!profile || !authUser) return null;

    return {
      ...profile,
      id: authUser.id,
      roles: (authUser.userRoles || []).map((ur) => ur.role.code),
      avatarUrl: profile.avatarUrl || null,
    };
  }

  async updateProfile(userId, changes) {
    const profile = await this.findByUserId(userId);
    if (!profile) {
      return null;
    }

    const updated = await prisma.userProfile.update({
      where: { userId },
      data: {
        fullName: changes.fullName,
        phone: changes.phone,
        gender: changes.gender,
        birthDate: changes.birthDate ? new Date(changes.birthDate) : null,
        avatarUrl: changes.avatarUrl,
        version: { increment: 1 },
      },
    });

    await prisma.profileAuditLog.create({
      data: {
        profileId: updated.id,
        action: "PROFILE_UPDATED",
        changedBy: userId,
        payload: changes,
      },
    });

    return updated;
  }
  async listUsers({ page = 1, limit = 20, search } = {}) {
    const skip = (page - 1) * limit;
    const where = {
      ...(search ? { email: { contains: search, mode: "insensitive" } } : {}),
    };
    const [records, total] = await Promise.all([
      prisma.authUser.findMany({
        where,
        include: { userRoles: { include: { role: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.authUser.count({ where }),
    ]);

    const userIds = records.map((r) => r.id);
    const profiles = await prisma.userProfile.findMany({ where: { userId: { in: userIds } } });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    return {
      items: records.map((r) => mergeUserProfile(r, profileMap.get(r.id))),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findUserById(userId) {
    const record = await prisma.authUser.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!record) return null;
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    return mergeUserProfile(record, profile);
  }

  async hardDeleteUser(userId) {
    await prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: { userId },
        data: { userId: null },
      });

      await tx.userProfile.deleteMany({
        where: { userId },
      });

      await tx.authUser.delete({
        where: { id: userId },
      });
    });
  }

  async createUser({ email, passwordHash, roleCodes, fullName, phone, gender, birthDate }) {
    const roleRecords = await prisma.role.findMany({ where: { code: { in: roleCodes } } });
    const authUser = await prisma.authUser.create({
      data: {
        email,
        passwordHash,
        userRoles: { create: roleRecords.map((r) => ({ roleId: r.id })) },
      },
      include: { userRoles: { include: { role: true } } },
    });

    const profile = await prisma.userProfile.create({
      data: {
        userId: authUser.id,
        email,
        fullName,
        phone: phone || null,
        gender: gender || null,
        birthDate: birthDate ? new Date(birthDate) : null,
      },
    });

    return mergeUserProfile(authUser, profile);
  }

  async findByEmail(email) {
    return prisma.authUser.findUnique({ where: { email } });
  }

  async updateUserRoles(userId, roleCodes) {
    const roleRecords = await prisma.role.findMany({ where: { code: { in: roleCodes } } });
    await prisma.userRole.deleteMany({ where: { userId } });
    await prisma.userRole.createMany({
      data: roleRecords.map((r) => ({ userId, roleId: r.id })),
    });
    return this.findUserById(userId);
  }
}

module.exports = {
  UserRepository,
};
