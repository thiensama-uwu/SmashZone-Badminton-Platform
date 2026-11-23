const { prisma } = require("../../../shared/data/prisma");

const IMAGE_MARKER_PREFIX = "\n\n[[CB_IMAGES]]";

function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function splitDescriptionAndImages(description) {
  const raw = String(description || "");
  const idx = raw.indexOf(IMAGE_MARKER_PREFIX);
  if (idx === -1) return { description: raw || null, additionalImages: [] };

  const text = raw.slice(0, idx).trim();
  const payload = raw.slice(idx + IMAGE_MARKER_PREFIX.length).trim();
  try {
    const parsed = JSON.parse(payload);
    const additionalImages = Array.isArray(parsed) ? parsed.slice(0, 5).filter(Boolean) : [];
    return { description: text || null, additionalImages };
  } catch {
    return { description: raw || null, additionalImages: [] };
  }
}

function mergeDescriptionAndImages(description, additionalImages) {
  const base = String(description || "").trim();
  const images = Array.isArray(additionalImages) ? additionalImages.filter(Boolean).slice(0, 5) : [];
  if (images.length === 0) return base || null;
  return `${base}${IMAGE_MARKER_PREFIX}${JSON.stringify(images)}`;
}

function mapCourtOutput(court) {
  if (!court) return court;
  const { description, additionalImages } = splitDescriptionAndImages(court.description);
  return {
    ...court,
    description,
    additionalImages,
  };
}

class CourtRepository {
  async listCourts({ page = 1, limit = 20, search = "", includeInactive = false, includeDeleted = false }) {
    const where = {
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(!includeInactive ? { status: "ACTIVE", deletedAt: null } : {}),
      ...(includeInactive && !includeDeleted ? { deletedAt: null } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.court.findMany({
        where,
        include: { priceSchedules: true, policy: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "asc" },
      }),
      prisma.court.count({ where }),
    ]);

    return { items: items.map(mapCourtOutput), total };
  }

  async getFeaturedCourts(limit = 3) {
    // Get top courts by booking count in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topCourts = await prisma.booking.groupBy({
      by: ['courtId'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
      },
      _count: { courtId: true },
      orderBy: { _count: { courtId: 'desc' } },
      take: limit,
    });

    if (topCourts.length === 0) {
      // Fallback: return first N active courts
      const courts = await prisma.court.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        include: { priceSchedules: true, policy: true },
        take: limit,
        orderBy: { createdAt: 'asc' },
      });
      return courts.map((c) => ({
        ...mapCourtOutput(c),
        bookingCount: 0,
      }));
    }

    const courtIds = topCourts.map((t) => t.courtId);
    const courts = await prisma.court.findMany({
      where: { id: { in: courtIds }, status: 'ACTIVE', deletedAt: null },
      include: { priceSchedules: true, policy: true },
    });

    // Sort by booking count descending
    const countMap = {};
    for (const t of topCourts) countMap[t.courtId] = t._count.courtId;
    const sorted = courts
      .map((c) => ({ ...mapCourtOutput(c), bookingCount: countMap[c.id] || 0 }))
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, limit);

    // If fewer than limit, fill with other active courts
    if (sorted.length < limit) {
      const existingIds = sorted.map((c) => c.id);
      const extra = await prisma.court.findMany({
        where: { status: 'ACTIVE', deletedAt: null, id: { notIn: existingIds } },
        include: { priceSchedules: true, policy: true },
        take: limit - sorted.length,
        orderBy: { createdAt: 'asc' },
      });
      sorted.push(...extra.map((c) => ({ ...mapCourtOutput(c), bookingCount: 0 })));
    }

    return sorted;
  }

  async createCourt(input) {
    const defaultSlots = [
      { startTime: "06:00", endTime: "07:00" },
      { startTime: "07:00", endTime: "08:00" },
      { startTime: "08:00", endTime: "09:00" },
      { startTime: "09:00", endTime: "10:00" },
      { startTime: "10:00", endTime: "11:00" },
      { startTime: "11:00", endTime: "12:00" },
      { startTime: "12:00", endTime: "13:00" },
      { startTime: "13:00", endTime: "14:00" },
      { startTime: "14:00", endTime: "15:00" },
      { startTime: "15:00", endTime: "16:00" },
      { startTime: "16:00", endTime: "17:00" },
      { startTime: "17:00", endTime: "18:00" },
      { startTime: "18:00", endTime: "19:00" },
      { startTime: "19:00", endTime: "20:00" },
      { startTime: "20:00", endTime: "21:00" },
      { startTime: "21:00", endTime: "22:00" },
    ];

    const slug = input.slug || generateSlug(input.name);

    return prisma.court.create({
      data: {
        branchId: input.branchId || "branch_hcm_1",
        name: input.name,
        slug,
        surface: input.surface || "PVC",
        description: mergeDescriptionAndImages(input.description, input.additionalImages),
        imageUrl: input.imageUrl || null,
        address: input.address || null,
        latitude: input.latitude != null ? input.latitude : null,
        longitude: input.longitude != null ? input.longitude : null,
        slotTemplates: {
          create: ((input.slots && input.slots.length > 0) ? input.slots : defaultSlots).map((slot) => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        },
        priceSchedules: {
          create: [
            {
              type: "default",
              priority: 1,
              price: input.defaultPrice || 120000,
              dates: [],
            },
          ],
        },
        policy: {
          create: {
            refundBeforeHours: 24,
            refundPercent: 100,
            rescheduleBeforeHours: 6,
          },
        },
      },
    });
  }

  async updateCourt(id, input, allowSoftDeleted = false) {
    const data = {};
    if (input.branchId !== undefined) data.branchId = input.branchId;
    if (input.name !== undefined) {
      data.name = input.name;
      data.slug = input.slug || generateSlug(input.name);
    }
    if (input.surface !== undefined) data.surface = input.surface;
    if (input.description !== undefined || input.additionalImages !== undefined) {
      const existing = await prisma.court.findUnique({ where: { id }, select: { description: true } });
      const existingParsed = splitDescriptionAndImages(existing?.description);
      data.description = mergeDescriptionAndImages(
        input.description !== undefined ? input.description : existingParsed.description,
        input.additionalImages !== undefined ? input.additionalImages : existingParsed.additionalImages,
      );
    }
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.address !== undefined) data.address = input.address;
    if (input.latitude !== undefined) data.latitude = input.latitude;
    if (input.longitude !== undefined) data.longitude = input.longitude;
    if (input.status !== undefined) data.status = input.status;
    if (input.deletedAt !== undefined) data.deletedAt = input.deletedAt;
    if (input.deletedBy !== undefined) data.deletedBy = input.deletedBy;
    if (allowSoftDeleted) {
      data.deletedAt = null;
      data.deletedBy = null;
    }
    return prisma.court.update({ where: { id }, data });
  }

  async getCourt(id, includeDeleted = false) {
    const court = await prisma.court.findUnique({
      where: { id },
      include: { priceSchedules: true, policy: true },
    });
    if (!includeDeleted && court && court.deletedAt !== null) {
      return null;
    }
    return mapCourtOutput(court);
  }

  async getCourtBySlug(slug) {
    const court = await prisma.court.findUnique({
      where: { slug },
      include: { priceSchedules: true, policy: true },
    });
    if (court && court.deletedAt !== null) {
      return null;
    }
    return mapCourtOutput(court);
  }

  async getSlots(courtId) {
    return prisma.courtSlotTemplate.findMany({
      where: { courtId },
      orderBy: { startTime: "asc" },
    });
  }

  async addPriceSchedule(courtId, input) {
    return prisma.priceSchedule.create({
      data: {
        courtId,
        type: input.type,
        priority: input.priority,
        price: input.price,
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        dates: input.dates || [],
      },
    });
  }

  async addPolicy(courtId, input) {
    return prisma.policy.upsert({
      where: { courtId },
      update: {
        refundBeforeHours: input.refundBeforeHours,
        refundPercent: input.refundPercent,
        rescheduleBeforeHours: input.rescheduleBeforeHours,
      },
      create: {
        courtId,
        refundBeforeHours: input.refundBeforeHours ?? 24,
        refundPercent: input.refundPercent ?? 100,
        rescheduleBeforeHours: input.rescheduleBeforeHours ?? 6,
      },
    });
  }

  async getPolicies(courtId) {
    return prisma.policy.findUnique({ where: { courtId } });
  }

  async getPriceSchedules(courtId) {
    return prisma.priceSchedule.findMany({
      where: { courtId },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  }

  async saveOutbox(event) {
    return prisma.courtOutboxEvent.create({
      data: {
        eventId: event.event_id,
        eventType: event.event_type,
        aggregateId: event.aggregate_id,
        schemaVersion: event.schema_version,
        correlationId: event.correlation_id,
        payload: event.payload,
      },
    });
  }

  async getUnpublishedOutboxEvents({ limit = 50 }) {
    return prisma.courtOutboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async markOutboxPublished(eventId) {
    return prisma.courtOutboxEvent.update({
      where: { eventId },
      data: { publishedAt: new Date() },
    });
  }
}

module.exports = {
  CourtRepository,
};
