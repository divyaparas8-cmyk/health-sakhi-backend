// Quick test: verify period service returns hasData: false when no logs exist
const periodService = require('./src/modules/period/period.service');

async function test() {
  // Using a test userId that doesn't exist
  const testUserId = 'test-user-123';
  
  try {
    const dashboard = await periodService.getDashboard(testUserId);
    console.log('Dashboard response:', JSON.stringify(dashboard, null, 2));
    
    const calendar = await periodService.getCalendar(testUserId, 6, 2026);
    console.log('Calendar response:', JSON.stringify(calendar, null, 2));
  } catch(e) {
    console.error('Error:', e.message);
  }
}

test();
