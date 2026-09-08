// api/react.js
export default async function handler(req, res) {
    // CORS untuk semua origin (biar bisa diakses dari mana saja)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { url, emojis, jumlah = 1, delayMs = 1000, version = 'v2', multiplier = 1 } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, message: 'URL wajib diisi' });
    }
    if (!emojis || !Array.isArray(emojis) || emojis.length === 0) {
        return res.status(400).json({ success: false, message: 'Pilih minimal satu emoji' });
    }
    if (jumlah < 1 || jumlah > 100) {
        return res.status(400).json({ success: false, message: 'Jumlah harus 1-100' });
    }

    const reactionStr = emojis.join(',');

    const endpoints = {
        v1: 'https://webfreereact.ai.studio/api/v1/reaction',
        v2: 'https://webfreereact.ai.studio/api/v2/reaction'
    };

    const selectedEndpoint = endpoints[version] || endpoints.v2;

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < jumlah; i++) {
        try {
            const payload = {
                url,
                reaction: reactionStr,
                version: version,
                ...(version === 'v2' && { multiplier: multiplier || 1 })
            };

            const startTime = Date.now();
            const response = await fetch(selectedEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const elapsed = Date.now() - startTime;

            const data = await response.json();

            if (data.success) {
                const taskId = data?.data?.result?.task?.id || 'N/A';
                const worker = data?.data?.result?.task?.worker || 'N/A';
                const status = data?.data?.result?.task?.status || 'Success';
                const responseTime = data?.data?.response_time || `${elapsed}ms`;
                results.push({
                    success: true,
                    message: `Berhasil (${status})`,
                    endpoint: selectedEndpoint,
                    taskId,
                    worker,
                    responseTime,
                    elapsed: `${elapsed}ms`
                });
                successCount++;
            } else {
                results.push({
                    success: false,
                    message: data.error || 'Gagal memproses',
                    endpoint: selectedEndpoint,
                    response: data
                });
                failedCount++;
            }
        } catch (err) {
            results.push({
                success: false,
                message: err.message,
                endpoint: selectedEndpoint,
            });
            failedCount++;
        }

        if (i < jumlah - 1 && delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return res.status(200).json({
        success: failedCount === 0,
        message: `Selesai: ${successCount} berhasil, ${failedCount} gagal`,
        data: {
            successCount,
            failedCount,
            results,
            version,
            total: jumlah
        }
    });
}
