// api/react.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { url, emojis, jumlah = 1, delayMs = 1000 } = req.body;

    if (!url) return res.status(400).json({ success: false, message: 'URL wajib diisi' });
    if (!emojis || !Array.isArray(emojis) || emojis.length === 0) {
        return res.status(400).json({ success: false, message: 'Pilih minimal satu emoji' });
    }

    const reactionStr = emojis.join(',');

    // === KONFIGURASI ===
    const BASE_URL = 'https://reaction-whatsapp.edgeone.dev';
    const API_KEY = process.env.REACTION_API_KEY; // "C3CENFUP" dari Vercel Env

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < jumlah; i++) {
        try {
            const startTime = Date.now();
            const response = await fetch(`${BASE_URL}/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Origin': BASE_URL,
                    'Referer': BASE_URL + '/'
                },
                body: JSON.stringify({
                    link: url,
                    emoji: reactionStr
                })
            });
            const elapsed = Date.now() - startTime;
            const isSuccess = response.status === 200;

            results.push({
                success: isSuccess,
                message: isSuccess ? 'Berhasil' : 'Gagal',
                responseTime: `${elapsed}ms`
            });

            if (isSuccess) successCount++;
            else failedCount++;

        } catch (err) {
            results.push({ success: false, message: 'Gagal', responseTime: 'N/A' });
            failedCount++;
        }

        if (i < jumlah - 1 && delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }

    return res.status(200).json({
        success: failedCount === 0,
        message: `Selesai: ${successCount} berhasil, ${failedCount} gagal`,
        data: { successCount, failedCount, results, total: jumlah }
    });
}
