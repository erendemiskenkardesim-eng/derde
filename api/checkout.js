const https = require('https');

module.exports = async function handler(req, res) {
    // CORS Başlıkları
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

    // Parametre Yakalama (Body ve Query)
    let price;
    let orderId;

    try {
        if (req.body) {
            if (typeof req.body === 'object') {
                price = req.body.price;
                orderId = req.body.orderId;
            } else if (typeof req.body === 'string') {
                const parsed = JSON.parse(req.body);
                price = parsed.price;
                orderId = parsed.orderId;
            }
        }

        if (!price && req.query) {
            price = req.query.price;
            orderId = req.query.orderId || req.query.id;
        }

        if (!price && req.url) {
            const host = req.headers.host || 'localhost';
            const fullUrl = new URL(req.url, `https://${host}`);
            price = fullUrl.searchParams.get('price');
            orderId = fullUrl.searchParams.get('orderId') || fullUrl.searchParams.get('id');
        }
    } catch (e) {
        console.error("Parametre okuma hatası:", e);
    }

    if (!price) {
        return res.status(400).json({ success: false, message: "Missing price parameter" });
    }

    const BOTPAY_API_KEY = "botpay_live_52f66ef4a59e0d1c7fb747a13bef9094c28b24f5";
    const postData = JSON.stringify({
        amount: parseFloat(price),
        description: "Order #" + (orderId || Date.now())
    });

    const options = {
        hostname: 'api.botpay.com',
        port: 443,
        path: '/api/v1/create-payment',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': BOTPAY_API_KEY,
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
                    res.status(botpayRes.statusCode || 200).json(jsonResponse);
                } catch (parseErr) {
                    res.status(500).json({ success: false, message: "BotPay yanıtı çözülemedi: " + data });
                }
                resolve();
            });
        });

        botpayReq.on('error', (err) => {
            res.status(500).json({ success: false, message: "BotPay Istek Hatasi: " + err.message });
            resolve();
        });

        botpayReq.write(postData);
        botpayReq.end();
    });
};
