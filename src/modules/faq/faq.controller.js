const service = require('./faq.service');

const listPublicFaqs = async (req, res, next) => {
  try {
    const { category, search, isPopular } = req.query;
    const faqs = await service.getAllFaqs({ status: 'Published', category, search, isPopular });
    res.status(200).json({ success: true, data: faqs });
  } catch (err) {
    next(err);
  }
};

const listAdminFaqs = async (req, res, next) => {
  try {
    const { category, search, isPopular, status } = req.query;
    const faqs = await service.getAllFaqs({ category, search, isPopular, status });
    res.status(200).json({ success: true, data: faqs });
  } catch (err) {
    next(err);
  }
};

const getFaqById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const faq = await service.getFaqById(id);
    if (!faq) return res.status(404).json({ success: false, error: 'FAQ not found.' });
    res.status(200).json({ success: true, data: faq });
  } catch (err) {
    next(err);
  }
};

const createFaq = async (req, res, next) => {
  try {
    const { question, answer, category, displayOrder, status, isPopular } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Question is required.' });
    }
    if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Answer is required.' });
    }
    if (!category) {
      return res.status(400).json({ success: false, error: 'Category is required.' });
    }

    const faq = await service.createFaq({ question, answer, category, displayOrder, status, isPopular });
    res.status(201).json({ success: true, data: faq });
  } catch (err) {
    next(err);
  }
};

const updateFaq = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { question, answer, category, displayOrder, status, isPopular } = req.body;

    const faq = await service.updateFaq(id, { question, answer, category, displayOrder, status, isPopular });
    res.status(200).json({ success: true, data: faq });
  } catch (err) {
    next(err);
  }
};

const deleteFaq = async (req, res, next) => {
  try {
    const { id } = req.params;
    await service.deleteFaq(id);
    res.status(200).json({ success: true, message: 'FAQ deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

const submitFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // 'helpful' or 'not_helpful'
    if (type !== 'helpful' && type !== 'not_helpful') {
      return res.status(400).json({ success: false, error: 'Feedback type must be helpful or not_helpful.' });
    }
    const faq = await service.submitFeedback(id, type);
    res.status(200).json({ success: true, data: faq });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listPublicFaqs,
  listAdminFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
  submitFeedback
};
