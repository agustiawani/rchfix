import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

// Gunakan axios dengan cookie jar support
const axiosWithCookie = wrapper(axios);

// Konfigurasi
const BASE_URL = 'https://reactgo.order-rz.my.id';
const API_ENDPOINT = '/api/dev/react';

// API Key yang diberikan (bisa digunakan atau tidak, tapi kita tetap pakai untuk auth)
// Jika tidak mau pakai API key, hapus header x-api-key
const API_KEY = 'rzone_c12a33e789990ccef63b8b4b9e9753087bed7ec2146aab52';

/**
 * Membuat session baru (seperti tab samaran)
 * Setiap panggilan menghasilkan cookie jar baru
 */
function createNewSession() {
  const jar = new CookieJar();
  return jar;
}

/**
 * Mengirim reaction dengan session baru
 * Ini mensimulasikan "tab samaran" di backend
 */
async function sendReactionWithNewSession(url, emojis) {
  // Buat session baru (seperti buka tab samaran)
  const jar = createNewSession();
  
  // Generate user agent yang berbeda-beda agar lebih natural
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
  ];
  
  const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
  
  // Generate request ID unik
  const requestId = uuidv4().substring(0, 8);

  try {
    const response = await axiosWithCookie.post(
      `${BASE_URL}${API_ENDPOINT}`,
      {
        link: url,
        emojis: emojis
      },
      {
        jar: jar, // <-- Kunci! Setiap request pakai cookie jar baru
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY, // Bisa dihapus jika tidak diperlukan
          'User-Agent': randomUA,
          'X-Request-Id': requestId,
          'Origin': BASE_URL,
          'Referer': `${BASE_URL}/`
        },
        timeout: 30000,
        validateStatus: () => true // Terima semua status
      }
    );

    return {
      success: response.status === 200 && response.data?.ok === true,
      status: response.status,
      data: response.data,
      sessionId: requestId,
      userAgent: randomUA
    };
  } catch (error) {
    return {
      success: false,
      status: 500,
      message: error.message,
      sessionId: requestId
    };
  }
}

/**
 * Handler utama untuk Vercel
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { url, emojis, jumlah = 1, delayMs = 500 } = req.body;

    // Validasi input
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL wajib diisi' });
    }
    if (!Array.isArray(emojis) || emojis.length === 0) {
      return res.status(400).json({ success: false, message: 'Pilih minimal satu emoji' });
    }
    if (jumlah < 1 || jumlah > 100) {
      return res.status(400).json({ success: false, message: 'Jumlah antara 1-100' });
    }

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    console.log(`[START] Mengirim ${jumlah} reaction ke ${url} dengan emoji ${emojis.join(', ')}`);

    for (let i = 0; i < jumlah; i++) {
      console.log(`[${i+1}/${jumlah}] Membuka session baru (tab samaran)...`);
      
      // Kirim dengan session baru (seperti tab samaran)
      const result = await sendReactionWithNewSession(url, emojis);
      
      if (result.success) {
        successCount++;
        console.log(`[${i+1}/${jumlah}] ✅ Berhasil! Session: ${result.sessionId}`);
      } else {
        failedCount++;
        console.log(`[${i+1}/${jumlah}] ❌ Gagal! Status: ${result.status}, Message: ${result.message || result.data?.message || 'Unknown'}`);
      }

      results.push({
        index: i + 1,
        success: result.success,
        sessionId: result.sessionId,
        status: result.status,
        message: result.data?.message || result.message || (result.success ? 'OK' : 'Gagal'),
        userAgent: result.userAgent || '-'
      });

      // Jeda antar request (biar tidak terlalu cepat)
      if (i < jumlah - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`[DONE] Selesai! Sukses: ${successCount}, Gagal: ${failedCount}`);

    return res.status(200).json({
      success: true,
      message: `Berhasil: ${successCount}, Gagal: ${failedCount}`,
      data: {
        url,
        emojis,
        jumlah,
        delayMs,
        successCount,
        failedCount,
        results,
        metode: 'session-rotation (incognito mode simulation)',
        note: 'Setiap request menggunakan session/cookie baru seperti tab samaran'
      }
    });
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
