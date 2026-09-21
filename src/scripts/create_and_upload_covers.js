const fs = require('fs');
const imagekit = require('../config/imagekit');

const COVERS = [
  {
    slug: 'emergency-action-cards',
    title: 'Emergency Action Cards',
    subtitle: '15 True Emergencies — Act First, Call 112 / 108',
    category: 'EMERGENCY PROTOCOL',
    badge: '15 Rapid Cards',
    gradStart: '#e11d48',
    gradEnd: '#be123c',
    iconPath: '<path d="M12 2L2 22h20L12 2zm0 6v6m0 4v.01" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>'
  },
  {
    slug: 'chronic-disease-action-plans',
    title: 'Chronic Disease Action Plans',
    subtitle: 'Green · Yellow · Red — Know Your Safety Zone',
    category: 'CHRONIC CARE',
    badge: 'Traffic Light Triage',
    gradStart: '#d97706',
    gradEnd: '#b45309',
    iconPath: '<path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  {
    slug: 'caregiver-decision-cards',
    title: 'Caregiver Decision Cards',
    subtitle: 'In-The-Moment Bedside Guidance for Families',
    category: 'CAREGIVER SUPPORT',
    badge: 'What To Do When...',
    gradStart: '#7c3aed',
    gradEnd: '#6d28d9',
    iconPath: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>'
  },
  {
    slug: 'care-of-the-bedridden-patient',
    title: 'Care of Bedridden Patient',
    subtitle: 'Daily Home Nursing, Hygiene & Ulcer Prevention',
    category: 'HOME NURSING',
    badge: '2-Hourly Care Guide',
    gradStart: '#0d9488',
    gradEnd: '#059669',
    iconPath: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>'
  },
  {
    slug: 'home-health-device-guides',
    title: 'Home Health Device Guides',
    subtitle: 'Digital BP, Oximeter, Glucometer & Thermometer',
    category: 'DEVICE MASTERY',
    badge: '6 Essential Devices',
    gradStart: '#2563eb',
    gradEnd: '#4f46e5',
    iconPath: '<circle cx="12" cy="12" r="9" stroke="white" stroke-width="2.5" fill="none"/><path d="M12 7v5l3 3" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>'
  },
  {
    slug: 'child-safety-guide',
    title: 'Child Safety Guide',
    subtitle: 'Home, Water, Road & Body Boundaries by Age',
    category: 'PEDIATRIC SAFETY',
    badge: 'Age 0 to 18 Years',
    gradStart: '#059669',
    gradEnd: '#10b981',
    iconPath: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>'
  },
  {
    slug: 'fall-prevention-checklist',
    title: 'Fall Prevention Checklist',
    subtitle: 'Safe Home Room-by-Room Walkthrough for Elders',
    category: 'SENIOR WELLNESS',
    badge: 'Safety Audit',
    gradStart: '#ea580c',
    gradEnd: '#c2410c',
    iconPath: '<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  {
    slug: 'vaccination-schedule-cards',
    title: 'Vaccination Schedule Cards',
    subtitle: 'Child · Adult · Older Adult · Pregnancy Tracker',
    category: 'IMMUNIZATION',
    badge: 'Lifetime Cards',
    gradStart: '#9333ea',
    gradEnd: '#7e22ce',
    iconPath: '<path d="M18 2l4 4-2 2-4-4 2-2zm-5 5l4 4-8 8H5v-4l8-8z" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>'
  },
  {
    slug: 'endocrine-disrupting-chemicals-guide',
    title: 'Endocrine Disrupting Chemicals',
    subtitle: 'Evidence-Based Guide to Reduce Daily Toxins',
    category: 'HORMONE HEALTH',
    badge: 'Toxin-Free Living',
    gradStart: '#db2777',
    gradEnd: '#be185d',
    iconPath: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>'
  },
  {
    slug: 'family-emergency-info-card',
    title: 'Family Emergency Info Card',
    subtitle: 'One Vital Medical Page Per Family Member',
    category: 'VITAL RECORD',
    badge: 'Printable Card',
    gradStart: '#dc2626',
    gradEnd: '#b91c1c',
    iconPath: '<rect x="2" y="5" width="20" height="14" rx="2" stroke="white" stroke-width="2.5" fill="none"/><line x1="2" y1="10" x2="22" y2="10" stroke="white" stroke-width="2.5"/>'
  },
  {
    slug: 'family-contacts-directory',
    title: 'Family Contacts Directory',
    subtitle: 'Ambulance, Doctors, Clinics & Helplines in One Place',
    category: 'DIRECTORY HUB',
    badge: 'Instant Access',
    gradStart: '#4f46e5',
    gradEnd: '#6366f1',
    iconPath: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>'
  },
  {
    slug: 'conflict-resolution-at-home',
    title: 'Conflict Resolution at Home',
    subtitle: 'Practical Communication Tools for Family Harmony',
    category: 'FAMILY WELLNESS',
    badge: 'De-Escalation',
    gradStart: '#c026d3',
    gradEnd: '#a21caf',
    iconPath: '<circle cx="12" cy="12" r="10" stroke="white" stroke-width="2.5" fill="none"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" stroke="white" stroke-width="2.5" stroke-linecap="round"/>'
  },
  {
    slug: 'family-cyber-safety-guide',
    title: 'Family Cyber Safety Guide',
    subtitle: 'Online Banking, OTP Scam & Social Safety for All',
    category: 'CYBER DEFENSE',
    badge: 'Digital Shield',
    gradStart: '#0284c7',
    gradEnd: '#06b6d4',
    iconPath: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="white" stroke-width="2.5" fill="none"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>'
  }
];

function generateSvg(item) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
  <defs>
    <linearGradient id="bgGrad_${item.slug}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${item.gradStart}"/>
      <stop offset="100%" stop-color="${item.gradEnd}"/>
    </linearGradient>
    <radialGradient id="glow_${item.slug}" cx="80%" cy="20%" r="60%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow_${item.slug}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Background with Vibrant Gradient -->
  <rect width="100%" height="100%" fill="url(#bgGrad_${item.slug})"/>
  <rect width="100%" height="100%" fill="url(#glow_${item.slug})"/>

  <!-- Decorative Rings -->
  <circle cx="720" cy="80" r="140" stroke="rgba(255,255,255,0.12)" stroke-width="30" fill="none"/>
  <circle cx="720" cy="80" r="220" stroke="rgba(255,255,255,0.08)" stroke-width="2" fill="none"/>
  <circle cx="80" cy="380" r="160" stroke="rgba(255,255,255,0.08)" stroke-width="2" fill="none"/>

  <!-- HealthSakhi Lotus Top Left -->
  <g transform="translate(48, 44)">
    <rect x="0" y="0" width="170" height="34" rx="17" fill="rgba(255,255,255,0.22)"/>
    <text x="85" y="22" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" letter-spacing="1.5" text-anchor="middle">HEALTHSAKHI CLINICAL</text>
  </g>

  <!-- Category Tag Top Right -->
  <g transform="translate(550, 44)">
    <rect x="0" y="0" width="202" height="34" rx="17" fill="rgba(0,0,0,0.2)"/>
    <text x="101" y="22" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" letter-spacing="1.2" text-anchor="middle">${item.category}</text>
  </g>

  <!-- Center Floating Icon Glass Circle -->
  <g transform="translate(620, 240)" filter="url(#shadow_${item.slug})">
    <circle cx="48" cy="48" r="54" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.45)" stroke-width="2"/>
    <g transform="translate(24, 24) scale(2)">
      ${item.iconPath}
    </g>
  </g>

  <!-- Main Content Bottom Left -->
  <g transform="translate(48, 175)">
    <!-- Subtitle Pill -->
    <rect x="0" y="0" width="${item.badge.length * 9 + 30}" height="28" rx="14" fill="#ffffff"/>
    <text x="${(item.badge.length * 9 + 30)/2}" y="18" fill="${item.gradStart}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" letter-spacing="0.5" text-anchor="middle">${item.badge}</text>

    <!-- Main Title -->
    <text x="0" y="75" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="800" letter-spacing="-0.5">${item.title}</text>
    
    <!-- Subtitle / Clinical Scope -->
    <text x="0" y="115" fill="rgba(255,255,255,0.95)" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="500">${item.subtitle}</text>

    <!-- Footer meta -->
    <g transform="translate(0, 175)">
      <circle cx="6" cy="0" r="4" fill="#ffffff"/>
      <text x="18" y="4" fill="rgba(255,255,255,0.85)" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600">Verified by Dr. Pratap Madhukar · Interactive Companion Toolkit</text>
    </g>
  </g>
</svg>`;
}

async function uploadAllCovers() {
  const coverUrls = {};
  console.log('Generating and uploading 13 vibrant toolkit covers to ImageKit...');

  for (const item of COVERS) {
    const svgStr = generateSvg(item);
    const fileName = `${item.slug}_vibrant_cover.svg`;

    const res = await new Promise((resolve) => {
      imagekit.upload({
        file: Buffer.from(svgStr).toString('base64'),
        fileName: fileName,
        folder: '/healthsakhi_toolkit/covers',
        useUniqueFileName: false
      }, (err, r) => {
        if (err) {
          console.error('Failed cover:', fileName, err.message);
          resolve(null);
        } else {
          console.log('Uploaded cover:', fileName, '->', r.url);
          resolve(r.url);
        }
      });
    });
    coverUrls[item.slug] = res;
  }

  fs.writeFileSync('./health-sakhi-backend/src/data/toolkit_imagekit_covers.json', JSON.stringify(coverUrls, null, 2));
  console.log('Successfully saved updated vibrant toolkit_imagekit_covers.json!');
}

uploadAllCovers().catch(console.error);
