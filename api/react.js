// api/react.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { url, emojis, jumlah = 1, delayMs = 3000 } = req.body;

    // === VALIDASI ===
    if (!url) {
        return res.status(400).json({ success: false, message: 'URL wajib diisi' });
    }
    if (!emojis || !Array.isArray(emojis) || emojis.length === 0) {
        return res.status(400).json({ success: false, message: 'Pilih minimal satu emoji' });
    }

    // Batasi maksimum 15 per request (batas aman EdgeOne)
    const MAX_PER_REQUEST = 15;
    let finalJumlah = parseInt(jumlah, 10) || 1;
    if (finalJumlah < 1) finalJumlah = 1;
    if (finalJumlah > MAX_PER_REQUEST) {
        return res.status(400).json({
            success: false,
            message: `Maksimal ${MAX_PER_REQUEST} pengiriman per request. Gunakan fitur batch untuk jumlah lebih besar.`
        });
    }

    // Delay minimal 2000ms (anti rate limit)
    let finalDelay = parseInt(delayMs, 10) || 3000;
    if (finalDelay < 2000) finalDelay = 2000;
    if (finalDelay > 10000) finalDelay = 10000;

    const reactionStr = emojis.join(',');

    // === KONFIGURASI API ===
    const BASE_URL = 'https://reaction-whatsapp.edgeone.dev';
    const API_KEY = process.env.REACTION_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({
            success: false,
            message: 'Konfigurasi server belum lengkap.'
        });
    }

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < finalJumlah; i++) {
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
            let data = {};
            try { data = await response.json(); } catch (e) { /* biarkan kosong */ }

            const isSuccess = response.status === 200 && (data.ok === true || data.success === true);

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

        // Jeda antar request (kecuali yang terakhir)
        if (i < finalJumlah - 1 && finalDelay > 0) {
            await new Promise(r => setTimeout(r, finalDelay));
        }
    }

    return res.status(200).json({
        success: failedCount === 0,
        message: `Selesai: ${successCount} berhasil, ${failedCount} gagal`,
        data: {
            successCount,
            failedCount,
            results,
            total: finalJumlah,
            delayUsed: finalDelay
        }
    });
}
