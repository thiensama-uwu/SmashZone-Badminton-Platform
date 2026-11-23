const { AppError } = require("../../../shared/lib/errors");
const { prisma } = require("../../../shared/data/prisma");
const { BOOKING_STATES, SLOT_STATES } = require("../../../shared/constants/booking");

/** Khoảng [start,end) của hai đặt chỗ có giao trên trục thời gian cùng ngày. */
function timeRangesOverlap(startA, endA, startB, endB) {
  const toMin = (t) => {
    const [h = 0, m = 0] = String(t)
      .split(":")
      .map((x) => Number(x));
    return h * 60 + (Number.isFinite(m) ? m : 0);
  };
  const a0 = toMin(startA);
  const a1 = toMin(endA);
  const b0 = toMin(startB);
  const b1 = toMin(endB);
  return a0 < b1 && b0 < a1;
}

function serializeBooking(record) {
  if (!record) {
    return null;
  }

  const activeReservations = (record.reservations || []).filter((reservation) =>
    [SLOT_STATES.HOLD, SLOT_STATES.BOOKED, SLOT_STATES.BLOCKED].includes(reservation.status)
  );

  return {
    ...record,
    manualCustomerName: record?.paymentScenario?.manualCustomerName || null,
    currentReservation: activeReservations[0] || null,
    reservations: activeReservations,
    histories: record.histories,
  };
}

class BookingRepository {
  async createHoldBooking({ input, segments, actor, quote, holdTtlMs }) {
    return prisma.$transaction(async (tx) => {
      const sorted = [...segments].sort((a, b) => a.startTime.localeCompare(b.startTime));
      let overallStart = sorted[0].startTime;
      let overallEnd = sorted[0].endTime;
      for (const s of sorted) {
        if (s.startTime < overallStart) overallStart = s.startTime;
        if (s.endTime > overallEnd) overallEnd = s.endTime;
      }

      const slotKeysSorted = [...new Set(sorted.map((s) => `${input.courtId}:${input.date}:${s.startTime}:${s.endTime}`))]
        .sort();
      for (const slotKey of slotKeysSorted) {
        await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", slotKey);
      }

      const blocking = await tx.slotReservation.findMany({
        where: {
          courtId: input.courtId,
          date: input.date,
          status: { in: [SLOT_STATES.HOLD, SLOT_STATES.BOOKED, SLOT_STATES.BLOCKED] },
        },
      });

      for (const seg of sorted) {
        for (const r of blocking) {
          if (timeRangesOverlap(seg.startTime, seg.endTime, r.startTime, r.endTime)) {
            throw new AppError(409, "SLOT_UNAVAILABLE", "Selected slot is already reserved");
          }
        }
      }

      const holdExpiredAt = new Date(Date.now() + holdTtlMs);
      const booking = await tx.booking.create({
        data: {
          bookingCode: `BK-${Date.now()}`,
          userId: actor.sub,
          courtId: input.courtId,
          date: input.date,
          startTime: overallStart,
          endTime: overallEnd,
          status: BOOKING_STATES.PENDING_HOLD,
          origin: input.origin || "customer_app",
          createdBy: actor.sub,
          totalAmount: quote.price,
          pricingSnapshot: quote.pricingSnapshot,
          policySnapshot: quote.policySnapshot,
          paymentScenario: input.paymentScenario || { providerStatus: "success", autoWebhook: false },
          holdExpiredAt,
          rescheduleContext: null,
        },
      });

      const reservations = [];
      for (const seg of sorted) {
        const reservation = await tx.slotReservation.create({
          data: {
            bookingId: booking.id,
            courtId: input.courtId,
            date: input.date,
            startTime: seg.startTime,
            endTime: seg.endTime,
            status: SLOT_STATES.HOLD,
            holdExpiredAt,
          },
        });
        reservations.push(reservation);
      }

      await tx.bookingHistory.create({
        data: {
          bookingId: booking.id,
          userId: actor.sub,
          action: "BOOKING_HELD",
          status: booking.status,
          payload: { ...input, segments: sorted },
        },
      });

      return { booking, reservation: reservations[0], reservations };
    });
  }

  async findBooking(id) {
    const record = await prisma.booking.findUnique({
      where: { id },
      include: {
        reservations: { orderBy: { startTime: "asc" } },
        histories: { orderBy: { createdAt: "desc" } },
      },
    });
    return serializeBooking(record);
  }

  async listBookingsByUser(userId, { page = 1, limit = 20, status } = {}) {
    const skip = (page - 1) * limit;
    const where = { userId, ...(status ? { status } : {}) };
    const [records, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { reservations: { orderBy: { startTime: "asc" } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);
    return {
      items: records.map((item) => serializeBooking(item)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listAllBookings({ page = 1, limit = 50, status, userId: filterUserId, date } = {}) {
    const skip = (page - 1) * limit;
    const where = {
      ...(status ? { status } : {}),
      ...(filterUserId ? { userId: filterUserId } : {}),
      ...(date ? { date } : {}),
    };
    const [records, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { reservations: { orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);
    const userIds = [...new Set(records.map((item) => item.userId).filter(Boolean))];
    const profiles = userIds.length
      ? await prisma.userProfile.findMany({ where: { userId: { in: userIds } }, select: { userId: true, fullName: true } })
      : [];
    const profileMap = new Map(profiles.map((profile) => [profile.userId, profile.fullName]));

    return {
      items: records.map((item) => ({
        ...serializeBooking(item),
        userName: item.origin === "staff_manual"
          ? (item.paymentScenario?.manualCustomerName || "Vãng lai")
          : (profileMap.get(item.userId) || null),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markPendingPayment(bookingId, userId) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BOOKING_STATES.PENDING_PAYMENT,
          version: { increment: 1 },
        },
      });
      await tx.bookingHistory.create({
        data: {
          bookingId,
          userId,
          action: "BOOKING_CREATED",
          status: BOOKING_STATES.PENDING_PAYMENT,
        },
      });
      return booking;
    });
  }

  async cancelBooking({ booking, status, cancelledBy, cancelReason, refundAmount, refundRecipient }) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status,
          cancelledBy,
          cancelReason,
          version: { increment: 1 },
          holdExpiredAt: null,
        },
      });

      await tx.slotReservation.updateMany({
        where: { bookingId: booking.id, status: { in: [SLOT_STATES.HOLD, SLOT_STATES.BOOKED] } },
        data: { status: SLOT_STATES.AVAILABLE, holdExpiredAt: null },
      });

      await tx.bookingHistory.create({
        data: {
          bookingId: booking.id,
          userId: cancelledBy,
          action: "BOOKING_CANCELLED",
          status,
          payload: { refundAmount, cancelReason, refundRecipient },
        },
      });

      return updated;
    });
  }

  async createRescheduleDraft({ booking, input, quote, actorId, holdTtlMs }) {
    return prisma.$transaction(async (tx) => {
      const slotKey = `${input.courtId}:${input.date}:${input.startTime}:${input.endTime}`;
      // `pg_advisory_xact_lock` returns `void`; use executeRaw to avoid Prisma deserialization errors.
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", slotKey);

      const conflict = await tx.slotReservation.findFirst({
        where: {
          courtId: input.courtId,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          bookingId: { not: booking.id },
          status: { in: [SLOT_STATES.HOLD, SLOT_STATES.BOOKED, SLOT_STATES.BLOCKED] },
        },
      });

      if (conflict) {
        throw new AppError(409, "SLOT_UNAVAILABLE", "New slot is already reserved");
      }

      const newReservation = await tx.slotReservation.create({
        data: {
          bookingId: booking.id,
          courtId: input.courtId,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          status: SLOT_STATES.HOLD,
          holdExpiredAt: new Date(Date.now() + holdTtlMs),
        },
      });

      const delta = quote.price - booking.totalAmount;
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          rescheduleContext: {
            oldCourtId: booking.courtId,
            oldDate: booking.date,
            oldStartTime: booking.startTime,
            oldEndTime: booking.endTime,
            newReservationId: newReservation.id,
            newCourtId: input.courtId,
            newDate: input.date,
            newStartTime: input.startTime,
            newEndTime: input.endTime,
            newPrice: quote.price,
            pricingSnapshot: quote.pricingSnapshot,
            policySnapshot: quote.policySnapshot,
            delta,
          },
          status: delta > 0 ? BOOKING_STATES.PENDING_PAYMENT : booking.status,
          version: { increment: 1 },
        },
      });

      await tx.bookingHistory.create({
        data: {
          bookingId: booking.id,
          userId: actorId,
          action: delta > 0 ? "BOOKING_RESCHEDULE_PENDING_PAYMENT" : "BOOKING_RESCHEDULED",
          status: delta > 0 ? BOOKING_STATES.PENDING_PAYMENT : booking.status,
          payload: { delta, input },
        },
      });

      return { booking: updatedBooking, delta, newReservation };
    });
  }

  async finalizeRescheduleSuccess(bookingId) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking || !booking.rescheduleContext) {
        return booking;
      }

      const context = booking.rescheduleContext;
      await tx.slotReservation.updateMany({
        where: {
          bookingId,
          courtId: context.oldCourtId,
          date: context.oldDate,
          startTime: context.oldStartTime,
          endTime: context.oldEndTime,
          status: { in: [SLOT_STATES.HOLD, SLOT_STATES.BOOKED] },
        },
        data: { status: SLOT_STATES.AVAILABLE, holdExpiredAt: null },
      });

      await tx.slotReservation.update({
        where: { id: context.newReservationId },
        data: { status: SLOT_STATES.BOOKED, holdExpiredAt: null },
      });

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          courtId: context.newCourtId,
          date: context.newDate,
          startTime: context.newStartTime,
          endTime: context.newEndTime,
          totalAmount: context.newPrice,
          pricingSnapshot: context.pricingSnapshot,
          policySnapshot: context.policySnapshot,
          status: BOOKING_STATES.CONFIRMED,
          holdExpiredAt: null,
          rescheduleContext: null,
          version: { increment: 1 },
        },
      });

      await tx.bookingHistory.create({
        data: {
          bookingId,
          userId: booking.userId,
          action: "BOOKING_RESCHEDULED",
          status: BOOKING_STATES.CONFIRMED,
          payload: context,
        },
      });

      return updated;
    });
  }

  async rollbackReschedule(bookingId) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking || !booking.rescheduleContext) {
        return booking;
      }

      const context = booking.rescheduleContext;
      await tx.slotReservation.update({
        where: { id: context.newReservationId },
        data: { status: SLOT_STATES.AVAILABLE, holdExpiredAt: null },
      });

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BOOKING_STATES.CONFIRMED,
          rescheduleContext: null,
          holdExpiredAt: null,
          version: { increment: 1 },
        },
      });

      await tx.bookingHistory.create({
        data: {
          bookingId,
          userId: booking.userId,
          action: "RESCHEDULE_PAYMENT_FAILED",
          status: BOOKING_STATES.CONFIRMED,
          payload: context,
        },
      });

      return updated;
    });
  }

  async confirmBooking(bookingId, action = "PAYMENT_COMPLETED") {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BOOKING_STATES.CONFIRMED,
          holdExpiredAt: null,
          version: { increment: 1 },
        },
      });
      await tx.slotReservation.updateMany({
        where: { bookingId, status: SLOT_STATES.HOLD },
        data: { status: SLOT_STATES.BOOKED, holdExpiredAt: null },
      });
      await tx.bookingHistory.create({
        data: {
          bookingId,
          userId: updated.userId,
          action,
          status: BOOKING_STATES.CONFIRMED,
        },
      });
      return updated;
    });
  }

  async failBooking(bookingId, status = BOOKING_STATES.CANCELLED, action = "PAYMENT_FAILED") {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status,
          holdExpiredAt: null,
          version: { increment: 1 },
        },
      });
      await tx.slotReservation.updateMany({
        where: { bookingId, status: { in: [SLOT_STATES.HOLD, SLOT_STATES.BOOKED] } },
        data: { status: SLOT_STATES.AVAILABLE, holdExpiredAt: null },
      });
      await tx.bookingHistory.create({
        data: {
          bookingId,
          userId: updated.userId,
          action,
          status,
        },
      });
      return updated;
    });
  }

  async checkIn(bookingId, actorId) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BOOKING_STATES.CHECKED_IN,
          version: { increment: 1 },
        },
      });
      await tx.bookingHistory.create({
        data: {
          bookingId,
          userId: actorId,
          action: "BOOKING_CHECKED_IN",
          status: BOOKING_STATES.CHECKED_IN,
        },
      });
      return updated;
    });
  }

  async markRefunded(bookingId, amount) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BOOKING_STATES.REFUNDED,
          version: { increment: 1 },
        },
      });
      await tx.bookingHistory.create({
        data: {
          bookingId,
          userId: updated.userId,
          action: "REFUND_COMPLETED",
          status: BOOKING_STATES.REFUNDED,
          payload: { amount },
        },
      });
      return updated;
    });
  }

  async completeBooking(bookingId, actorId) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BOOKING_STATES.COMPLETED,
          version: { increment: 1 },
        },
      });
      await tx.bookingHistory.create({
        data: {
          bookingId,
          userId: actorId,
          action: "BOOKING_COMPLETED",
          status: BOOKING_STATES.COMPLETED,
        },
      });
      return updated;
    });
  }

  async listReservations({ courtId, date }) {
    return prisma.slotReservation.findMany({
      where: {
        courtId,
        date,
        status: { in: [SLOT_STATES.HOLD, SLOT_STATES.BOOKED, SLOT_STATES.BLOCKED] },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async findExpiredHolds(now) {
    return prisma.booking.findMany({
      where: {
        status: BOOKING_STATES.PENDING_HOLD,
        holdExpiredAt: { lte: now },
      },
    });
  }

  async saveOutbox(event) {
    return prisma.bookingOutboxEvent.create({
      data: {
        eventId: event.event_id,
        eventType: event.event_type,
        aggregateId: event.aggregate_id,
        schemaVersion: event.schema_version,
        correlationId: event.correlation_id || null,
        payload: event.payload,
      },
    });
  }

  async getUnpublishedOutboxEvents({ limit = 50 }) {
    return prisma.bookingOutboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async markOutboxPublished(eventId) {
    return prisma.bookingOutboxEvent.update({
      where: { eventId },
      data: { publishedAt: new Date() },
    });
  }
}

module.exports = {
  BookingRepository,
};
