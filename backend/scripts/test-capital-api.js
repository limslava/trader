const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6IjI3MjAyMzNAZ21haWwuY29tIiwidXNlcklkIjoyLCJ1c2VybmFtZSI6InRlc3RfdXNlciIsImlhdCI6MTczMDc0MjU0OCwiZXhwIjoxNzMwODI4OTQ4fQ.8QvQqQJQ8QvQqQJQ8QvQqQJQ8QvQqQJQ8QvQqQJQ'; // Замените на актуальный токен

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function testCapitalAPI() {
  try {
    console.log('🧪 Тестирование API управления капиталом...\n');

    // 1. Получить текущий капитал
    console.log('1. Получение текущего капитала...');
    const getResponse = await axios.get(`${BASE_URL}/capital`, { headers });
    console.log('✅ Текущий капитал:', getResponse.data.data);
    console.log('');

    // 2. Установить стартовый капитал
    console.log('2. Установка стартового капитала 50000 ₽...');
    const initialResponse = await axios.post(`${BASE_URL}/capital/initial`, 
      { amount: 50000 }, 
      { headers }
    );
    console.log('✅ Результат установки капитала:', initialResponse.data);
    console.log('');

    // 3. Пополнить счет
    console.log('3. Пополнение счета на 25000 ₽...');
    const depositResponse = await axios.post(`${BASE_URL}/capital/deposit`, 
      { amount: 25000 }, 
      { headers }
    );
    console.log('✅ Результат пополнения:', depositResponse.data);
    console.log('');

    // 4. Получить доступные средства
    console.log('4. Получение доступных средств...');
    const availableResponse = await axios.get(`${BASE_URL}/capital/available`, { headers });
    console.log('✅ Доступные средства:', availableResponse.data.data);
    console.log('');

    // 5. Вывести средства
    console.log('5. Вывод средств 10000 ₽...');
    const withdrawResponse = await axios.post(`${BASE_URL}/capital/withdraw`, 
      { amount: 10000 }, 
      { headers }
    );
    console.log('✅ Результат вывода:', withdrawResponse.data);
    console.log('');

    // 6. Финальная проверка капитала
    console.log('6. Финальная проверка капитала...');
    const finalResponse = await axios.get(`${BASE_URL}/capital`, { headers });
    console.log('✅ Финальный капитал:', finalResponse.data.data);

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.response?.data || error.message);
  }
}

// Запуск теста
testCapitalAPI();