module.exports = async function handler(req, res) {
    // CORS Başlıkları (Komerza ve diğer kaynaklardan gelen isteklere izin verir)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONS (Preflight) isteklerini hemen yanıtla
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Parametreleri al
    const { price, orderId } = req.body || req.query || {};

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
