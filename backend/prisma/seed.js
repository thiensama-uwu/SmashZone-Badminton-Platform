const { PrismaClient } = require("../shared/generated/prisma");
const { hashPassword } = require("../shared/utils/password");
const { assertSeedAllowed } = require("./seed-guard");

const prisma = new PrismaClient();

async function main() {
  await assertSeedAllowed(prisma);

  const roleAdmin = await prisma.role.upsert({
    where: { code: "admin" },
    update: {},
    create: { code: "admin", name: "Admin" },
  });
  const roleStaff = await prisma.role.upsert({
    where: { code: "staff" },
    update: {},
    create: { code: "staff", name: "Staff" },
  });
  const roleCustomer = await prisma.role.upsert({
    where: { code: "customer" },
    update: {},
    create: { code: "customer", name: "Customer" },
  });

  const adminPassword = await hashPassword("Password@123");
  const staffPassword = await hashPassword("Password@123");

  const admin = await prisma.authUser.upsert({
    where: { email: "admin@badminton.local" },
    update: { passwordHash: adminPassword },
    create: {
      email: "admin@badminton.local",
      passwordHash: adminPassword,
      userRoles: {
        create: [{ roleId: roleAdmin.id }],
      },
    },
    include: { userRoles: true },
  });

  const staff = await prisma.authUser.upsert({
    where: { email: "staff@badminton.local" },
    update: { passwordHash: staffPassword },
    create: {
      email: "staff@badminton.local",
      passwordHash: staffPassword,
      userRoles: {
        create: [{ roleId: roleStaff.id }],
      },
    },
    include: { userRoles: true },
  });

  await prisma.userProfile.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      email: admin.email,
      fullName: "System Admin",
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: staff.id },
    update: {},
    create: {
      userId: staff.id,
      email: staff.email,
      fullName: "Court Staff",
    },
  });

  // Đã vô hiệu hóa việc xóa dữ liệu cũ để bảo toàn dữ liệu thêm mới qua UI
  // await prisma.booking.deleteMany({});
  // await prisma.court.deleteMany({});

  const courtsData = [
    {
      id: "court_viettel",
      slug: "san-cau-long-quan-khu-5-da-nang",
      name: "Sân Cầu Lông Quân Khu 5 Đà Nẵng",
      description: "Số 7 Duy Tân, P. Hòa Cường Bắc, Q. Hải Châu, TP. Đà Nẵng",
      surface: "PVC",
      imageUrl: "/courts/quan-khu-5.svg",
      price: 110000,
      peakPrice: 140000
    },
    {
      id: "court_celadon",
      slug: "san-cau-long-chi-lang-da-nang",
      name: "Sân Cầu Lông Chi Lăng Đà Nẵng",
      description: "38 Ngô Gia Tự, P. Hải Châu 1, Q. Hải Châu, TP. Đà Nẵng",
      surface: "wood",
      imageUrl: "/courts/chi-lang.svg",
      price: 120000,
      peakPrice: 150000
    },
    {
      id: "court_lananh",
      slug: "san-cau-long-son-tra-da-nang",
      name: "Sân Cầu Lông Sơn Trà Đà Nẵng",
      description: "123 Hồ Nghinh, P. Phước Mỹ, Q. Sơn Trà, TP. Đà Nẵng",
      surface: "plastic",
      imageUrl: "/courts/son-tra.svg",
      price: 100000,
      peakPrice: 130000
    },
    {
      id: "court_phutho",
      slug: "nha-thi-dau-tien-son-da-nang",
      name: "Nhà Thi Đấu Tiên Sơn Đà Nẵng",
      description: "01 Phan Đăng Lưu, P. Hòa Cường Bắc, Q. Hải Châu, TP. Đà Nẵng",
      surface: "PVC",
      imageUrl: "/courts/tien-son.svg",
      price: 130000,
      peakPrice: 160000
    }
  ];

  const slotSeeds = [
    { id: "slot_1000", startTime: "10:00", endTime: "11:00" },
    { id: "slot_1100", startTime: "11:00", endTime: "12:00" },
    { id: "slot_1200", startTime: "12:00", endTime: "13:00" },
    { id: "slot_1300", startTime: "13:00", endTime: "14:00" },
    { id: "slot_1400", startTime: "14:00", endTime: "15:00" },
    { id: "slot_1500", startTime: "15:00", endTime: "16:00" },
    { id: "slot_0600", startTime: "06:00", endTime: "07:00" },
    { id: "slot_0700", startTime: "07:00", endTime: "08:00" },
    { id: "slot_0800", startTime: "08:00", endTime: "09:00" },
    { id: "slot_1700", startTime: "17:00", endTime: "18:00" },
    { id: "slot_1800", startTime: "18:00", endTime: "19:00" },
    { id: "slot_1900", startTime: "19:00", endTime: "20:00" },
    { id: "slot_2000", startTime: "20:00", endTime: "21:00" },
    { id: "slot_2100", startTime: "21:00", endTime: "22:00" },
  ];

  for (const c of courtsData) {
    const court = await prisma.court.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        branchId: "branch_hcm_1",
        name: c.name,
        slug: c.slug,
        description: c.description,
        surface: c.surface,
        imageUrl: c.imageUrl,
        status: "ACTIVE",
      },
    });

    for (const slot of slotSeeds) {
      await prisma.courtSlotTemplate.upsert({
        where: { id: `${c.id}_${slot.id}` },
        update: {},
        create: {
          id: `${c.id}_${slot.id}`,
          courtId: court.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
        },
      });
    }

    await prisma.priceSchedule.upsert({
      where: { id: `price_default_${c.id}` },
      update: {},
      create: {
        id: `price_default_${c.id}`,
        courtId: court.id,
        type: "default",
        priority: 1,
        price: c.price,
        dates: [],
      },
    });

    await prisma.priceSchedule.upsert({
      where: { id: `price_peak_${c.id}` },
      update: {},
      create: {
        id: `price_peak_${c.id}`,
        courtId: court.id,
        type: "peak-hour",
        priority: 5,
        price: c.peakPrice,
        startTime: "17:00",
        endTime: "22:00",
        dates: [],
      },
    });

    await prisma.policy.upsert({
      where: { id: `policy_${c.id}` },
      update: {},
      create: {
        id: `policy_${c.id}`,
        courtId: court.id,
        depositPercent: 50,
        refundBeforeHours: 24,
        refundPercent: 100,
        rescheduleBeforeHours: 6,
      },
    });
  }

  console.log("Seed completed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
