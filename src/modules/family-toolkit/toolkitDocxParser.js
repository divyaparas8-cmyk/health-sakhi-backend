const mammoth = require('mammoth');
const axios = require('axios');

/**
 * Intelligent parser that converts DOCX text & HTML into structured Clinical Guidance Sections
 */
function parseDocxToSections(rawText, html) {
  if (!rawText || !rawText.trim()) return [];

  const rawLines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) return [];

  const sections = [];
  let currentSection = {
    id: 'sec-1',
    title: 'Overview & Essential Rules',
    items: []
  };

  const isSectionHeader = (line, idx) => {
    if (idx === 0) return false;
    // Numbered headers: '1. ...', '2) ...', 'Card 1: ...', 'Section 1: ...'
    if (/^([0-9]+[\.\)]|Card\s+[0-9]+|Section\s+[0-9]+|Part\s+[0-9]+)\s+[A-Za-z]/i.test(line)) return true;
    // Known clinical headers
    if (/^(COMMON SCAMS|WARNING SIGNS|IF SOMETHING GOES WRONG|HELPLINES|SPECIAL CONSIDERATIONS|DISCLAIMER|SEEK MEDICAL CARE|AFTER A FALL|WHY THIS|DIFFERENT RISKS|SYMPTOMS|CAUSES|TREATMENT|PREVENTION|WHEN TO WORRY|RED FLAG|HOME REMEDIES|DIAGNOSIS|MANAGEMENT|DOS & DON'TS|WHAT TO DO|BEFORE YOU CALL|HOW TO USE|ESSENTIAL RULES)/i.test(line)) return true;
    // ALL CAPS line between 4 and 65 chars
    if (line.length >= 4 && line.length <= 65 && line === line.toUpperCase() && /[A-Z]/.test(line) && !line.includes(':') && !line.includes('(')) return true;
    return false;
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (isSectionHeader(line, i)) {
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        id: `sec-${sections.length + 1}`,
        title: line,
        items: []
      };
    } else {
      currentSection.items.push(line);
    }
  }

  if (currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  // Convert raw items into structured clinical blocks
  return sections.map((sec, sIdx) => {
    const blocks = [];
    let currentBlock = { type: 'general', heading: 'Key Guidance', items: [] };

    for (const item of sec.items) {
      const lower = item.toLowerCase();
      if (lower.startsWith('recognize this') || lower.startsWith('symptoms:') || lower.startsWith('signs & symptoms')) {
        if (currentBlock.items.length) blocks.push(currentBlock);
        currentBlock = { type: 'recognize', heading: 'Recognize This', items: [] };
      } else if (lower.startsWith('immediate action') || lower.startsWith('what to do:') || lower.startsWith('action plan:') || lower.startsWith('steps to take')) {
        if (currentBlock.items.length) blocks.push(currentBlock);
        currentBlock = { type: 'actions', heading: 'IMMEDIATE ACTIONS', items: [] };
      } else if (lower.startsWith('while you wait') || lower.startsWith('monitoring:') || lower.startsWith('ongoing care')) {
        if (currentBlock.items.length) blocks.push(currentBlock);
        currentBlock = { type: 'wait', heading: 'WHILE YOU WAIT', items: [] };
      } else if (lower.startsWith('do not do') || lower.startsWith('cautions:') || lower.startsWith('avoid:') || lower.startsWith("don't")) {
        if (currentBlock.items.length) blocks.push(currentBlock);
        currentBlock = { type: 'dont', heading: 'Do Not Do (Critical Cautions)', items: [] };
      } else if (lower.startsWith('special consideration') || lower.startsWith('[c]') || lower.startsWith('[p]') || lower.startsWith('[60+]') || lower.startsWith('[w]')) {
        if (currentBlock.items.length) blocks.push(currentBlock);
        currentBlock = { type: 'special', heading: 'Special Considerations', items: [item] };
      } else if (lower.startsWith('call for help') || lower.startsWith('emergency:') || lower.startsWith('helplines') || lower.startsWith('call 112') || lower.startsWith('call 108')) {
        if (currentBlock.items.length) blocks.push(currentBlock);
        currentBlock = { type: 'emergency', heading: 'CALL FOR HELP', items: [] };
      } else if (lower.startsWith('disclaimer')) {
        if (currentBlock.items.length) blocks.push(currentBlock);
        currentBlock = { type: 'disclaimer', heading: 'Disclaimer', items: [] };
      } else {
        currentBlock.items.push(item);
      }
    }

    if (currentBlock.items.length) blocks.push(currentBlock);

    return {
      id: `sec-${sIdx + 1}`,
      title: sec.title,
      blocks: blocks.length ? blocks : [{ type: 'general', heading: 'Key Guidance', items: sec.items }]
    };
  });
}

/**
 * Parse a DOCX buffer into structured sections, raw text, and HTML
 */
async function parseDocxBuffer(buffer) {
  try {
    const rawRes = await mammoth.extractRawText({ buffer });
    const htmlRes = await mammoth.convertToHtml({ buffer });
    const rawText = rawRes.value || '';
    const htmlContent = htmlRes.value || '';
    const sections = parseDocxToSections(rawText, htmlContent);

    return {
      rawText,
      htmlContent,
      sections
    };
  } catch (err) {
    console.error('Error parsing docx buffer:', err.message);
    return null;
  }
}

/**
 * Parse a remote DOCX file by URL
 */
async function parseRemoteDocx(url) {
  try {
    if (!url || !url.includes('.docx')) return null;
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    return await parseDocxBuffer(Buffer.from(res.data));
  } catch (err) {
    console.error('Error parsing remote docx:', err.message);
    return null;
  }
}

module.exports = {
  parseDocxToSections,
  parseDocxBuffer,
  parseRemoteDocx
};
