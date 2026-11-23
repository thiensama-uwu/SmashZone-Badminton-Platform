const SHEETS = [
  ['Tổng quan', 'overviewRows', ['Chỉ tiêu', 'Giá trị']],
  ['Tiền vào', 'incomeRows', [
    'Mã thanh toán',
    'Mã booking',
    'Ngày ghi nhận thanh toán',
    'Ngày đặt sân',
    'Khách hàng',
    'Sân',
    'Khung giờ',
    'Số tiền vào',
    'Loại thanh toán',
    'Trạng thái thanh toán',
    'Mã giao dịch ngân hàng',
  ]],
  ['Tiền ra', 'expenseRows', [
    'Mã hoàn tiền',
    'Mã thanh toán',
    'Mã booking',
    'Ngày tạo yêu cầu hoàn',
    'Ngày hoàn tất',
    'Khách hàng',
    'Sân',
    'Số tiền ra',
    'Lý do hoàn tiền',
    'Trạng thái hoàn tiền',
    'Ngân hàng nhận',
    'Số tài khoản nhận',
    'Tên chủ tài khoản',
  ]],
];

function autoFitColumns(headers, rows) {
  return headers.map((header) => ({
    wch: Math.min(
      40,
      Math.max(
        header.length,
        ...rows.map((row) => String(row[header] ?? '').length),
      ) + 2,
    ),
  }));
}

export async function exportRevenueWorkbook(data, { from, to }) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  for (const [sheetName, key, headers] of SHEETS) {
    const rows = data[key] || [];
    const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    sheet['!cols'] = autoFitColumns(headers, rows);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }

  XLSX.writeFile(workbook, `bao_cao_doanh_thu_${from}_den_${to}.xlsx`);
}
