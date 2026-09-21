const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const prisma = new PrismaClient();
const axios = require('axios');

async function main() {
  const admin = await prisma.user.findFirst({
    where: {
      role: { name: 'Admin' }
    },
    include: { role: true }
  });
  console.log('Admin user found:', admin ? admin.email : 'None');
  if (!admin) {
    console.log('No admin found');
    return;
  }
  const token = jwt.sign({ userId: admin.id, role: admin.role.name }, process.env.JWT_SECRET || 'dev-jwt-security-secret-key-health-sakhi', { expiresIn: '7d' });
  
  // Test GET /api/v1/admin/faqs
  const res = await axios.get('http://localhost:5000/api/v1/admin/faqs', {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('Admin API Status:', res.status);
  console.log('Admin FAQs Count:', res.data.data.length);
  console.log('First FAQ:', `[#${res.data.data[0].displayOrder}] ${res.data.data[0].question}`);
  console.log('Last FAQ:', `[#${res.data.data[res.data.data.length - 1].displayOrder}] ${res.data.data[res.data.data.length - 1].question}`);
  
  // Test category filter
  const catRes = await axios.get('http://localhost:5000/api/v1/admin/faqs', {
    headers: { Authorization: `Bearer ${token}` },
    params: { category: 'Periods, Puberty, and Hormone Changes' }
  });
  console.log('Category filter "Periods, Puberty, and Hormone Changes" count:', catRes.data.data.length);
  catRes.data.data.forEach(f => console.log(`  - [#${f.displayOrder}] ${f.question}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
