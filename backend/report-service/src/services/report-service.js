const { prisma } = require("../../../shared/data/prisma");

const VN_TIMEZONE = "Asia/Ho_Chi_Minh";
const MONEY_IN_STATUSES = ["COMPLETED", "REFUNDED"];
const MONEY_OUT_STATUSES = ["PENDING", "SUCCEEDED", "FAILED"];

function dateRangeFilter({ from, to } = {}) {
  if (!from && !to) return {};
  const filter = {};
  if (from) filter.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) {
    const end = new Date(`${to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    filter.lt = end;
  }
  return filter;
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCustomer(booking, profileMap) {
  if (!booking) return "";
  if (booking.origin === "staff_manual") {
    return booking.paymentScenario?.manualCustomerName || "Vãng lai";
  }
  return profileMap.get(booking.userId) || "";
}

async function listRefundExportRows({ from, to } = {}) {
  const where = [];
  const params = [];

  if (from) {
    params.push(new Date(`${from}T00:00:00.000Z`));
    where.push(`created_at >= $${params.length}`);
  }
  if (to) {
    const end = new Date(`${to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    params.push(end);
    where.push(`created_at < $${params.length}`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const rows = await prisma.$queryRawUnsafe(`
    select
      id,
      payment_id as "paymentId",
      booking_id as "bookingId",
      amount,
      reason,
      status,
      refund_bank_name as "refundBankName",
      refund_account_number as "refundAccountNumber",
      refund_account_name as "refundAccountName",
      completed_at as "completedAt",
      created_at as "createdAt"
    from payment.refunds
    ${whereSql}
    order by created_at asc
  `, ...params);

  return rows.filter((refund) => MONEY_OUT_STATUSES.includes(refund.status));
}

function toVietnamDateParts(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return {
    year: map.year,
    month: map.month,
    day: map.day,
  };
}

class ReportService {
  async getSummary({ from, to } = {}) {
    const bookingWhere = { 
      status: { in: ["CONFIRMED", "CHECKED_IN"] }
    };
    const revenueWhere = { 
      status: { in: ["CONFIRMED", "CHECKED_IN"] }
    };

    if (from || to) {
      const dateFilter = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      bookingWhere.createdAt = dateFilter;
      revenueWhere.createdAt = dateFilter;
    }

    const [totalBookings, activeCourts, totalUsers] = await Promise.all([
      prisma.booking.count({ where: bookingWhere }),
      prisma.court.count({ where: { status: "ACTIVE" } }),
      prisma.authUser.count(),
    ]);

    const confirmed = await prisma.booking.count({ where: { ...bookingWhere, status: { in: ["CONFIRMED", "CHECKED_IN"] } } });

    const revenue = await prisma.booking.aggregate({
      where: revenueWhere,
      _sum: { totalAmount: true },
    });

    return {
      totalBookings,
      confirmedBookings: confirmed,
      activeCourts,
      totalUsers,
      totalRevenue: revenue._sum.totalAmount || 0,
    };
  }

  async getRevenue({ from, to, groupBy = "day" }) {
    const where = {
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    };

    const bookings = await prisma.booking.findMany({
      where,
      select: { date: true, totalAmount: true, courtId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const grouped = {};
    for (const b of bookings) {
      const paymentDate = new Date(b.createdAt);
      const vnDate = toVietnamDateParts(paymentDate);
      const monthIndex = Number(vnDate.month) - 1;
      let key;
      if (groupBy === "year") {
        key = vnDate.year;
      } else if (groupBy === "quarter") {
        const quarter = Math.floor(monthIndex / 3) + 1;
        key = `${vnDate.year}-Q${quarter}`;
      } else if (groupBy === "month") {
        key = `${vnDate.year}-${vnDate.month}`;
      } else if (groupBy === "week") {
        const vnLocalMidnight = new Date(`${vnDate.year}-${vnDate.month}-${vnDate.day}T00:00:00+07:00`);
        const dayOfWeek = vnLocalMidnight.getUTCDay(); // 0: Sunday ... 6: Saturday
        const dayOffset = (dayOfWeek + 6) % 7; // Monday-based week
        const weekStart = new Date(vnLocalMidnight);
        weekStart.setUTCDate(vnLocalMidnight.getUTCDate() - dayOffset);
        const weekStartVn = toVietnamDateParts(weekStart);
        key = `${weekStartVn.year}-${weekStartVn.month}-${weekStartVn.day}`;
      } else {
        key = `${vnDate.year}-${vnDate.month}-${vnDate.day}`;
      }
      if (!grouped[key]) grouped[key] = { period: key, revenue: 0, count: 0 };
      grouped[key].revenue += b.totalAmount;
      grouped[key].count += 1;
    }

    const items = Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
    const totalRevenue = bookings.reduce((s, b) => s + b.totalAmount, 0);
    const totalCount = bookings.length;

    return { items, totalRevenue, totalCount, groupBy, from: from || null, to: to || null };
  }

  async getExportData({ from, to } = {}) {
    const range = dateRangeFilter({ from, to });
    const paymentWhere = {
      status: { in: MONEY_IN_STATUSES },
      ...(from || to ? { updatedAt: range } : {}),
    };
    const payments = await prisma.payment.findMany({ where: paymentWhere, orderBy: { updatedAt: "asc" } });
    const refunds = await listRefundExportRows({ from, to });

    const bookingIds = [...new Set([
      ...payments.map((payment) => payment.bookingId),
      ...refunds.map((refund) => refund.bookingId),
    ].filter(Boolean))];

    const bookings = bookingIds.length
      ? await prisma.booking.findMany({ where: { id: { in: bookingIds } } })
      : [];
    const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));

    const courtIds = [...new Set(bookings.map((booking) => booking.courtId).filter(Boolean))];
    const userIds = [...new Set(bookings.map((booking) => booking.userId).filter(Boolean))];

    const [courts, profiles] = await Promise.all([
      courtIds.length ? prisma.court.findMany({ where: { id: { in: courtIds } }, select: { id: true, name: true } }) : [],
      userIds.length ? prisma.userProfile.findMany({ where: { userId: { in: userIds } }, select: { userId: true, fullName: true } }) : [],
    ]);

    const courtMap = new Map(courts.map((court) => [court.id, court.name]));
    const profileMap = new Map(profiles.map((profile) => [profile.userId, profile.fullName]));

    const incomeRows = payments.map((payment) => {
      const booking = bookingMap.get(payment.bookingId);
      return {
        "Mã thanh toán": payment.id,
        "Mã booking": booking?.bookingCode || payment.bookingId,
        "Ngày ghi nhận thanh toán": formatDateTime(payment.updatedAt),
        "Ngày đặt sân": booking?.date || "",
        "Khách hàng": formatCustomer(booking, profileMap),
        "Sân": booking ? courtMap.get(booking.courtId) || "" : "",
        "Khung giờ": booking ? `${booking.startTime} - ${booking.endTime}` : "",
        "Số tiền vào": payment.amount,
        "Loại thanh toán": payment.type,
        "Trạng thái thanh toán": payment.status,
        "Mã giao dịch ngân hàng": payment.providerTransactionId || "",
      };
    });

    const expenseRows = refunds.map((refund) => {
      const booking = bookingMap.get(refund.bookingId);
      return {
        "Mã hoàn tiền": refund.id,
        "Mã thanh toán": refund.paymentId,
        "Mã booking": booking?.bookingCode || refund.bookingId,
        "Ngày tạo yêu cầu hoàn": formatDateTime(refund.createdAt),
        "Ngày hoàn tất": formatDateTime(refund.completedAt),
        "Khách hàng": formatCustomer(booking, profileMap),
        "Sân": booking ? courtMap.get(booking.courtId) || "" : "",
        "Số tiền ra": refund.amount,
        "Lý do hoàn tiền": refund.reason,
        "Trạng thái hoàn tiền": refund.status,
        "Ngân hàng nhận": refund.refundBankName || "",
        "Số tài khoản nhận": refund.refundAccountNumber || "",
        "Tên chủ tài khoản": refund.refundAccountName || "",
      };
    });

    const totalMoneyIn = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const totalMoneyOut = refunds
      .filter((refund) => refund.status === "SUCCEEDED")
      .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);

    return {
      overviewRows: [
        { "Chỉ tiêu": "Từ ngày", "Giá trị": from || "" },
        { "Chỉ tiêu": "Đến ngày", "Giá trị": to || "" },
        { "Chỉ tiêu": "Tổng tiền vào", "Giá trị": totalMoneyIn },
        { "Chỉ tiêu": "Tổng tiền ra", "Giá trị": totalMoneyOut },
        { "Chỉ tiêu": "Doanh thu thuần", "Giá trị": totalMoneyIn - totalMoneyOut },
        { "Chỉ tiêu": "Tổng số booking", "Giá trị": bookings.length },
        { "Chỉ tiêu": "Số booking đã thanh toán / đã xác nhận", "Giá trị": payments.length },
        { "Chỉ tiêu": "Số giao dịch hoàn tiền", "Giá trị": refunds.length },
        { "Chỉ tiêu": "Thời điểm xuất báo cáo", "Giá trị": formatDateTime(new Date()) },
      ],
      incomeRows,
      expenseRows,
    };
  }
}

module.exports = {
  ReportService,
};
