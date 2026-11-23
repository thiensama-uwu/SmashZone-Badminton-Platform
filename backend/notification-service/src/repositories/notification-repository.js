const { prisma } = require("../../../shared/data/prisma");

class NotificationRepository {
  async saveSubscription(userId, subscription) {
    return prisma.pushSubscription.upsert({
      where: { userId },
      update: {
        endpoint: subscription.endpoint,
        publicKey: subscription.publicKey,
        authSecret: subscription.authSecret,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        publicKey: subscription.publicKey,
        authSecret: subscription.authSecret,
      },
    });
  }

  async getSubscription(userId) {
    return prisma.pushSubscription.findUnique({ where: { userId } });
  }

  async hasDedup(key) {
    const existing = await prisma.notification.findUnique({ where: { dedupKey: key } });
    return Boolean(existing);
  }

  async createLog(input) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        eventType: input.eventType,
        aggregateId: input.aggregateId,
        channel: input.channel,
        message: input.message,
        payload: input.payload,
        dedupKey: input.dedupKey,
        correlationId: input.correlationId,
      },
    });
  }

  async addAttempt(input) {
    return prisma.deliveryAttempt.create({
      data: {
        notificationId: input.notificationId,
        attempt: input.attempt,
        status: input.status,
        nextRetryAt: input.nextRetryAt || null,
      },
    });
  }

  async listByUser(userId) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findBookingBrief(bookingId) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        bookingCode: true,
        date: true,
        startTime: true,
        endTime: true,
        totalAmount: true,
      },
    });
  }

  async markRead(userId, ids) {
    const where = ids && ids.length
      ? { userId, id: { in: ids } }
      : { userId, readAt: null };

    await prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });

    return this.listByUser(userId);
  }

  async getStaffUserIds() {
    const roles = await prisma.role.findMany({
      where: { code: { in: ['admin', 'staff'] } },
      select: { id: true }
    });
    const roleIds = roles.map(r => r.id);
    const userRoles = await prisma.userRole.findMany({
      where: { roleId: { in: roleIds } },
      select: { userId: true }
    });
    return [...new Set(userRoles.map(ur => ur.userId))];
  }
}

module.exports = {
  NotificationRepository,
};
