const service = require('./diary.service');
const pdfBuilder = require('./diary.pdf');
const prisma = require('../../config/database');

/**
 * Get paginated list of diary entries for authenticated member
 */
const getDiaryEntries = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const data = await service.getDiaryEntries(userId, page, limit);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a single log entry by its string date (YYYY-MM-DD)
 */
const getDiaryEntryByDate = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { date } = req.params;
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }
    const data = await service.getDiaryEntryByDate(userId, date);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * Create or update an entry for a specific date
 */
const createOrUpdateDiaryEntry = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { entryDate, ...diaryData } = req.body;
    
    if (!entryDate) {
      return res.status(400).json({ error: 'entryDate is required' });
    }

    // Process attached reports from multer if uploaded
    if (req.files && req.files.length > 0) {
      diaryData.reports = req.files.map(f => ({
        fileUrl: `/uploads/${f.filename}`,
        fileName: f.originalname
      }));
    }

    // Support json format report files array parameter in request body if files uploaded separately
    if (req.body.reports && typeof req.body.reports === 'string') {
      try {
        diaryData.reports = JSON.parse(req.body.reports);
      } catch (e) {}
    }

    // If medicines are passed as a JSON string in FormData
    if (req.body.medicines && typeof req.body.medicines === 'string') {
      try {
        diaryData.medicines = JSON.parse(req.body.medicines);
      } catch (e) {}
    }

    const data = await service.createOrUpdateDiaryEntry(userId, entryDate, diaryData);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a diary entry
 */
const deleteDiaryEntry = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    await service.deleteDiaryEntry(userId, id);
    res.status(200).json({ success: true, message: 'Diary entry deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete an attached file/report from a diary entry
 */
const deleteDiaryReport = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { reportId } = req.params;
    await service.deleteDiaryReport(userId, reportId);
    res.status(200).json({ success: true, message: 'Report deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Generate and download Doctor PDF Report
 */
const downloadDoctorReport = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { patientName, dateScope, targetDate } = req.query;
    
    // Fetch diary entries
    const entriesData = await service.getDiaryEntries(userId, 1, 100);
    let entries = entriesData.entries || [];

    // Filter by single target date if dateScope is selected
    if (dateScope === 'selected' && targetDate) {
      entries = entries.filter(e => {
        if (!e.entryDate) return false;
        const eDate = new Date(e.entryDate).toISOString().split('T')[0];
        return eDate === targetDate;
      });
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=sakhi_diary_report.pdf');

    pdfBuilder.buildDiaryPDF(entries, profile, res, patientName);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDiaryEntries,
  getDiaryEntryByDate,
  createOrUpdateDiaryEntry,
  deleteDiaryEntry,
  deleteDiaryReport,
  downloadDoctorReport
};
