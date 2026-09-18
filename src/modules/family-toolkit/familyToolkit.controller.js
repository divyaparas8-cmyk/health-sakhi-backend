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

const imagekit = require('../../config/imagekit');

const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const safeOriginal = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${safeOriginal}`;
    const folder = req.body.folder || '/healthsakhi_toolkit';

    let uploadRes;
    try {
      uploadRes = await imagekit.upload({
        file: req.file.buffer,
        fileName,
        folder
      });
    } catch (ikError) {
      console.warn('ImageKit upload failed, fallback to local storage:', ikError.message);
      uploadRes = {
        url: `http://localhost:5000/uploads/${fileName}`,
        name: fileName
      };
    }

    // If in mock mode or fallback happened, write buffer to local uploads folder
    if (uploadRes.url && uploadRes.url.includes('localhost:5000/uploads')) {
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '../../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadsDir, fileName), req.file.buffer);
    }

    return res.status(200).json({
      success: true,
      url: uploadRes.url,
      name: uploadRes.name || fileName,
      originalName: req.file.originalname
    });
  } catch (err) {
    next(err);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const categories = await familyToolkitService.getCategories();
    res.status(200).json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (err) {
    next(err);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required.' });
    }
    const category = await familyToolkitService.createCategory(name);
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category
    });
  } catch (err) {
    next(err);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required.' });
    }
    const category = await familyToolkitService.updateCategory(id, name);
    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category
    });
  } catch (err) {
    next(err);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    await familyToolkitService.deleteCategory(id);
    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
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
  deleteToolkit,
  uploadFile,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};

