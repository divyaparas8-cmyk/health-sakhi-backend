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

const { parseRemoteDocx } = require('./toolkitDocxParser');

function unpackSectionsData(sectionsField) {
  let parsedSections = [];
  let htmlContent = null;
  let rawText = null;

  if (sectionsField) {
    try {
      const parsed = typeof sectionsField === 'string' ? JSON.parse(sectionsField) : sectionsField;
      if (Array.isArray(parsed)) {
        parsedSections = parsed;
      } else if (parsed && typeof parsed === 'object') {
        parsedSections = Array.isArray(parsed.sections) ? parsed.sections : [];
        htmlContent = parsed.htmlContent || null;
        rawText = parsed.rawText || null;
      }
    } catch (err) {
      parsedSections = [];
    }
  }

  return { parsedSections, htmlContent, rawText };
}

/**
 * Get all toolkits with optional filters
 */
const getToolkits = async (filters = {}) => {
  const { category, search, status } = filters;
  const where = {};

  if (category && category !== 'All') {
    where.category = category;
  }

  if (status && status !== 'All') {
    where.status = status;
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

  const results = [];
  for (const t of toolkits) {
    let { parsedSections, htmlContent, rawText } = unpackSectionsData(t.sections);

    // Auto-parse on the fly if sections are missing but a docx document is present
    if ((!parsedSections || parsedSections.length === 0) && t.documentUrl && t.documentUrl.includes('.docx')) {
      try {
        const remoteDoc = await parseRemoteDocx(t.documentUrl);
        if (remoteDoc && remoteDoc.sections && remoteDoc.sections.length > 0) {
          parsedSections = remoteDoc.sections;
          htmlContent = remoteDoc.htmlContent || null;
          rawText = remoteDoc.rawText || null;

          // Asynchronously update DB cache for fast future retrieval
          prisma.familyToolkit.update({
            where: { id: t.id },
            data: {
              sections: JSON.stringify({
                sections: parsedSections,
                htmlContent,
                rawText
              })
            }
          }).catch((e) => console.warn('Cache write warning:', e.message));
        }
      } catch (err) {
        console.warn('Auto docx parse warning for', t.id, err.message);
      }
    }

    results.push({
      ...t,
      accentColor: t.accentColor,
      readTime: t.readTime,
      coverUrl: t.coverUrl,
      documentUrl: t.documentUrl,
      fileName: t.fileName,
      sections: parsedSections,
      htmlContent,
      rawText
    });
  }

  return results;
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

  let { parsedSections, htmlContent, rawText } = unpackSectionsData(toolkit.sections);

  if ((!parsedSections || parsedSections.length === 0) && toolkit.documentUrl && toolkit.documentUrl.includes('.docx')) {
    try {
      const remoteDoc = await parseRemoteDocx(toolkit.documentUrl);
      if (remoteDoc && remoteDoc.sections && remoteDoc.sections.length > 0) {
        parsedSections = remoteDoc.sections;
        htmlContent = remoteDoc.htmlContent || null;
        rawText = remoteDoc.rawText || null;

        prisma.familyToolkit.update({
          where: { id: toolkit.id },
          data: {
            sections: JSON.stringify({
              sections: parsedSections,
              htmlContent,
              rawText
            })
          }
        }).catch((e) => console.warn('Cache write warning:', e.message));
      }
    } catch (err) {
      console.warn('Auto docx parse warning for', toolkit.id, err.message);
    }
  }

  return {
    ...toolkit,
    sections: parsedSections,
    htmlContent,
    rawText
  };
};

/**
 * Create a new toolkit
 */
const createToolkit = async (data) => {
  const slug = data.slug ? generateSlug(data.slug) : `${generateSlug(data.title)}-${Date.now().toString().slice(-4)}`;

  let sectionsToSave = data.sections;
  let htmlContent = data.htmlContent || null;
  let rawText = data.rawText || null;

  // Auto-parse documentUrl if sections not supplied directly
  if ((!sectionsToSave || (Array.isArray(sectionsToSave) && sectionsToSave.length === 0)) && data.documentUrl && data.documentUrl.includes('.docx')) {
    try {
      const parsed = await parseRemoteDocx(data.documentUrl);
      if (parsed) {
        sectionsToSave = parsed.sections;
        htmlContent = parsed.htmlContent;
        rawText = parsed.rawText;
      }
    } catch (e) {
      console.warn('Error parsing docx during createToolkit:', e.message);
    }
  }

  const sectionsJson = sectionsToSave
    ? JSON.stringify({
        sections: Array.isArray(sectionsToSave) ? sectionsToSave : (sectionsToSave.sections || []),
        htmlContent,
        rawText
      })
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

  if (data.sections !== undefined || data.documentUrl !== undefined) {
    let sectionsToSave = data.sections;
    let htmlContent = data.htmlContent || null;
    let rawText = data.rawText || null;

    const docUrl = data.documentUrl;
    if ((!sectionsToSave || (Array.isArray(sectionsToSave) && sectionsToSave.length === 0)) && docUrl && docUrl.includes('.docx')) {
      try {
        const parsed = await parseRemoteDocx(docUrl);
        if (parsed) {
          sectionsToSave = parsed.sections;
          htmlContent = parsed.htmlContent;
          rawText = parsed.rawText;
        }
      } catch (e) {
        console.warn('Error parsing docx during updateToolkit:', e.message);
      }
    }

    if (sectionsToSave) {
      updateData.sections = JSON.stringify({
        sections: Array.isArray(sectionsToSave) ? sectionsToSave : (sectionsToSave.sections || []),
        htmlContent,
        rawText
      });
    }
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

