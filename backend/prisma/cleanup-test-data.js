const { PrismaClient } = require("../shared/generated/prisma");

const prisma = new PrismaClient();

const EMAIL_PATTERNS = [
  /^smoke\.user\..*@example\.com$/i,
  /^qa\.user\..*@example\.com$/i,
  /^qa\.fixture\..*@example\.com$/i,
];

function isTestEmail(email) {
  return EMAIL_PATTERNS.some((re) => re.test(email || ""));
}

async function main() {
  const users = await prisma.authUser.findMany({
    select: { id: true, email: true },
  });

  const testUsers = users.filter((u) => isTestEmail(u.email));
  const userIds = testUsers.map((u) => u.id);

  if (userIds.length === 0) {
    console.log("No generated smoke/qa users found.");
    return;
  }

  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { createdBy: { in: userIds } },
      ],
    },
    select: { id: true },
  });
  const bookingIds = bookings.map((b) => b.id);

  const payments = bookingIds.length
    ? await prisma.payment.findMany({
        where: { OR: [{ bookingId: { in: bookingIds } }, { userId: { in: userIds } }] },
        select: { id: true },
      })
    : [];
  const paymentIds = payments.map((p) => p.id);

  const result = await prisma.$transaction(async (tx) => {
    let counters = {};

    if (paymentIds.length) {
      counters.paymentTransactions = (await tx.paymentTransaction.deleteMany({ where: { paymentId: { in: paymentIds } } })).count;
      counters.refunds = (await tx.refund.deleteMany({ where: { paymentId: { in: paymentIds } } })).count;
      counters.payments = (await tx.payment.deleteMany({ where: { id: { in: paymentIds } } })).count;
    } else {
      counters.paymentTransactions = 0;
      counters.refunds = 0;
      counters.payments = 0;
    }

    if (bookingIds.length) {
      counters.bookingHistories = (await tx.bookingHistory.deleteMany({ where: { bookingId: { in: bookingIds } } })).count;
      counters.slotReservations = (await tx.slotReservation.deleteMany({ where: { bookingId: { in: bookingIds } } })).count;
      counters.bookings = (await tx.booking.deleteMany({ where: { id: { in: bookingIds } } })).count;
    } else {
      counters.bookingHistories = 0;
      counters.slotReservations = 0;
      counters.bookings = 0;
    }

    const notifications = await tx.notification.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const notificationIds = notifications.map((n) => n.id);

    if (notificationIds.length) {
      counters.deliveryAttempts = (await tx.deliveryAttempt.deleteMany({ where: { notificationId: { in: notificationIds } } })).count;
      counters.notifications = (await tx.notification.deleteMany({ where: { id: { in: notificationIds } } })).count;
    } else {
      counters.deliveryAttempts = 0;
      counters.notifications = 0;
    }

    counters.pushSubscriptions = (await tx.pushSubscription.deleteMany({ where: { userId: { in: userIds } } })).count;
    counters.refreshSessions = (await tx.refreshSession.deleteMany({ where: { userId: { in: userIds } } })).count;
    counters.passwordOtps = (await tx.passwordResetOtp.deleteMany({ where: { userId: { in: userIds } } })).count;
    counters.userRoles = (await tx.userRole.deleteMany({ where: { userId: { in: userIds } } })).count;
    counters.userProfiles = (await tx.userProfile.deleteMany({ where: { userId: { in: userIds } } })).count;
    counters.authUsers = (await tx.authUser.deleteMany({ where: { id: { in: userIds } } })).count;

    return counters;
  });

  console.log("Deleted generated QA/smoke data:");
  console.table(result);
  console.log("Users removed:", testUsers.map((u) => u.email).join(", "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
