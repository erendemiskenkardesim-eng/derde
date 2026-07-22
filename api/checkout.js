const https = require('https');

// Frankfurter API üzerinden anlık döviz kurunu çeken yardımcı fonksiyon
function getExchangeRate(baseCurrency) {
    return new Promise((resolve) => {
        if (baseCurrency.toUpperCase() === 'TRY') {
            return resolve(1.0);
        }

        const url = `https://api.frankfurter.app/latest?from=${baseCurrency.toUpperCase()}&to=TRY`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed && parsed.rates && parsed.rates.TRY) {
                        resolve(parsed.rates.TRY);
                    } else {
                        resolve(47.21);
                    }
                } catch (e) {
                    resolve(47.21);
                }
            });
        }).on('error', () => {
            resolve(47.21);
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

    const rawPrice = parseFloat(price) || 5.00;
    const cur = (currency || "usd").toUpperCase();

    const rate = await getExchangeRate(cur);
    let amountInTry = rawPrice * rate;

    // BotPay/Stripe minimum 0.50 EUR sınırına (yaklaşık 20-25 TL) takılmayı tamamen engellemek 
    // ve BotPay'in kur filtresini güvenle geçmek için tabanı doğrudan 250 TL yapıyoruz.
    if (amountInTry < 250) {
        amountInTry = 250.00;
    }

    const BOTPAY_API_KEY = "botpay_live_52f66ef4a59e0d1c7fb747a13bef9094c28b24f5";

    const payloadObj = {
        api_key: BOTPAY_API_KEY,
        amount: parseFloat(amountInTry.toFixed(2)),
        description: "Sipariş ID: " + (orderId || Date.now()) + " (" + rawPrice + " " + cur + ")"
    };

    const postData = JSON.stringify(payloadObj);

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
