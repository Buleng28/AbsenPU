import { GoogleGenAI } from "@google/genai";
import { AttendanceRecord } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY; 

// Only initialize if key exists, otherwise let it fail gracefully when called
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateDailySummary = async (records: AttendanceRecord[], absentNames: string[] = []): Promise<string> => {
  if (!apiKey || !ai) {
    return "API Key Gemini tidak ditemukan atau tidak valid.";
  }

  const recordsJson = JSON.stringify(records.map(r => ({
    name: r.userName,
    time: new Date(r.timestamp).toLocaleTimeString(),
    type: r.type,
    status: r.status,
    isLate: r.isLate
  })));

  const absentInfo = absentNames.length > 0 
    ? `Daftar Nama Alpa (Tidak Hadir Tanpa Keterangan): ${absentNames.join(', ')}` 
    : "Tidak ada yang alpa hari ini.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Bertindaklah sebagai administrator SDM di Bapekom Wilayah VIII Makassar.
        Analisis data absensi mentah berikut ini untuk hari ini dan buatlah ringkasan laporan harian yang profesional dalam bahasa Indonesia.
        
        Data Absensi (Hadir):
        ${recordsJson}

        ${absentInfo}

        Format laporan harus mencakup:
        1. Ringkasan kehadiran (Total hadir, terlambat, dan alpa).
        2. Daftar nama yang terlambat (jika ada).
        3. Daftar nama yang Alpa/Bolos (Sangat Penting: sebutkan namanya jika ada).
        4. Anomali lokasi (status invalid) jika ada.
        5. Kesimpulan umum kedisiplinan hari ini.
        
        Gunakan nada formal, tegas untuk yang alpa, dan ringkas.
      `,
    });
    
    // STRICT extraction to avoid [object Object]
    // 1. Check for direct text property
    if (response.text && typeof response.text === 'string') {
      return response.text;
    }

    // 2. Fallback: Check candidates manually
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content?.parts;
      if (parts && parts.length > 0) {
        // Find first part with text
        const textPart = parts.find(p => p.text);
        if (textPart && typeof textPart.text === 'string') {
          return textPart.text;
        }
      }
    }

    return "Gagal menghasilkan ringkasan (Respon kosong atau format tidak sesuai).";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    // Ensure we return a string even on error object
    const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan tidak diketahui.";
    return `Terjadi kesalahan saat menghubungi layanan AI: ${errorMessage}`;
  }
};