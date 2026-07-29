import React from "react";
import { BookOpen } from "lucide-react";

const DeploymentGuide: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-2">
          <BookOpen className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-gray-800">Panduan Deployment J&T Express & Cargo</h2>
        </div>

        <div className="text-xs text-gray-600 space-y-3 leading-relaxed">
          <p>
            Aplikasi **J&T OPS PRO** ini telah didesain dengan arsitektur hibrida berkelas tinggi. Seluruh antarmuka dikodekan menggunakan **React 19** dan dikonfigurasi agar dapat dideploy ke **Google Apps Script** instan dengan performa tanpa cela.
          </p>

          <h3 className="font-bold text-gray-800 text-sm mt-4">Langkah 1: Setup Google Sheet</h3>
          <ol className="list-decimal pl-5 space-y-1.5 font-sans">
            <li>Buat Spreadsheet baru di Google Drive Anda.</li>
            <li>Buka Spreadsheet, lalu klik **Extensions** &gt; **Apps Script**.</li>
            <li>Hapus kode bawaan di dalam editor script.</li>
          </ol>

          <h3 className="font-bold text-gray-800 text-sm mt-4">Langkah 2: Tambahkan Backend Script (`Code.gs`)</h3>
          <p>
            Salin seluruh isi file <code className="bg-gray-100 px-1 font-mono text-red-700">Code.gs</code> yang telah dibuat di folder proyek Anda dan paste ke dalam file **Code.gs** di editor Google Apps Script Anda.
          </p>

          <h3 className="font-bold text-gray-800 text-sm mt-4">Langkah 3: Tambahkan Frontend (`Index.html`)</h3>
          <p>
            Di editor Apps Script, klik tombol tambah file (+) &gt; pilih **HTML**, beri nama <code className="bg-gray-100 px-1 font-mono">Index</code>. Salin isi file <code className="bg-gray-100 px-1 font-mono text-[#E4002B]">Index.html</code> dari proyek ini dan paste ke file tersebut.
          </p>

          <h3 className="font-bold text-gray-800 text-sm mt-4">Langkah 4: Konfigurasi API Key Gemini</h3>
          <p>
            Dapatkan API Key gratis untuk model Gemini di AI Studio. Di editor Apps Script Anda, buka **Project Settings** (ikon gir di sebelah kiri) &gt; **Script Properties** &gt; Tambahkan properti berikut:
          </p>
          <div className="bg-gray-900 text-white font-mono p-3 rounded-lg text-[11px] overflow-x-auto space-y-1">
            <p><span className="text-[#E4002B]">GEMINI_API_KEY</span> = [Kunci API Gemini Anda]</p>
            <p><span className="text-blue-400">DRIVE_FOLDER_ID</span> = [ID Folder Google Drive untuk upload foto - Opsional]</p>
          </div>

          <h3 className="font-bold text-gray-800 text-sm mt-4">Langkah 5: Publish / Deploy Aplikasi</h3>
          <ol className="list-decimal pl-5 space-y-1.5 font-sans">
            <li>Klik tombol **Deploy** di kanan atas &gt; pilih **New Deployment**.</li>
            <li>Pilih jenis deployment: **Web App**.</li>
            <li>Ubah **Execute as:** menjadi **Me (email Anda)**.</li>
            <li>Ubah **Who has access:** menjadi **Anyone** atau sesuaikan dengan outlet Anda.</li>
            <li>Klik **Deploy**, berikan izin akses Google Drive & Sheets ketika diminta.</li>
            <li>Salin **Web App URL** yang dihasilkan. Selamat! Aplikasi J&T OPS PRO Anda sudah bisa diakses online dari HP seluruh admin outlet.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DeploymentGuide;
