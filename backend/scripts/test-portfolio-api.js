const axios = require('axios');

async function testPortfolioAPI() {
  try {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6IjI3MjAyMzNAZ21haWwuY29tIiwidXNlcklkIjoyLCJ1c2VybmFtZSI6InRlc3RfdXNlciIsImlhdCI6MTczMDc0NDU3OCwiZXhwIjoxNzMwODMwOTc4fQ.3QJQJQJQJQJQJQJQJQJQJQJQJQJQJQJQJQJQJQJQ';
    
    console.log('🔍 Тестирование API портфеля...');
    
    const response = await axios.get('http://localhost:3001/api/portfolio', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('📊 Ответ API портфеля:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Проверяем сводку портфеля
    const summaryResponse = await axios.get('http://localhost:3001/api/portfolio/summary', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('\\n📊 Сводка портфеля:');
    console.log(JSON.stringify(summaryResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Ошибка тестирования API:', error.response?.data || error.message);
  }
}

testPortfolioAPI();