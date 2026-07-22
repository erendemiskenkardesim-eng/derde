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
        if (req.body) {
            if (typeof req.body === 'object') {
                price = req.body.price;
                orderId = req.body.orderId;
                currency = req.body.currency;
            } else if (typeof req.body === 'string') {
                const parsed = JSON.parse(req.body);
                price = parsed.price;
                orderId = parsed.orderId;
                currency = parsed.currency;
            }
        }

        if (!price && req.query) {
            price = req.query.price;
            orderId = req.query.orderId || req.query.id;
            currency = req.query.currency;
        }
    } catch (e) {
        console.error("Parametre okuma hatasi:", e);
    }

    if (!price) {
        return res.status(400).json({ success: false, message: "Missing price parameter" });
    }

    const BOTPAY_API_KEY = "botpay_live_52f66ef4a59e0d1c7fb747a13bef9094c28b24f5";

    const postData = JSON.stringify({
        api_key: BOTPAY_API_KEY,
        amount: parseFloat(price),
        currency: currency || "usd",
        description: "Order #" + (orderId || Date.now())
    });

    const options = {
        hostname: 'api.botpay.com',
        port: 443,
        path: '/api/v1/create-link',
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
                    
                    // BotPay basarili link döndüyse, kullanıcıyı direkt o linke yönlendir (302 Redirect)
                    const paymentUrl = jsonResponse.payment_url || jsonResponse.url || jsonResponse.link;
                    
                    if (botpayRes.statusCode >= 200 && botpayRes.statusCode < 300 && paymentUrl) {
                        res.writeHead(302, { Location: paymentUrl });
                        res.end();
                    } else {
                        res.status(500).json({
                            success: false,
                            message: "BotPay Yaniti: " + (jsonResponse.message || data)
                        });
                    }
                } catch (parseErr) {
                    res.status(500).json({ success: false, message: "BotPay ham yanit cozumlenemedi: " + data });
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
