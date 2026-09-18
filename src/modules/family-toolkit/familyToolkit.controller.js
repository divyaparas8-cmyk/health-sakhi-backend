const familyToolkitService = require('./familyToolkit.service');

const getToolkits = async (req, res, next) => {
  try {
    const { category, search, status } = req.query;
    const toolkits = await familyToolkitService.getToolkits({ category, search, status });
    res.status(200).json({
      success: true,
      count: toolkits.length,
      toolkits
    });
  } catch (err) {
    next(err);
  }
};

const getToolkitById = async (req, res, next) => {
  try {
    const toolkit = await familyToolkitService.getToolkitByIdOrSlug(req.params.idOrSlug);
    if (!toolkit) {
      return res.status(404).json({
        success: false,
        error: 'Toolkit not found'
      });
    }
    res.status(200).json({
      success: true,
      toolkit
    });
  } catch (err) {
    next(err);
  }
};

const createToolkit = async (req, res, next) => {
  try {
    const { title, category } = req.body;
    if (!title || !category) {
      return res.status(400).json({
        success: false,
        error: 'Title and category are required fields.'
      });
    }

    const toolkit = await familyToolkitService.createToolkit(req.body);
    res.status(201).json({
      success: true,
      message: 'Family Toolkit created successfully',
      toolkit
    });
  } catch (err) {
    next(err);
  }
};

const updateToolkit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const toolkit = await familyToolkitService.updateToolkit(id, req.body);
    res.status(200).json({
      success: true,
      message: 'Family Toolkit updated successfully',
      toolkit
    });
  } catch (err) {
    next(err);
  }
};

const deleteToolkit = async (req, res, next) => {
  try {
    const { id } = req.params;
    await familyToolkitService.deleteToolkit(id);
    res.status(200).json({
      success: true,
      message: 'Family Toolkit deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getToolkits,
  getToolkitById,
  createToolkit,
  updateToolkit,
  deleteToolkit
};
