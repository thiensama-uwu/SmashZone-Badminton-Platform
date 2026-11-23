require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('../shared/generated/prisma');

const prisma = new PrismaClient();

const bookingCodes = [
  'BK-1777970043310',
  'BK-1777969212907',
  'BK-1775269985553'
];

async function deleteCompletedBookings() {
  try {
    console.log('Đang tìm các booking cần xóa...');
    
    for (const code of bookingCodes) {
      const booking = await prisma.booking.findUnique({
        where: { bookingCode: code },
        include: {
          reservations: true,
          histories: true
        }
      });

      if (!booking) {
        console.log(`Không tìm thấy booking: ${code}`);
        continue;
      }

      console.log(`Đang xóa booking: ${code} - ${booking.status} - ${booking.totalAmount}đ`);
      
      // Xóa booking (cascade sẽ tự động xóa reservations và histories)
      await prisma.booking.delete({
        where: { bookingCode: code }
      });
      
      console.log(`Đã xóa booking: ${code}`);
    }

    console.log('Đã xóa hoàn tất tất cả booking!');
  } catch (error) {
    console.error('Lỗi khi xóa booking:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteCompletedBookings();
