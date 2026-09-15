const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();
const axios = require('axios');

async function test() {
  const admin = await prisma.user.findFirst({ where: { role: 'Admin' } });
  if (!admin) return console.log('No admin');
  const token = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET || 'dev-jwt-security-secret-key-health-sakhi');
  const res = await axios.get('http://localhost:5000/api/v1/admin/plans', { headers: { Authorization: 'Bearer ' + token } });
  console.log(JSON.stringify(res.data, null, 2));
}

test().catch(console.error).finally(() => prisma.$disconnect());
