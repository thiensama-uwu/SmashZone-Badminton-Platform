const { NOTIFICATION_RETRY_MS } = require("../../../shared/constants/booking");

const CUSTOMER_EVENT_TYPES = new Set([
  "booking.confirmed",
  "booking.cancelled",
  "booking.rescheduled",
  "booking.refunded",
  "payment.failed",
  "booking.expired",
]);

const STAFF_EVENT_TYPES = new Set([
  "booking.created",
  "booking.confirmed",
]);

function formatMoney(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return `${value.toLocaleString("vi-VN")}đ`;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("vi-VN");
}

function bookingLine(booking) {
  if (!booking) return "";
  const code = booking.bookingCode || booking.id;
  const date = formatDate(booking.date) || booking.date;
  return `Mã ${code}, ${date}, ${booking.startTime}-${booking.endTime}`;
}

class NotificationService {
  constructor({ repository, config }) {
    this.repository = repository;
    this.config = config;
  }

  async saveSubscription(userId, subscription) {
    return this.repository.saveSubscription(userId, subscription);
  }

  async listHistory(userId) {
    return this.repository.listByUser(userId);
  }

  async markRead(userId, ids) {
    return this.repository.markRead(userId, ids);
  }

  async dispatchFromEvent(event) {
    const isCustomerEvent = CUSTOMER_EVENT_TYPES.has(event.event_type);
    const isStaffEvent = STAFF_EVENT_TYPES.has(event.event_type);

    if (!isCustomerEvent && !isStaffEvent) {
      return;
    }

    const inferredBookingId = event.payload?.bookingId || (event.event_type.startsWith("booking.") ? event.aggregate_id : null);
    const booking = inferredBookingId ? await this.repository.findBookingBrief(inferredBookingId) : null;
    
    // Determine target user IDs
    let targetUserIds = [];
    if (isCustomerEvent) {
      const uId = event.payload?.userId || booking?.userId;
      if (uId) targetUserIds.push(uId);
    }
    if (isStaffEvent) {
      const staffIds = await this.repository.getStaffUserIds();
      targetUserIds = [...new Set([...targetUserIds, ...staffIds])];
    }

    if (targetUserIds.length === 0) {
      return;
    }

    const enrichedPayload = {
      ...(event.payload || {}),
      bookingId: event.payload?.bookingId || booking?.id || null,
      bookingCode: booking?.bookingCode || null,
      date: booking?.date || null,
      startTime: booking?.startTime || null,
      endTime: booking?.endTime || null,
      totalAmount: event.payload?.totalAmount || booking?.totalAmount || null,
    };
    const message = this.buildMessage(event, booking, enrichedPayload);

    for (const userId of targetUserIds) {
      const dedupKey = `${userId}:${event.event_type}:${event.aggregate_id}:v2`; // bumped version to v2
      if (await this.repository.hasDedup(dedupKey)) {
        continue;
      }

      const subscription = await this.repository.getSubscription(userId);
      const channel = subscription ? "web-push" : "in-app";
      const log = await this.repository.createLog({
        userId,
        eventType: event.event_type,
        aggregateId: event.aggregate_id,
        channel,
        message,
        payload: enrichedPayload,
        dedupKey,
        correlationId: event.correlation_id,
      });

      await this.repository.addAttempt({ notificationId: log.id, attempt: 1, status: "SENT", nextRetryAt: null });
      this.config.logger.info("Notification dispatched", { notificationId: log.id, userId, eventType: event.event_type });
    }
  }

  buildMessage(event, booking, payload) {
    const bookingInfo = bookingLine(booking);
    const totalAmount = formatMoney(payload?.totalAmount);
    const refundAmount = formatMoney(payload?.refundAmount || payload?.amount);
    const deltaAmount = formatMoney(payload?.delta);
    const isStaffEvent = STAFF_EVENT_TYPES.has(event.event_type);

    switch (event.event_type) {
      case "booking.confirmed":
        if (isStaffEvent) {
          return bookingInfo
            ? `Khách hàng đã thanh toán thành công. ${bookingInfo}.${totalAmount ? ` Số tiền: ${totalAmount}.` : ""}`
            : `Khách hàng đã thanh toán thành công cho đặt sân.${totalAmount ? ` Số tiền: ${totalAmount}.` : ""}`;
        }
        return bookingInfo
          ? `Đặt sân đã được xác nhận. ${bookingInfo}.`
          : "Đặt sân đã được xác nhận thành công.";
      case "booking.cancelled":
        if (refundAmount) {
          return bookingInfo
            ? `Đặt sân đã bị hủy. ${bookingInfo}. Số tiền hoàn dự kiến: ${refundAmount}.`
            : `Đặt sân đã bị hủy. Số tiền hoàn dự kiến: ${refundAmount}.`;
        }
        return bookingInfo
          ? `Đặt sân đã bị hủy. ${bookingInfo}.`
          : "Đặt sân đã bị hủy.";
      case "booking.rescheduled":
        if (deltaAmount && payload?.delta > 0) {
          return bookingInfo
            ? `Đổi lịch thành công. ${bookingInfo}. Bạn đã thanh toán bổ sung ${deltaAmount}.`
            : `Đổi lịch thành công. Bạn đã thanh toán bổ sung ${deltaAmount}.`;
        }
        if (deltaAmount && payload?.delta < 0) {
          return bookingInfo
            ? `Đổi lịch thành công. ${bookingInfo}. Số tiền chênh lệch hoàn lại: ${formatMoney(Math.abs(payload.delta))}.`
            : `Đổi lịch thành công. Số tiền chênh lệch hoàn lại: ${formatMoney(Math.abs(payload.delta))}.`;
        }
        return bookingInfo
          ? `Đổi lịch thành công. ${bookingInfo}.`
          : "Đổi lịch thành công.";
      case "booking.refunded":
        if (refundAmount) {
          return bookingInfo
            ? `Hoàn tiền thành công ${refundAmount}. ${bookingInfo}.`
            : `Hoàn tiền thành công ${refundAmount}.`;
        }
        return bookingInfo
          ? `Hoàn tiền cho đặt sân đã hoàn tất. ${bookingInfo}.`
          : "Hoàn tiền cho đặt sân đã hoàn tất.";
      case "payment.failed":
        return bookingInfo
          ? `Thanh toán thất bại. ${bookingInfo}.${totalAmount ? ` Số tiền: ${totalAmount}.` : ""}`
          : `Thanh toán thất bại cho đặt sân.${totalAmount ? ` Số tiền: ${totalAmount}.` : ""}`;
      case "booking.expired":
        return bookingInfo
          ? `Giữ chỗ đã hết hạn do quá thời gian thanh toán. ${bookingInfo}.`
          : "Giữ chỗ đã hết hạn do quá thời gian thanh toán.";
      case "booking.created":
        return bookingInfo
          ? `Có đơn đặt sân mới đang chờ xác nhận: ${bookingInfo}.`
          : "Có đơn đặt sân mới đang chờ xác nhận và thanh toán.";
      default:
        return "Bạn có thông báo mới.";
    }
  }

  async scheduleRetry(notificationId, attempt) {
    const retryDelay = NOTIFICATION_RETRY_MS[attempt - 1] || null;
    return this.repository.addAttempt({
      notificationId,
      attempt,
      status: retryDelay ? "RETRY_SCHEDULED" : "DLQ",
      nextRetryAt: retryDelay ? new Date(Date.now() + retryDelay) : null,
    });
  }
}

module.exports = {
  NotificationService,
};
