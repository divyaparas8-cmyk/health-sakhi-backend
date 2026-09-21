const fs = require('fs');
const path = require('path');
const mammoth = require('./frontenhealth/node_modules/mammoth');

const docUrls = JSON.parse(fs.readFileSync('./health-sakhi-backend/src/data/toolkit_imagekit_documents.json', 'utf8'));
const coverUrls = JSON.parse(fs.readFileSync('./health-sakhi-backend/src/data/toolkit_imagekit_covers.json', 'utf8'));

const TOOLKIT_METADATA = [
  {
    fileName: 'HealthSakhi_Emergency_Action_Cards.docx',
    slug: 'emergency-action-cards',
    title: 'Emergency Action Cards',
    subtitle: '15 True Emergencies — Act First, Call Immediately',
    category: 'Emergency & Critical Care',
    badge: 'Immediate Action',
    accentColor: 'from-rose-500 to-red-600',
    icon: 'AlertTriangle',
    readTime: '15 Min Read · 15 Action Protocols',
    summary: 'Clinical emergency protocol covering chest pain, stroke (FAST), anaphylaxis, severe breathing distress, seizures, choking, severe bleeding, and critical stabilization before ambulance arrival.'
  },
  {
    fileName: 'HealthSakhi_Chronic_Disease_Action_Plans.docx',
    slug: 'chronic-disease-action-plans',
    title: 'Chronic-Disease Action Plans',
    subtitle: 'Green · Yellow · Red — Know Which Zone You Are In',
    category: 'Chronic Care',
    badge: 'Clinical Zone Plan',
    accentColor: 'from-amber-500 to-orange-600',
    icon: 'Activity',
    readTime: '12 Min Read · Zone Rules',
    summary: 'Clear 3-zone action plans (Green = Good, Yellow = Caution, Red = Danger) for Diabetes, Hypertension, Asthma/COPD, and Heart Failure with step-by-step medication and escalation guidelines.'
  },
  {
    fileName: 'HealthSakhi_Caregiver_Decision_Cards.docx',
    slug: 'caregiver-decision-cards',
    title: 'Caregiver Decision Cards',
    subtitle: '“What To Do When…” — In-the-Moment Guidance for Family Caregivers',
    category: 'Daily Care & Nursing',
    badge: 'Caregiver Support',
    accentColor: 'from-purple-600 to-indigo-600',
    icon: 'HeartHandshake',
    readTime: '10 Min Read · In-The-Moment Help',
    summary: 'Rapid bedside guidance for family caregivers: what to do when your loved one refuses medication, experiences sundowning or confusion, refuses food, falls, or shows signs of severe distress.'
  },
  {
    fileName: 'HealthSakhi_Care_of_the_Bedridden_Patient.docx',
    slug: 'care-of-the-bedridden-patient',
    title: 'Care of the Bedridden Patient',
    subtitle: 'A Daily-Care Guide for Family Caregivers at Home',
    category: 'Daily Care & Nursing',
    badge: 'Home Nursing',
    accentColor: 'from-teal-600 to-emerald-600',
    icon: 'Bed',
    readTime: '8 Min Read · Daily Nursing Steps',
    summary: 'Essential home nursing protocol: 2-hourly repositioning, pressure ulcer (bedsores) prevention, hygiene, sponge bathing, catheter & feeding care, and preventing aspiration pneumonia.'
  },
  {
    fileName: 'HealthSakhi_Home_Health_Device_Guides.docx',
    slug: 'home-health-device-guides',
    title: 'Home Health Device Guides',
    subtitle: 'How To Use It, What The Reading Means, When To Worry',
    category: 'Health Monitoring',
    badge: 'Device Mastery',
    accentColor: 'from-blue-600 to-cyan-600',
    icon: 'Gauge',
    readTime: '10 Min Read · 6 Essential Devices',
    summary: 'Accurate usage instructions and clinical interpretation for Digital BP Monitors, Pulse Oximeters, Glucometers, Digital Thermometers, Nebulizers, and Weight Scales with danger thresholds.'
  },
  {
    fileName: 'HealthSakhi_Child_Safety_Guide.docx',
    slug: 'child-safety-guide',
    title: 'Child Safety Guide',
    subtitle: 'Home, Water, Road & Body Safety — By Age',
    category: 'Family & Child Safety',
    badge: 'Pediatric Safety',
    accentColor: 'from-emerald-500 to-teal-600',
    icon: 'ShieldAlert',
    readTime: '7 Min Read · Age-Wise Rules',
    summary: 'Age-appropriate safety rules from infancy to teens covering choking hazards, kitchen and electrical safety, pool/water supervision, helmet and car safety, and safe body boundaries.'
  },
  {
    fileName: 'HealthSakhi_Fall_Prevention_Checklist.docx',
    slug: 'fall-prevention-checklist',
    title: 'Fall Prevention Checklist for Elders',
    subtitle: 'A Room-by-Room Walkthrough to Make Home Safer',
    category: 'Family & Child Safety',
    badge: 'Senior Safety',
    accentColor: 'from-orange-500 to-amber-600',
    icon: 'CheckSquare',
    readTime: '6 Min Read · Room-By-Room Audit',
    summary: 'Comprehensive home safety audit: bathroom grab bars, non-slip mats, nightlights, eliminating rugs/tripping cords, proper footwear, and medication reviews that cause dizziness.'
  },
  {
    fileName: 'HealthSakhi_Vaccination_Schedule_Cards.docx',
    slug: 'vaccination-schedule-cards',
    title: 'Vaccination Schedule Cards',
    subtitle: 'Child · Adult · Older Adult · Pregnancy — Fill-In Vaccination Record',
    category: 'Preventive Health',
    badge: 'Immunization Tracker',
    accentColor: 'from-violet-600 to-purple-700',
    icon: 'Syringe',
    readTime: '8 Min Read · All Age Groups',
    summary: 'Complete immunization guide across the life cycle: childhood vaccines, pregnancy Tdap/Flu, adult HPV/Hepatitis, and senior shingles and pneumonia vaccines with tracking card format.'
  },
  {
    fileName: 'HealthSakhi_Endocrine_Disrupting_Chemicals_Guide.docx',
    slug: 'endocrine-disrupting-chemicals-guide',
    title: 'Endocrine-Disrupting Chemicals Guide',
    subtitle: 'An Evidence-Based Family Guide to Everyday Exposure & Reduction',
    category: 'Preventive Health',
    badge: 'Hormone Health',
    accentColor: 'from-pink-600 to-rose-600',
    icon: 'Sparkles',
    readTime: '8 Min Read · Toxic-Free Living',
    summary: 'Practical clinical advice on identifying and reducing daily exposure to phthalates, BPA, parabens, PFAS, and heavy metals in plastics, cookware, personal care products, and food.'
  },
  {
    fileName: 'HealthSakhi_Family_Emergency_Info_Card.docx',
    slug: 'family-emergency-info-card',
    title: 'Family Emergency Information Card',
    subtitle: 'One Page Per Family Member — Fill In By Hand',
    category: 'Family Directory & Cards',
    badge: 'Critical Card',
    accentColor: 'from-red-600 to-rose-700',
    icon: 'CreditCard',
    readTime: '4 Min Read · Printable Card',
    summary: 'Standardized single-page vital profile per family member: blood group, chronic conditions, regular medications, known allergies, insurance details, and primary physician contact.'
  },
  {
    fileName: 'HealthSakhi_Family_Contacts_Directory.docx',
    slug: 'family-contacts-directory',
    title: 'Family Important Contacts Directory',
    subtitle: 'Everyone You May Need to Reach — In One Place',
    category: 'Family Directory & Cards',
    badge: 'Contacts Hub',
    accentColor: 'from-sky-600 to-blue-700',
    icon: 'PhoneCall',
    readTime: '5 Min Read · Ready Directory',
    summary: 'Centralized crisis and daily contact repository: ambulance, local hospitals, family doctor, pediatric clinic, 24x7 pharmacy, poison control, elder helpline, plumber, and emergency relatives.'
  },
  {
    fileName: 'HealthSakhi_Conflict_Resolution_at_Home.docx',
    slug: 'conflict-resolution-at-home',
    title: 'Conflict Resolution at Home',
    subtitle: 'Practical Tools for Handling Everyday Household Disagreements',
    category: 'Mental & Family Wellness',
    badge: 'Peace & Harmony',
    accentColor: 'from-fuchsia-600 to-pink-600',
    icon: 'Smile',
    readTime: '7 Min Read · Communication Toolkit',
    summary: 'Emotional intelligence and de-escalation strategies: "I" statements instead of blame, taking intentional 20-minute timeouts, active listening techniques, and reaching fair compromises.'
  },
  {
    fileName: 'HealthSakhi_Family_Cyber_Safety_Guide.docx',
    slug: 'family-cyber-safety-guide',
    title: 'Family Cyber Safety Guide',
    subtitle: 'Staying Safe Online — For Every Generation in the Family',
    category: 'Family & Child Safety',
    badge: 'Cyber Defense',
    accentColor: 'from-cyan-600 to-teal-700',
    icon: 'Shield',
    readTime: '6 Min Read · Digital Protection',
    summary: 'Protection against UPI/OTP banking fraud, phishing links, social media privacy, safe gaming for kids, senior digital vigilance against fake medical calls, and 2-factor authentication.'
  }
];

async function generateData() {
  const dir = './HealthSakhi_Endocrine_Disrupting_Chemicals_Guide';
  const outList = [];

  for (let i = 0; i < TOOLKIT_METADATA.length; i++) {
    const item = TOOLKIT_METADATA[i];
    const full = path.join(dir, item.fileName);
    const htmlRes = await mammoth.convertToHtml({ path: full });
    const rawRes = await mammoth.extractRawText({ path: full });

    outList.push({
      id: `toolkit-${i + 1}`,
      ...item,
      coverUrl: coverUrls[item.slug] || '',
      documentUrl: docUrls[item.fileName] || '',
      htmlContent: htmlRes.value,
      rawText: rawRes.value
    });
  }

  const jsContent = 'export const FAMILY_TOOLKIT_DATA = ' + JSON.stringify(outList, null, 2) + ';\n';
  fs.writeFileSync('./frontenhealth/src/data/familyToolkitData.js', jsContent);
  console.log('Successfully generated frontenhealth/src/data/familyToolkitData.js with 13 rich guides!');
}

generateData().catch(console.error);
