const PDFDocument = require('pdfkit');

/**
 * Generates a clean, doctor-friendly PDF report from diary entries
 */
const buildDiaryPDF = (entries, profile, res, customPatientName) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  
  // Pipe its output to response stream
  doc.pipe(res);
  
  // Document Header / Decorative top accent
  doc.rect(0, 0, 595.28, 20).fill('#4B1E5A');
  
  // Title
  doc.fillColor('#4B1E5A')
     .font('Helvetica-Bold')
     .fontSize(22)
     .text('Sakhi Diary – Medical & Wellness Record', 50, 45, { align: 'center' });
     
  doc.moveDown(1.5);
  
  const patientDisplayName = customPatientName && customPatientName.trim() 
    ? customPatientName.trim() 
    : (profile?.fullName || 'Wellness Sakhi Member');

  // User Profile section
  doc.fillColor('#15192C')
     .font('Helvetica-Bold')
     .fontSize(11)
     .text(`Patient / Member Name: ${patientDisplayName}`)
     .font('Helvetica')
     .text(`Export Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`)
     .text(`Total Records Exported: ${entries.length} log entries`);
     
  doc.moveDown(1);
  doc.strokeColor('#ff69b4').lineWidth(1.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1.5);
  
  if (entries.length === 0) {
    doc.fillColor('#777777')
       .font('Helvetica-Oblique')
       .fontSize(12)
       .text('No diary logs found in the database matching this request.', { align: 'center' });
  } else {
    // Iterate entries
    entries.forEach((entry, idx) => {
      // Add page if near bottom
      if (doc.y > 680) {
        doc.addPage();
        // Decorative top bar for subsequent pages
        doc.rect(0, 0, 595.28, 15).fill('#4B1E5A');
        doc.moveDown(2);
      }
      
      const formattedDate = new Date(entry.entryDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      
      doc.fillColor('#E91E63')
         .font('Helvetica-Bold')
         .fontSize(13)
         .text(`Log Date: ${formattedDate}`);
         
      doc.moveDown(0.5);
      
      // Symptoms / Diagnosis
      if (entry.symptoms || entry.doctorNotes || entry.diagnosis) {
        doc.fillColor('#4B1E5A').font('Helvetica-Bold').fontSize(9.5).text('[ CLINICAL DATA ]');
        doc.fillColor('#333333').font('Helvetica').fontSize(8.5);
        if (entry.symptoms) doc.text(`• Symptoms logged: ${entry.symptoms}`);
        if (entry.diagnosis) doc.text(`• Diagnosis/Conditions: ${entry.diagnosis}`);
        if (entry.doctorNotes) doc.text(`• Doctor's visit notes: ${entry.doctorNotes}`);
        doc.moveDown(0.5);
      }
      
      // Medicines
      if (entry.medicines && entry.medicines.length > 0) {
        doc.fillColor('#4B1E5A').font('Helvetica-Bold').fontSize(9.5).text('[ ACTIVE MEDICATION ]');
        entry.medicines.forEach(m => {
          doc.fillColor('#333333').font('Helvetica').fontSize(8.5);
          const schedText = m.schedule ? ` [Schedule: ${m.schedule}]` : '';
          const memberText = m.memberName ? ` (Assigned to: ${m.memberName})` : '';
          
          let durationText = '';
          if (m.startDate || m.endDate) {
            const startStr = m.startDate ? new Date(m.startDate).toLocaleDateString('en-IN') : 'N/A';
            const endStr = m.endDate ? new Date(m.endDate).toLocaleDateString('en-IN') : 'Ongoing';
            durationText = ` | Duration: ${startStr} to ${endStr}`;
          }
          
          doc.text(`• ${m.name} - Dosage: ${m.dosage}${schedText}${durationText}${memberText}`);
        });
        doc.moveDown(0.5);
      }

      // Nutrition
      if (entry.meals || entry.waterIntake || entry.dietType) {
        doc.fillColor('#4B1E5A').font('Helvetica-Bold').fontSize(9.5).text('[ DIET & HYDRATION ]');
        doc.fillColor('#333333').font('Helvetica').fontSize(8.5);
        if (entry.meals) doc.text(`• Meals intake: ${entry.meals}`);
        if (entry.dietType) doc.text(`• Nutrition type: ${entry.dietType}`);
        if (entry.waterIntake) doc.text(`• Water consumption: ${entry.waterIntake} Litres`);
        doc.moveDown(0.5);
      }
      
      // Harmony
      if (entry.mood || entry.harmonyNotes || entry.gratitude) {
        doc.fillColor('#4B1E5A').font('Helvetica-Bold').fontSize(9.5).text('[ FAMILY HARMONY & MOOD ]');
        doc.fillColor('#333333').font('Helvetica').fontSize(8.5);
        if (entry.mood) doc.text(`• Emotional status: ${entry.mood}`);
        if (entry.harmonyNotes) doc.text(`• Interactions: ${entry.harmonyNotes}`);
        if (entry.gratitude) doc.text(`• Gratitude entry: ${entry.gratitude}`);
        doc.moveDown(0.5);
      }

      // Personal Notes
      if (entry.personalNotes) {
        doc.fillColor('#4B1E5A').font('Helvetica-Bold').fontSize(9.5).text('[ PERSONAL REFLECTIONS ]');
        doc.fillColor('#333333').font('Helvetica').fontSize(8.5);
        doc.text(`"${entry.personalNotes}"`);
        doc.moveDown(0.5);
      }
      
      doc.moveDown(0.5);
      doc.strokeColor('#e5e5e5').lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.8);
    });
  }
  
  doc.end();
};

module.exports = { buildDiaryPDF };
