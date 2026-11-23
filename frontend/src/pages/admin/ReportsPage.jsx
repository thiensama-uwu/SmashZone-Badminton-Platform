import { useState, useCallback } from 'react';
import { DollarSign, CalendarDays, BarChart3, Users, RefreshCw, Download } from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import { reportsApi } from '../../api/index';
import { useApi } from '../../hooks/useApi';
import AsyncState from '../../components/AsyncState';
import { useToast } from '../../contexts/useToast';
import ExportModal from '../../components/admin/ExportModal';
import { exportRevenueWorkbook } from '../../utils/reportExport';

const card = 'rounded-2xl border border-black/5 bg-[#f5f3ee] shadow-[0_2px_12px_rgba(0,0,0,0.06)]';
const textP = { color: 'currentColor' };
const textS = { color: 'currentColor' };

function toLocalYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function monthStart() { const d = new Date(); d.setDate(1); return toLocalYMD(d); }
function monthEnd() { const d = new Date(); return toLocalYMD(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
function yearStart() { return `${new Date().getFullYear()}-01-01`; }
function yearEnd() { return `${new Date().getFullYear()}-12-31`; }

const periodOptions = [
  { label: 'Theo ngày', groupBy: 'day', from: monthStart(), to: monthEnd() },
  { label: 'Theo tháng', groupBy: 'month', from: yearStart(), to: yearEnd() },
  { label: 'Theo quý', groupBy: 'quarter', from: yearStart(), to: yearEnd() },
  { label: 'Theo năm', groupBy: 'year', from: yearStart(), to: yearEnd() },
];
function formatPrice(n) {
  const value = Number(n ?? 0);
  return value.toLocaleString('vi-VN') + 'đ';
}
function formatShort(n) {
  const value = Number(n ?? 0);
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(0) + 'K';
  return String(value);
}

function RevenueAreaChart({ items, groupBy }) {
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
          return formatPrice(value);
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
                ${formatPrice(value)}
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
      hover: { size: 6 }
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

export default function ReportsPage() {
  const toast = useToast();
  const [periodIdx, setPeriodIdx] = useState(0);
  const [customFrom, setCustomFrom] = useState(monthStart());
  const [customTo, setCustomTo] = useState(monthEnd());
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const period = periodOptions[periodIdx];

  const summaryFetcher = useCallback(() => {
    if (period.groupBy === 'day') {
      return reportsApi.getSummary({ from: customFrom, to: customTo });
    }
    return reportsApi.getSummary();
  }, [period.groupBy, customFrom, customTo]);

  const { data: summary, loading: loadingS, refresh: refreshS } = useApi('admin:reports:summary', summaryFetcher, {
    ttlMs: 60_000,
    onError: () => {},
  });

  const revenueFetcher = useCallback(() => {
    const from = customFrom;
    const to = customTo;
    return reportsApi.getRevenue({ from, to, groupBy: period.groupBy });
  }, [period.groupBy, customFrom, customTo]);

  const { data: revenue, loading: loadingR, refresh: refreshR } = useApi(
    `admin:reports:revenue:${period.from}:${period.groupBy}:${customFrom}:${customTo}`,
    revenueFetcher,
    { ttlMs: 60_000, onError: (err) => toast.error(err.message || 'Không thể tải doanh thu.') },
  );

  // Pad items
  let paddedItems = [];
  if (revenue) {
    const rawItems = revenue.items || [];
    const itemMap = {};
    rawItems.forEach(i => { itemMap[i.period] = i; });

    let expectedPeriods = [];
    const fromParts = customFrom.split('-');
    const toParts = customTo.split('-');
    const y = parseInt(fromParts[0]);

    if (period.groupBy === 'day') {
      const fromDate = new Date(fromParts[0], fromParts[1] - 1, fromParts[2]);
      const toDate = new Date(toParts[0], toParts[1] - 1, toParts[2]);
      const current = new Date(fromDate);
      while (current <= toDate) {
        expectedPeriods.push(toLocalYMD(current));
        current.setDate(current.getDate() + 1);
      }
    } else if (period.groupBy === 'month') {
      for (let i = 1; i <= 12; i++) {
        expectedPeriods.push(`${y}-${String(i).padStart(2, '0')}`);
      }
    } else if (period.groupBy === 'quarter') {
      for (let i = 1; i <= 4; i++) {
        expectedPeriods.push(`${y}-Q${i}`);
      }
    } else if (period.groupBy === 'year') {
      for (let i = y - 2; i <= y + 1; i++) {
        expectedPeriods.push(`${i}`);
      }
    }

    paddedItems = expectedPeriods.map(p => itemMap[p] || { period: p, revenue: 0, count: 0 });
  }

  const loading = loadingS || loadingR;
  const items = paddedItems;

  const kpis = [
    { label: 'Tổng doanh thu', value: summary ? formatShort(summary.totalRevenue) : '—', icon: DollarSign, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Tổng booking', value: summary?.totalBookings ?? '—', icon: CalendarDays, color: 'bg-amber-100 text-amber-600' },
    { label: 'Sân hoạt động', value: summary?.activeCourts ?? '—', icon: BarChart3, color: 'bg-blue-100 text-blue-600' },
    { label: 'Người dùng', value: summary?.totalUsers ?? '—', icon: Users, color: 'bg-purple-100 text-purple-600' },
  ];

  const handleRefresh = () => { refreshS(); refreshR(); };

  const handleExport = async (from, to) => {
    try {
      const data = await reportsApi.getExportData({ from, to });
      await exportRevenueWorkbook(data, { from, to });
      toast.success('Đã xuất file Excel thành công');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Không thể xuất báo cáo: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={textP}>Báo cáo & Thống kê</h2>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl overflow-hidden bg-surface-container border border-hairline">
            {periodOptions.map((p, i) => (
              <button key={i} onClick={() => setPeriodIdx(i)}
                className={`px-4 py-2 text-xs font-semibold transition-colors ${periodIdx === i ? 'bg-primary text-white' : 'hover:bg-white/50 text-body'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary-active transition-colors flex items-center gap-2 shadow-sm"
          >
            <Download size={14} />
            Xuất Excel
          </button>
          <button onClick={handleRefresh} disabled={loading}
            className="p-2 rounded-lg border border-outline-variant/30 hover:bg-surface-low transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {period.groupBy === 'day' && (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-black/5 bg-[#f5f3ee] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" style={textS}>Từ:</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-2 rounded-lg bg-surface-low text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 border border-outline-variant/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" style={textS}>Đến:</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-2 rounded-lg bg-surface-low text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 border border-outline-variant/20"
            />
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className={card}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.color}`}>
                  <kpi.icon size={20} />
                </div>
              </div>
              <p className="text-3xl font-bold" style={textP}>{kpi.value}</p>
              <p className="text-sm mt-1" style={textS}>{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className={card}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold" style={textP}>Doanh thu theo {period.groupBy === 'day' ? 'ngày' : period.groupBy === 'month' ? 'tháng' : period.groupBy === 'quarter' ? 'quý' : 'năm'}</h3>
            {revenue && (
              <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600">
                Tổng: {formatPrice(revenue.totalRevenue)} • {revenue.totalCount} booking
              </span>
            )}
          </div>
          <AsyncState loading={loadingR} skeletonType="card" skeletonRows={1}>
            {items.length === 0 ? (
              <p className="text-sm text-center py-10" style={textS}>Chưa có dữ liệu doanh thu cho kỳ này.</p>
            ) : (
              <RevenueAreaChart items={items} groupBy={period.groupBy} />
            )}
          </AsyncState>
        </div>
      </div>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
      />

    </div>
  );
}
