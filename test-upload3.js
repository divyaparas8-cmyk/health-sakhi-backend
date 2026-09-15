const jwt = require('jsonwebtoken');
const environment = require('./src/config/environment');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const crypto = require('crypto');

async function testUploadLargeFile() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({ where: { email: 'admin@healthsakhi.in' } });
  
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    environment.jwt.secret,
    { expiresIn: '1h' }
  );

  const formData = new FormData();
  // Create a 15MB file
  const buffer = crypto.randomBytes(15 * 1024 * 1024);
  fs.writeFileSync('large_dummy.mp4', buffer);
  formData.append('mediaFile', fs.createReadStream('large_dummy.mp4'));

  try {
    const response = await axios.post('http://localhost:5000/api/v1/admin/content-assets/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Success:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
    if (fs.existsSync('large_dummy.mp4')) fs.unlinkSync('large_dummy.mp4');
  }
}

testUploadLargeFile();
