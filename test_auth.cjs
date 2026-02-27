const crypto = require('crypto');
const axios = require('axios');

const config = {
    apiKey: 'a6169cb7-d7a6-46ba-9b31-ca8734aa5347',
    apiSecret: '1EEC94C3E48EDD74530F99646F85965C',
    passphrase: 'bAreq@b1',
    isDemo: false
};

async function testOKX() {
    const timestamp = new Date().toISOString();
    const method = 'GET';
    const path = '/api/v5/account/balance';
    const message = timestamp + method + path;
    
    const signature = crypto
        .createHmac('sha256', config.apiSecret)
        .update(message)
        .digest('base64');

    console.log('--- Checking Connection ---');
    try {
        const response = await axios({
            method: method,
            url: `https://www.okx.com${path}`,
            headers: {
                'OK-ACCESS-KEY': config.apiKey,
                'OK-ACCESS-SIGN': signature,
                'OK-ACCESS-TIMESTAMP': timestamp,
                'OK-ACCESS-PASSPHRASE': config.passphrase,
                'x-simulated-trading': config.isDemo ? '1' : '0',
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ SUCCESS!');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ FAILED!');
        if (error.response) {
            console.log('Code:', error.response.data.code);
            console.log('Msg:', error.response.data.msg);
        } else {
            console.log('Error:', error.message);
        }
    }
}

testOKX();
