const https = require('https');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    let price;
    let orderId;
    let currency;

    try {
        let bodyData = req.body;
        if (bodyData) {
            if (typeof bodyData === 'string') {
                try {
                    bodyData = JSON.parse(bodyData);
                } catch (err) {}
            }
            if (typeof bodyData === 'object' && bodyData !== null) {
                price = bodyData.price || bodyData.amount;
                orderId = bodyData.orderId || bodyData.id || bodyData.order_id;
                currency = bodyData.currency || bodyData.currency_code || bodyData.curr;
            }
        }

        if ((!price || !currency) && req.query) {
            if (!price) price = req.query.price || req.query.amount;
            if (!orderId) orderId = req.query.orderId || req.query.id || req.query.order_id;
            if (!currency) currency = req.query.currency || req.query.currency_code || req.query.curr;
        }
    } catch (e) {
        console.error("Parametre okuma hatasi:", e);
    }

    const rawPrice = parseFloat(price) || 5.00;
    const cur = currency && typeof currency === 'string' && currency.trim() !== '' ? currency.trim().toUpperCase() : 'USD';

    const BOTPAY_API_KEY = "botpay_live_52f66ef4a59e0d1c7fb747a13bef9094c28b24f5";

    const payloadObj = {
        api_key: BOTPAY_API_KEY,
        amount: rawPrice,
        currency: cur,
        description: "Sipariş ID: " + (orderId || Date.now()) + " (" + rawPrice + " " + cur + ")"
    };

    const postData = JSON.stringify(payloadObj);

    const options = {
        hostname: 'capsule-swerve-crystal.ngrok-free.dev',
        port: 443,
        path: '/api/v1/create-payment',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve) => {
        const botpayReq = https.request(options, (botpayRes) => {
            let data = '';

            botpayReq.on('data', (chunk) => {
                data += chunk;
            });

            botpayReq.on('end', () => {
                try {
                    const jsonResponse = JSON.parse(data);
                    const paymentUrl = jsonResponse.payment_url;
                    
                    if (botpayRes.statusCode >= 200 && botpayRes.statusCode < 300 && paymentUrl) {
                        res.writeHead(302, { Location: paymentUrl });
                        res.end();
                    } else {
                        res.status(500).json({
                            success: false,
                            message: "BotPay Redetti: " + (jsonResponse.error || jsonResponse.message || data)
                        });
                    }
                } catch (parseErr) {
                    res.status(500).json({ success: false, message: "BotPay ham yanit alinamadi: " + data });
                }
                resolve();
            });
        });

        botpayReq.on('error', (err) => {
            res.status(500).json({ success: false, message: "Baglanti hatasi: " + err.message });
            resolve();
        });

        botpayReq.write(postData);
        botpayReq.end();
    });
};
