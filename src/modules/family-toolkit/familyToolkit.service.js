const prisma = require('../../config/database');

/**
 * Generate URL-friendly slug
 */
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-');
};

/**
 * Get all toolkits with filtering
 */
const getToolkits = async ({ category, search, status }) => {
  const where = {};

  if (status && status !== 'All') {
    where.status = status;
  }

  if (category && category !== 'All') {
    where.category = category;
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { title: { contains: q } },
      { subtitle: { contains: q } },
      { summary: { contains: q } },
      { category: { contains: q } }
    ];
  }

  const toolkits = await prisma.familyToolkit.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  return toolkits.map((t) => {
    let parsedSections = [];
    if (t.sections) {
      try {
        parsedSections = typeof t.sections === 'string' ? JSON.parse(t.sections) : t.sections;
      } catch (err) {
        parsedSections = [];
      }
    }
    return {
      ...t,
      accentColor: t.accentColor,
      readTime: t.readTime,
      coverUrl: t.coverUrl,
      documentUrl: t.documentUrl,
      fileName: t.fileName,
      sections: parsedSections
    };
  });
};

/**
 * Get single toolkit by ID or slug
 */
const getToolkitByIdOrSlug = async (idOrSlug) => {
  const toolkit = await prisma.familyToolkit.findFirst({
    where: {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug }
      ]
    }
  });

  if (!toolkit) return null;

  let parsedSections = [];
  if (toolkit.sections) {
    try {
      parsedSections = typeof toolkit.sections === 'string' ? JSON.parse(toolkit.sections) : toolkit.sections;
    } catch (err) {
      parsedSections = [];
    }
  }

  return {
    ...toolkit,
    sections: parsedSections
  };
};

/**
 * Create a new toolkit
 */
const createToolkit = async (data) => {
  const slug = data.slug ? generateSlug(data.slug) : `${generateSlug(data.title)}-${Date.now().toString().slice(-4)}`;

  const sectionsJson = data.sections
    ? (typeof data.sections === 'string' ? data.sections : JSON.stringify(data.sections))
    : null;

  const created = await prisma.familyToolkit.create({
    data: {
      slug,
      title: data.title,
      subtitle: data.subtitle || null,
      category: data.category || 'Emergency & Critical Care',
      badge: data.badge || null,
      accentColor: data.accentColor || 'from-rose-500 to-red-600',
      icon: data.icon || 'AlertTriangle',
      readTime: data.readTime || '10 Min Read',
      summary: data.summary || null,
      coverUrl: data.coverUrl || null,
      documentUrl: data.documentUrl || null,
      fileName: data.fileName || null,
      status: data.status || 'Published',
      sections: sectionsJson
    }
  });

  return created;
};

/**
 * Update an existing toolkit
 */
const updateToolkit = async (id, data) => {
  const updateData = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
  if (data.slug !== undefined && data.slug.trim()) updateData.slug = generateSlug(data.slug);
  if (data.category !== undefined) updateData.category = data.category;
  if (data.badge !== undefined) updateData.badge = data.badge;
  if (data.accentColor !== undefined) updateData.accentColor = data.accentColor;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.readTime !== undefined) updateData.readTime = data.readTime;
  if (data.summary !== undefined) updateData.summary = data.summary;
  if (data.coverUrl !== undefined) updateData.coverUrl = data.coverUrl;
  if (data.documentUrl !== undefined) updateData.documentUrl = data.documentUrl;
  if (data.fileName !== undefined) updateData.fileName = data.fileName;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.sections !== undefined) {
    updateData.sections = typeof data.sections === 'string' ? data.sections : JSON.stringify(data.sections);
  }

  const updated = await prisma.familyToolkit.update({
    where: { id },
    data: updateData
  });

  return updated;
};

const deleteToolkit = async (id) => {
  const deleted = await prisma.familyToolkit.delete({
    where: { id }
  });
  return deleted;
};

/**
 * Category Methods
 */
const getCategories = async () => {
  const categories = await prisma.familyToolkitCategory.findMany({
    orderBy: { createdAt: 'asc' }
  });
  return categories;
};

const createCategory = async (name) => {
  const trimmed = name.trim();
  const slug = generateSlug(trimmed);
  const category = await prisma.familyToolkitCategory.create({
    data: {
      name: trimmed,
      slug
    }
  });
  return category;
};

const updateCategory = async (id, newName) => {
  const trimmed = newName.trim();
  const existing = await prisma.familyToolkitCategory.findUnique({
    where: { id }
  });
  if (!existing) {
    throw new Error('Category not found');
  }

  const oldName = existing.name;
  const newSlug = generateSlug(trimmed);

  const updated = await prisma.familyToolkitCategory.update({
    where: { id },
    data: {
      name: trimmed,
      slug: newSlug
    }
  });

  // Cascade category rename to existing toolkits
  try {
    await prisma.familyToolkit.updateMany({
      where: { category: oldName },
      data: { category: trimmed }
    });
  } catch (err) {
    console.warn('Could not cascade category rename to toolkits:', err.message);
  }

  return updated;
};

const deleteCategory = async (id) => {
  const deleted = await prisma.familyToolkitCategory.delete({
    where: { id }
  });
  return deleted;
};

module.exports = {
  getToolkits,
  getToolkitByIdOrSlug,
  createToolkit,
  updateToolkit,
  deleteToolkit,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};

