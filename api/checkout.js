const https = require('https');
const querystring = require('querystring');

function getRawBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            resolve(body);
        });
    });
}

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
        let parsedBody = {};

        if (req.body) {
            if (typeof req.body === 'object') {
                parsedBody = req.body;
            } else if (typeof req.body === 'string') {
                try { parsedBody = JSON.parse(req.body); } catch (e) { parsedBody = querystring.parse(req.body); }
            }
        } 

        if (!parsedBody || Object.keys(parsedBody).length === 0) {
            const raw = await getRawBody(req);
            if (raw) {
                try { parsedBody = JSON.parse(raw); } catch (e) { parsedBody = querystring.parse(raw); }
            }
        }

        if (parsedBody && typeof parsedBody === 'object') {
            price = parsedBody.price || parsedBody.amount || parsedBody.total || price;
            orderId = parsedBody.orderId || parsedBody.id || parsedBody.order_id || orderId;
            currency = parsedBody.currency || parsedBody.currency_code || parsedBody.curr || currency;
        }

        if (req.query) {
            price = req.query.price || req.query.amount || req.query.total || price;
            orderId = req.query.orderId || req.query.id || req.query.order_id || orderId;
            currency = req.query.currency || req.query.currency_code || req.query.curr || currency;
        }
    } catch (e) {
        console.error("Parametre okuma hatasi:", e);
    }

    const rawPrice = parseFloat(price) || 5.00;
    
    // Komerza parametreyi doldurmazsa veya süslü parantezli '{currency}' olarak bırakırsa varsayılan olarak USD yap
    let finalCurrency = "USD";
    if (currency && typeof currency === 'string') {
        const trimmed = currency.trim().toUpperCase();
        if (trimmed.length > 0 && !trimmed.includes('{') && !trimmed.includes('}')) {
            finalCurrency = trimmed;
        }
    }

    const BOTPAY_API_KEY = "botpay_live_52f66ef4a59e0d1c7fb747a13bef9094c28b24f5";

    const payloadObj = {
        api_key: BOTPAY_API_KEY,
        amount: rawPrice,
        currency: finalCurrency,
        description: "Sipariş ID: " + (orderId || Date.now()) + " (" + rawPrice + " " + finalCurrency + ")"
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
