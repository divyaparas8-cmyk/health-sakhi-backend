const prisma = require('../../config/database');

/**
 * Fetch paginated diary entries for a user
 */
const getDiaryEntries = async (userId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  
  const [total, entries] = await Promise.all([
    prisma.sakhiDiaryEntry.count({ where: { userId } }),
    prisma.sakhiDiaryEntry.findMany({
      where: { userId },
      include: {
        medicines: true,
        reports: true
      },
      orderBy: { entryDate: 'desc' },
      skip: parseInt(skip, 10),
      take: parseInt(limit, 10)
    })
  ]);

  return {
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    totalPages: Math.ceil(total / limit),
    entries
  };
};

/**
 * Fetch a single diary entry by date
 */
const getDiaryEntryByDate = async (userId, dateStr) => {
  const entryDate = new Date(dateStr);
  return prisma.sakhiDiaryEntry.findFirst({
    where: {
      userId,
      entryDate: {
        equals: entryDate
      }
    },
    include: {
      medicines: true,
      reports: true
    }
  });
};

/**
 * Create or Update a diary entry (Upsert logic)
 */
const createOrUpdateDiaryEntry = async (userId, dateStr, data) => {
  const entryDate = new Date(dateStr);
  
  // Clean up data objects
  const entryPayload = {
    symptoms: data.symptoms ? data.symptoms.trim() : null,
    doctorNotes: data.doctorNotes ? data.doctorNotes.trim() : null,
    diagnosis: data.diagnosis ? data.diagnosis.trim() : null,
    meals: data.meals ? data.meals.trim() : null,
    waterIntake: data.waterIntake !== undefined ? parseFloat(data.waterIntake) : 0,
    dietType: data.dietType ? data.dietType.trim() : null,
    mood: data.mood ? data.mood.trim() : null,
    harmonyNotes: data.harmonyNotes ? data.harmonyNotes.trim() : null,
    gratitude: data.gratitude ? data.gratitude.trim() : null,
    personalNotes: data.personalNotes ? data.personalNotes.trim() : null
  };

  // Find if entry already exists (by ID if provided, otherwise by date range)
  let existingEntry = null;
  if (data.id) {
    existingEntry = await prisma.sakhiDiaryEntry.findFirst({
      where: { id: data.id, userId }
    });
  }

  if (!existingEntry) {
    const startOfDay = new Date(entryDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(entryDate);
    endOfDay.setHours(23, 59, 59, 999);

    existingEntry = await prisma.sakhiDiaryEntry.findFirst({
      where: {
        userId,
        entryDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });
  }

  return prisma.$transaction(async (tx) => {
    let entry;
    if (existingEntry) {
      // Update entry
      entry = await tx.sakhiDiaryEntry.update({
        where: { id: existingEntry.id },
        data: entryPayload
      });
    } else {
      // Create new entry
      entry = await tx.sakhiDiaryEntry.create({
        data: {
          userId,
          entryDate,
          ...entryPayload
        }
      });
    }

    // Manage Medicines: clear previous and write new list if provided
    if (Array.isArray(data.medicines)) {
      await tx.sakhiDiaryMedicine.deleteMany({
        where: { diaryEntryId: entry.id }
      });

      if (data.medicines.length > 0) {
        const medicinesData = data.medicines.map(m => ({
          diaryEntryId: entry.id,
          name: m.name ? m.name.trim() : 'Unnamed Medicine',
          dosage: m.dosage ? m.dosage.trim() : 'Once daily',
          schedule: m.schedule ? m.schedule.trim() : null,
          startDate: m.startDate ? new Date(m.startDate) : null,
          endDate: m.endDate ? new Date(m.endDate) : null,
          memberName: m.memberName ? m.memberName.trim() : null
        }));

        await tx.sakhiDiaryMedicine.createMany({
          data: medicinesData
        });
      }
    }

    // Manage Reports: append reports if uploaded
    if (Array.isArray(data.reports) && data.reports.length > 0) {
      const reportsData = data.reports.map(r => ({
        diaryEntryId: entry.id,
        fileUrl: r.fileUrl,
        fileName: r.fileName || 'Report File'
      }));

      await tx.sakhiDiaryReport.createMany({
        data: reportsData
      });
    }

    // Return full entry including updated items
    return tx.sakhiDiaryEntry.findUnique({
      where: { id: entry.id },
      include: {
        medicines: true,
        reports: true
      }
    });
  });
};

/**
 * Delete a single diary entry
 */
const deleteDiaryEntry = async (userId, id) => {
  // First ensure ownership
  const entry = await prisma.sakhiDiaryEntry.findFirst({
    where: { id, userId }
  });
  if (!entry) throw new Error('Diary entry not found or unauthorized');

  return prisma.sakhiDiaryEntry.delete({
    where: { id }
  });
};

/**
 * Delete a single attached report from a diary entry
 */
const deleteDiaryReport = async (userId, reportId) => {
  const report = await prisma.sakhiDiaryReport.findUnique({
    where: { id: reportId },
    include: { diaryEntry: true }
  });

  if (!report || report.diaryEntry.userId !== userId) {
    throw new Error('Report not found or unauthorized');
  }

  return prisma.sakhiDiaryReport.delete({
    where: { id: reportId }
  });
};

module.exports = {
  getDiaryEntries,
  getDiaryEntryByDate,
  createOrUpdateDiaryEntry,
  deleteDiaryEntry,
  deleteDiaryReport
};
