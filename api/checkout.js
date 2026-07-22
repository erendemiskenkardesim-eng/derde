const https = require('https');

module.exports = async function handler(req, res) {
    // Tam Kapsamlı CORS Başlıkları
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // OPTIONS (Preflight) İsteğini Yanıtla
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Parametre Yakalama (Body ve Query)
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
        console.error("Parametre parsing hatasi:", e);
    }

    if (!price) {
        return res.status(400).json({ success: false, message: "Missing price parameter" });
    }

    const BOTPAY_API_KEY = "botpay_live_52f66ef4a59e0d1c7fb747a13bef9094c28b24f5";

    // BotPay'in Tam Olarak Beklediği JSON Gövdesi
    const postData = JSON.stringify({
        api_key: BOTPAY_API_KEY,
        amount: parseFloat(price),
        currency: currency || "eur",
        description: "Order #" + (orderId || Date.now())
    });

    const options = {
        hostname: 'api.botpay.com',
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

                    if (botpayRes.statusCode >= 200 && botpayRes.statusCode < 300) {
                        res.status(200).json(jsonResponse);
                    } else {
                        console.error("BotPay API Hatasi:", data);
                        res.status(400).json({
                            success: false,
                            message: jsonResponse.message || jsonResponse.error || "BotPay istegi reddetti.",
                            botpayResponse: jsonResponse
                        });
                    }
                } catch (parseErr) {
                    res.status(500).json({ success: false, message: "BotPay ham yanit: " + data });
                }
                resolve();
            });
        });

        botpayReq.on('error', (err) => {
            res.status(500).json({ success: false, message: "BotPay Baglanti Hatasi: " + err.message });
            resolve();
        });

        botpayReq.write(postData);
        botpayReq.end();
    });
};
