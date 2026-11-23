/* eslint-disable no-console */
// Frontend bundle benchmark — analyzes the vite `dist/` output produced by `vite build`.
// Measures: code-splitting (initial vs deferred payload) and gzip compression ratio.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const dist = path.join(__dirname, "..", "..", "frontend", "dist");
const assetsDir = path.join(dist, "assets");
const files = fs.readdirSync(assetsDir).map((f) => {
  const buf = fs.readFileSync(path.join(assetsDir, f));
  return { name: f, raw: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length };
});

const js = files.filter((f) => f.name.endsWith(".js"));
const css = files.filter((f) => f.name.endsWith(".css"));

const sum = (arr, k) => arr.reduce((a, b) => a + b[k], 0);

// Entry chunk = index-*.js (loaded on first paint). Everything else JS is a
// route/vendor chunk pulled in lazily via dynamic import().
const entry = js.find((f) => /^index-/.test(f.name));
const lazyChunks = js.filter((f) => f !== entry);

// Heavy libraries that are deferred (only load on the page that needs them).
const heavyLibs = js.filter((f) => /(xlsx|apexcharts|leaflet)/.test(f.name));

const totalJsRaw = sum(js, "raw");
const totalJsGz = sum(js, "gzip");
const totalAllRaw = sum(files, "raw");
const totalAllGz = sum(files, "gzip");

// Initial payload = entry JS + all CSS (CSS loads on first paint).
const initialRaw = (entry ? entry.raw : 0) + sum(css, "raw");
const initialGz = (entry ? entry.gzip : 0) + sum(css, "gzip");

const kb = (n) => Number((n / 1024).toFixed(1));

const results = {
  codeSplitting: {
    metric: "Code-splitting theo route (React.lazy + Vite)",
    totalChunks: js.length,
    lazyRouteVendorChunks: lazyChunks.length,
    totalBundleJsKB: kb(totalJsRaw),
    initialLoadKB_gzip: kb(initialGz),
    totalBundleKB_gzip: kb(totalAllGz),
    initialShareOfTotalPct: Number(((initialGz / totalAllGz) * 100).toFixed(1)),
    payloadReductionVsMonolithPct: Number((((totalAllGz - initialGz) / totalAllGz) * 100).toFixed(1)),
    note: "Nếu gộp 1 bundle, client phải tải toàn bộ ~" + kb(totalAllGz) + "KB gzip ngay lần đầu; code-splitting chỉ tải ~" + kb(initialGz) + "KB.",
  },
  deferredHeavyLibs: {
    metric: "Thư viện nặng được tách khỏi initial load",
    libs: heavyLibs.map((f) => ({ chunk: f.name.replace(/-[A-Za-z0-9_]+\.js$/, ".js"), rawKB: kb(f.raw), gzipKB: kb(f.gzip) })),
    totalDeferredKB_gzip: kb(sum(heavyLibs, "gzip")),
    note: "xlsx/apexcharts/leaflet chỉ tải khi mở trang tương ứng (report/dashboard/bản đồ), không nằm trong initial bundle.",
  },
  gzipCompression: {
    metric: "Nén gzip toàn bộ asset khi truyền qua mạng",
    totalRawKB: kb(totalAllRaw),
    totalGzipKB: kb(totalAllGz),
    compressionRatioX: Number((totalAllRaw / totalAllGz).toFixed(2)),
    bytesSavedPct: Number((((totalAllRaw - totalAllGz) / totalAllRaw) * 100).toFixed(1)),
  },
};

fs.writeFileSync(path.join(__dirname, "frontend-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
