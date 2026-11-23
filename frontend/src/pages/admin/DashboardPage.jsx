import { useState, useCallback } from 'react';
import { TrendingUp, Users, CalendarDays, MapPin, ArrowUpRight, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import { reportsApi } from '../../api/index';
import { bookingsApi } from '../../api/bookings';
import { useApi } from '../../hooks/useApi';
import AsyncState, { StatSkeleton } from '../../components/AsyncState';
import { useToast } from '../../contexts/useToast';

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const REVENUE_FILTERS = [
  { label: 'Ngày', groupBy: 'day' },
  { label: 'Tháng', groupBy: 'month' },
  { label: 'Năm', groupBy: 'year' },
];
const REVENUE_BOOKING_STATUSES = new Set(['CONFIRMED', 'CHECKED_IN']);

const statusBadge = {
  CONFIRMED:       { label: 'Đã xác nhận', cls: 'bg-emerald-500/20 text-emerald-600' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', cls: 'bg-amber-500/20 text-amber-600' },
  PENDING_HOLD:    { label: 'Chờ xử lý', cls: 'bg-blue-500/20 text-blue-600' },
  CANCELLED:       { label: 'Đã hủy', cls: 'bg-red-500/20 text-red-600' },
  REFUNDED:        { label: 'Đã hoàn tiền', cls: 'bg-slate-500/20 text-slate-600' },
  CHECKED_IN:      { label: 'Đã check-in', cls: 'bg-green-500/20 text-green-600' },
};

// YC13: Format time correctly
function formatBookingTime(booking) {
  const dateStr = booking.date || '';
  const timeStr = booking.startTime || '';
  if (dateStr && timeStr) {
    return `${dateStr} • ${timeStr}`;
  }
  if (booking.createdAt) {
    const d = new Date(booking.createdAt);
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
  return dateStr || '—';
}

function toLocalYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toVietnamYMD(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = {};
  parts.forEach((part) => {
    if (part.type !== 'literal') map[part.type] = part.value;
  });
  return `${map.year}-${map.month}-${map.day}`;
}

function monthStart() { const d = new Date(); d.setDate(1); return toLocalYMD(d); }
function monthEnd() { const d = new Date(); return toLocalYMD(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }

function formatShort(n) {
  const value = Number(n ?? 0);
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(0) + 'K';
  return String(value);
}

function normalizeRevenuePeriod(period, groupBy) {
  if (groupBy === 'year') return String(period).slice(0, 4);
  if (groupBy === 'month') return String(period).slice(0, 7);
  return period;
}

function RevenueAreaChart({ items, groupBy, onPeriodClick }) {
  const categories = items.map(item => {
    if (groupBy === 'day') {
      return parseInt(item.period.slice(8));
    } else if (groupBy === 'month') {
      return `T${parseInt(item.period.slice(5))}`;
    } else {
      return item.period;
    }
  });

  const revenueData = items.map(item => Number(item.revenue || 0));

  const chartOptions = {
    series: [{
      name: 'Doanh thu',
      data: revenueData
    }],
    chart: {
      type: 'area',
      height: 280,
      fontFamily: 'Inter, system-ui, sans-serif',
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      },
      events: {
        dataPointSelection: function(event, chartContext, config) {
          const dataIndex = config.dataPointIndex;
          if (dataIndex !== -1 && items[dataIndex]) {
            onPeriodClick(items[dataIndex]);
          }
        },
        markerClick: function(event, chartContext, { dataPointIndex }) {
          if (dataPointIndex !== -1 && items[dataPointIndex]) {
            onPeriodClick(items[dataPointIndex]);
          }
        },
        click: function(event, chartContext, config) {
          if (config.dataPointIndex !== undefined && config.dataPointIndex !== -1 && items[config.dataPointIndex]) {
            onPeriodClick(items[config.dataPointIndex]);
          }
        }
      }
    },
    colors: ['#0ea5e9'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 90, 100]
      }
    },
    stroke: {
      curve: 'smooth',
      width: 3,
      lineCap: 'round'
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: categories,
      labels: {
        style: {
          colors: '#64748b',
          fontSize: '11px',
          fontWeight: 500
        },
        rotate: groupBy === 'day' ? -45 : 0
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: {
          colors: '#64748b',
          fontSize: '11px',
          fontWeight: 500
        },
        formatter: function (value) {
          return formatShort(value);
        }
      }
    },
    grid: {
      borderColor: '#e2e8f0',
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
      padding: { top: 0, right: 0, bottom: 0, left: 10 }
    },
    tooltip: {
      theme: 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      y: {
        formatter: function (value) {
          return formatShort(value) + 'đ';
        }
      },
      custom: function ({ series, seriesIndex, dataPointIndex }) {
        const value = series[seriesIndex][dataPointIndex];
        const category = categories[dataPointIndex];
        return `
          <div class="apexcharts-tooltip-custom">
            <div style="padding: 8px 12px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <div style="font-size: 12px; color: #64748b; font-weight: 500; margin-bottom: 4px;">
                ${category}
              </div>
              <div style="font-size: 14px; color: #0f172a; font-weight: 600;">
                ${formatShort(value)}đ
              </div>
            </div>
          </div>
        `;
      }
    },
    markers: {
      size: 4,
      colors: ['#ffffff'],
      strokeColors: ['#0ea5e9'],
      strokeWidth: 2,
      hover: { size: 6 },
      showNullDataPoints: true
    },
    responsive: [
      {
        breakpoint: 640,
        options: {
          chart: { height: 240 },
          xaxis: {
            labels: { style: { fontSize: '10px' } }
          },
          yaxis: {
            labels: { style: { fontSize: '10px' } }
          }
        }
      }
    ]
  };

  return (
    <div className="w-full">
      <ReactApexChart
        options={chartOptions}
        series={chartOptions.series}
        type="area"
        height={280}
      />
    </div>
  );
}

export default function DashboardPage() {
  const toast = useToast();
  const [recentPage, setRecentPage] = useState(1);
  const [revenueFilter, setRevenueFilter] = useState('day');
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  const bookingFetcher = useCallback(() => bookingsApi.listAll({ limit: 1000 }), []);
  const summaryFetcher = useCallback(() => reportsApi.getSummary(), []);

  const {
    data: bookingData, loading: loadingB, refresh: refreshB,
  } = useApi('admin:bookings:history', bookingFetcher, {
    ttlMs: 60_000,
    onError: (err) => toast.error(err.message || 'Không thể tải dữ liệu booking.'),
  });

  const {
    data: summary, loading: _loadingR, refresh: refreshR,
  } = useApi('admin:reports:summary', summaryFetcher, {
    ttlMs: 60_000,
    onError: () => {}, // silent — summary is optional
  });

  const loading = loadingB;

  const revenueFetcher = useCallback(() => reportsApi.getRevenue({ groupBy: revenueFilter }), [revenueFilter]);
  const { data: revenueData, loading: loadingRevenue, refresh: refreshRevenue } = useApi(
    `admin:dashboard:revenue:${revenueFilter}`,
    revenueFetcher,
    { ttlMs: 60_000, onError: () => {} }
  );

  const allBookings = bookingData?.items || (Array.isArray(bookingData) ? bookingData : []);
  const revenueBookings = allBookings.filter((b) => REVENUE_BOOKING_STATUSES.has(b.status));

  const periodPredicate = (booking) => {
    const bookingDate = toVietnamYMD(new Date(booking.createdAt));
    if (revenueFilter === 'day') return bookingDate === selectedPeriod.period;
    if (revenueFilter === 'month') return bookingDate.slice(0, 7) === selectedPeriod.period;
    if (revenueFilter === 'year') return bookingDate.slice(0, 4) === selectedPeriod.period;
    return bookingDate === selectedPeriod.period;
  };
  // Revenue/KPI booking count follows chart revenue statuses only
  const filteredBookings = selectedPeriod ? revenueBookings.filter(periodPredicate) : revenueBookings;
  // Status donut must include all booking statuses in selected period
  const statusBookings = selectedPeriod ? allBookings.filter(periodPredicate) : allBookings;
  const visibleStatusBookings = statusBookings.filter((b) => b.status !== 'CANCELLED');

  const statusCounts = visibleStatusBookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const kpis = [
    {
      label: 'Tổng doanh thu',
      value: selectedPeriod ? formatShort(selectedPeriod._displayData?.revenue ?? selectedPeriod.revenue) : (summary ? formatShort(summary.totalRevenue) : '—'),
      icon: TrendingUp,
      color: 'bg-emerald-100 text-emerald-600'
    },
    {
      label: 'Tổng booking',
      value: selectedPeriod ? filteredBookings.length : (summary?.totalBookings ?? '—'),
      icon: CalendarDays,
      color: 'bg-amber-100 text-amber-600'
    },
    { label: 'Sân hoạt động', value: summary?.activeCourts ?? '—', icon: MapPin, color: 'bg-blue-100 text-blue-600' },
    { label: 'Người dùng', value: summary?.totalUsers ?? '—', icon: Users, color: 'bg-purple-100 text-purple-600' },
  ];

  const revenueItemsRaw = revenueData?.items || [];
  
  // Padding revenue items to show full ranges
  const paddedRevenueItems = (() => {
    if (!revenueData) return revenueItemsRaw;
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentYearPrefix = `${now.getFullYear()}-`;

    const scopedItems = revenueItemsRaw.filter((item) => {
      const period = normalizeRevenuePeriod(item.period, revenueFilter);
      if (revenueFilter === 'day') return String(period).startsWith(currentMonthPrefix);
      if (revenueFilter === 'month') return String(period).startsWith(currentYearPrefix);
      return true;
    });

    const rawItems = scopedItems.reduce((acc, item) => {
      const period = normalizeRevenuePeriod(item.period, revenueFilter);
      const current = acc[period] || { period, revenue: 0, count: 0 };
      current.revenue += Number(item.revenue || 0);
      current.count += Number(item.count || 0);
      acc[period] = current;
      return acc;
    }, {});
    const normalizedItems = Object.values(rawItems);
    const itemMap = {};
    normalizedItems.forEach(i => { itemMap[i.period] = i; });

    let expectedPeriods = [];
    const y = new Date().getFullYear();

    if (revenueFilter === 'day') {
      // Show all days 1-31 of current month
      const fromDate = new Date(monthStart());
      const toDate = new Date(monthEnd());
      const current = new Date(fromDate);
      while (current <= toDate) {
        expectedPeriods.push(toLocalYMD(current));
        current.setDate(current.getDate() + 1);
      }
    } else if (revenueFilter === 'month') {
      // Show all months 1-12 of current year
      for (let i = 1; i <= 12; i++) {
        expectedPeriods.push(`${y}-${String(i).padStart(2, '0')}`);
      }
    } else if (revenueFilter === 'year') {
      // Show years 2025-2030
      for (let i = 2025; i <= 2030; i++) {
        expectedPeriods.push(`${i}`);
      }
    }

    const periods = Array.from(new Set([...expectedPeriods, ...normalizedItems.map(i => i.period)])).sort();
    return periods.map(p => itemMap[p] || { period: p, revenue: 0, count: 0 });
  })();

  const revenueItems = paddedRevenueItems;

  const RECENT_PAGE_SIZE = 4;
  // Recent bookings - paginate across full filtered dataset
  const recentBookings = (selectedPeriod ? filteredBookings : allBookings).filter((b) => b.status !== 'CANCELLED');
  const recentTotalPages = Math.ceil(recentBookings.length / RECENT_PAGE_SIZE);
  const recentPaginated = recentBookings.slice(
    (recentPage - 1) * RECENT_PAGE_SIZE,
    recentPage * RECENT_PAGE_SIZE
  );

  const handleRefresh = () => { refreshB(); refreshR(); refreshRevenue(); setRecentPage(1); };

  const handlePeriodClick = (periodData) => {
    setSelectedPeriod(periodData);
  };

  const handleResetSelection = () => {
    setSelectedPeriod(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1a1a1a]">Dashboard</h1>
        <button onClick={handleRefresh} disabled={loading}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-black/5 hover:bg-white/50 transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <StatSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
          {kpis.map((kpi, i) => (
            <div key={i} className="rounded-2xl border border-black/5 bg-[#f5f3ee] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-0.5 hover:border-amber-400/30">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.color}`}>
                  <kpi.icon size={20} />
                </div>
                {i === 0 && (summary?.totalBookings ?? 0) > 0 && (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
                    <ArrowUpRight size={12} /> Live
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold text-[#1a1a1a]">{kpi.value}</p>
              <p className="text-sm mt-1 text-[#6b6b6b]">{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Revenue Chart - Full Width */}
      <div className="rounded-2xl border border-black/5 bg-[#f5f3ee] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-[#1a1a1a]">Doanh thu</h3>
            {selectedPeriod && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6b6b6b]">Đã chọn:</span>
                <span className="text-xs font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  {revenueFilter === 'day' ? `Ngày ${parseInt(selectedPeriod.period.slice(8))}` : revenueFilter === 'month' ? `Tháng ${parseInt(selectedPeriod.period.slice(5))}` : selectedPeriod.period}
                </span>
                <button
                  onClick={handleResetSelection}
                  className="text-xs text-[#6b6b6b] hover:text-[#1a1a1a] underline"
                >
                  Đặt lại
                </button>
              </div>
            )}
          </div>
          <div className="flex rounded-lg overflow-hidden bg-surface-low">
            {REVENUE_FILTERS.map((item) => (
              <button
                key={item.groupBy}
                onClick={() => {
                  setRevenueFilter(item.groupBy);
                  setSelectedPeriod(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${revenueFilter === item.groupBy ? 'bg-primary text-white font-semibold' : 'text-muted hover:bg-white/50'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <AsyncState loading={loadingRevenue} skeletonType="card" skeletonRows={1}>
          {revenueItems.length === 0 ? (
            <p className="text-sm text-center py-10 text-[#6b6b6b]">Chưa có dữ liệu doanh thu.</p>
          ) : (
            <RevenueAreaChart items={revenueItems} groupBy={revenueFilter} onPeriodClick={handlePeriodClick} />
          )}
        </AsyncState>
      </div>

      {/* Combined Booking Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Bookings - YC13: with pagination */}
        <div className="lg:col-span-1 lg:order-2 rounded-2xl border border-white/10 bg-[#1e1e1e] p-5 text-white shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold">Booking gần đây</h3>
            <span className="text-[11px] text-white/50">{recentBookings.length} booking</span>
          </div>
          <AsyncState loading={loading} skeletonType="card" skeletonRows={3}>
            {recentPaginated.length === 0 ? (
              <p className="text-sm text-white/40">Chưa có booking nào.</p>
            ) : (
              <div className="space-y-3">
                {recentPaginated.map((b) => {
                  const badge = statusBadge[b.status] || { label: b.status, cls: 'bg-white/10 text-white/60' };
                  return (
                    <div key={b.id} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/70 shrink-0">
                        {b.bookingCode?.slice(-2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate font-mono">{b.bookingCode}</p>
                        {/* YC13: Correct time format */}
                        <p className="text-[11px] text-white/40">{formatBookingTime(b)}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {recentTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  disabled={recentPage === 1}
                  onClick={() => setRecentPage(p => p - 1)}
                  className="p-1 rounded text-white/50 hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[11px] text-white/50">
                  {recentPage} / {recentTotalPages}
                </span>
                <button
                  disabled={recentPage === recentTotalPages}
                  onClick={() => setRecentPage(p => p + 1)}
                  className="p-1 rounded text-white/50 hover:text-white disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </AsyncState>
        </div>

        {/* Status Donut */}
        <div className="lg:col-span-2 lg:order-1 rounded-2xl border border-black/5 bg-[#f5f3ee] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <h3 className="text-base font-bold mb-4 text-[#1a1a1a]">Booking theo trạng thái</h3>
          <div className="flex items-center gap-8">
            <div className="relative w-36 h-36 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e0d5" strokeWidth="4" />
                {(() => {
                  const total = visibleStatusBookings.length || 1;
                  const confirmed = (statusCounts['CONFIRMED'] || 0) + (statusCounts['CHECKED_IN'] || 0);
                  const pending = (statusCounts['PENDING_PAYMENT'] || 0) + (statusCounts['PENDING_HOLD'] || 0);
                  const refunded = statusCounts['REFUNDED'] || 0;
                  const circ = 88;
                  const s1 = (confirmed / total) * circ;
                  const s2 = (pending / total) * circ;
                  const s3 = (refunded / total) * circ;
                  return (<>
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray={`${s1} ${circ}`} strokeLinecap="round" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray={`${s2} ${circ}`} strokeDashoffset={`-${s1}`} strokeLinecap="round" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#ef4444" strokeWidth="4" strokeDasharray={`${s3} ${circ}`} strokeDashoffset={`-${s1 + s2}`} strokeLinecap="round" />
                  </>);
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-[#1a1a1a]">{loading ? '—' : visibleStatusBookings.length}</span>
                <span className="text-[10px] text-[#6b6b6b]">Tổng</span>
              </div>
            </div>
            <div className="space-y-3 flex-1">
              {[
                { label: 'Đã xác nhận', value: (statusCounts['CONFIRMED'] || 0) + (statusCounts['CHECKED_IN'] || 0), color: 'bg-emerald-500' },
                { label: 'Chờ xử lý', value: (statusCounts['PENDING_PAYMENT'] || 0) + (statusCounts['PENDING_HOLD'] || 0), color: 'bg-amber-500' },
                { label: 'Đã hoàn tiền', value: statusCounts['REFUNDED'] || 0, color: 'bg-red-500' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                  <span className="text-sm flex-1 text-[#6b6b6b]">{s.label}</span>
                  <span className="text-sm font-semibold text-[#1a1a1a]">{loading ? '—' : s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
