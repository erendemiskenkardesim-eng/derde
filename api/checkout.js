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

    let price = 5.00;
    let orderId = '';
    let currency = 'USD';

    try {
        let bodyData = req.body;
        if (bodyData) {
            if (typeof bodyData === 'string') {
                try {
                    bodyData = JSON.parse(bodyData);
                } catch (err) {}
            }
            if (typeof bodyData === 'object' && bodyData !== null) {
                if (bodyData.price !== undefined) price = bodyData.price;
                else if (bodyData.amount !== undefined) price = bodyData.amount;
                
                if (bodyData.orderId !== undefined) orderId = bodyData.orderId;
                else if (bodyData.id !== undefined) orderId = bodyData.id;
                else if (bodyData.order_id !== undefined) orderId = bodyData.order_id;
                
                if (bodyData.currency !== undefined) currency = bodyData.currency;
                else if (bodyData.currency_code !== undefined) currency = bodyData.currency_code;
                else if (bodyData.curr !== undefined) currency = bodyData.curr;
            }
        }

        if (req.query) {
            if (req.query.price !== undefined || req.query.amount !== undefined) {
                price = req.query.price !== undefined ? req.query.price : req.query.amount;
            }
            if (req.query.orderId !== undefined || req.query.id !== undefined || req.query.order_id !== undefined) {
                orderId = req.query.orderId !== undefined ? req.query.orderId : (req.query.id !== undefined ? req.query.id : req.query.order_id);
            }
            if (req.query.currency !== undefined || req.query.currency_code !== undefined || req.query.curr !== undefined) {
                currency = req.query.currency !== undefined ? req.query.currency : (req.query.currency_code !== undefined ? req.query.currency_code : req.query.curr);
            }
        }
    } catch (e) {
        console.error("Parametre okuma hatasi:", e);
    }

    const rawPrice = parseFloat(price) || 5.00;
    
    // Güvenlik: Currency her halükarda dolu ve string olmalı. Boş gelirse zorla USD yapıyoruz.
    const cur = (currency && typeof currency === 'string' && currency.trim() !== '') ? currency.trim().toUpperCase() : 'USD';

    const BOTPAY_API_KEY = "botpay_live_52f66ef4a59e0d1c7fb747a13bef9094c28b24f5";

    // BotPay'in beklediği %100 net ve zorunlu alanlar
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

            botpayRes.on('data', (chunk) => {
                data += chunk;
            });

            botpayRes.on('end', () => {
                try {
                    const jsonResponse = JSON.parse(data);
                    const paymentUrl = jsonResponse.payment_url;
                    
                    if (botpayRes.statusCode >= 200 && botpayRes.statusCode < 300 && paymentUrl) {
                        res.writeHead(302, { Location: paymentUrl });
                        res.end();
                    } else {
                        // Komerza ekranına yansıyacak hata formatı
                        res.status(500).json({
                            success: false,
                            error: jsonResponse.error || jsonResponse.message || "BotPay istegi reddetti."
                        });
                    }
                } catch (parseErr) {
                    res.status(500).json({ success: false, error: "BotPay ham yanit alinamadi: " + data });
                }
                resolve();
            });
        });

        botpayReq.on('error', (err) => {
            res.status(500).json({ success: false, error: "Baglanti hatasi: " + err.message });
            resolve();
        });

        botpayReq.write(postData);
        botpayReq.end();
    });
};
