const http = require('http');

http.get('http://localhost:5000/api/v1/faqs', (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(raw);
      console.log('HTTP Status:', res.statusCode);
      console.log('Success:', data.success);
      console.log('Total FAQs returned:', data.data.length);
      console.log('First FAQ:', `[#${data.data[0].displayOrder}] ${data.data[0].question}`);
      console.log('Last FAQ:', `[#${data.data[data.data.length - 1].displayOrder}] ${data.data[data.data.length - 1].question}`);
      
      // Test search filter
      testSearch();
    } catch (e) {
      console.error('Parse error:', e);
    }
  });
}).on('error', (e) => {
  console.error('Request error:', e.message);
});

function testSearch() {
  http.get('http://localhost:5000/api/v1/faqs?search=trauma', (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      const data = JSON.parse(raw);
      console.log('\nSearch "trauma" results count:', data.data.length);
      data.data.forEach(d => console.log(`  - [#${d.displayOrder}] ${d.question}`));
    });
  });
}
