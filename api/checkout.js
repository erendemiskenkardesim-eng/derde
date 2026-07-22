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

    // Modern WHATWG URL Yapılandırması ile Query / Body Parametre Okuma
    let price;
    let orderId;

    try {
        if (req.body && typeof req.body === 'object') {
            price = req.body.price;
            orderId = req.body.orderId;
        } else if (req.body && typeof req.body === 'string') {
            const parsedBody = JSON.parse(req.body);
            price = parsedBody.price;
            orderId = parsedBody.orderId;
        }

        if (!price && req.url) {
            const fullUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
            price = fullUrl.searchParams.get('price');
            orderId = fullUrl.searchParams.get('orderId') || fullUrl.searchParams.get('id');
        }
    } catch (e) {
        console.error("Parametre okuma hatasi:", e);
    }

    if (!price) {
        return res.status(400).json({ success: false, message: "Missing price parameter" });
    }

    const BOTPAY_API_KEY = "botpay_live_52f66ef4a59e0d1c7fb747a13bef9094c28b24f5";

    try {
        const response = await fetch("https://api.botpay.com/api/v1/create-payment", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": BOTPAY_API_KEY
            },
            body: JSON.stringify({
                amount: parseFloat(price),
                description: "Order #" + (orderId || Date.now())
            })
        });

        const data = await response.json();
        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
