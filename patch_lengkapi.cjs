const fs = require('fs');

let code = fs.readFileSync('src/components/admin/LengkapiYoYiPage.tsx', 'utf8');

// replace DailyClosingSetoranModal with an inline implementation
code = code.replace(
  "import DailyClosingSetoranModal from '../DailyClosingSetoranModal';",
  "import { DollarSign, Loader2, Check } from 'lucide-react';"
);

const modalImpl = `
function InlineSetoranModal({
  isOpen, onClose, targetDate, expectedCash, outletCash,
  adminId, adminName, activeOutletId, activeOutletName, onSuccess
}: any) {
  const [nominalSetorInput, setNominalSetorInput] = React.useState(expectedCash);
  const [metodeSetoran, setMetodeSetoran] = React.useState("TUNAI");
  const [buktiTransferUrl, setBuktiTransferUrl] = React.useState("");
  const [setoranNotes, setSetoranNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (metodeSetoran === "TRANSFER" && !buktiTransferUrl) {
      alert("Bukti transfer wajib diunggah.");
      return;
    }
    if (metodeSetoran === "KAS_OUTLET" && nominalSetorInput > outletCash) {
      alert("Nominal melebihi sisa kas operasional.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await callBackend("post", "/api/createSetoran", {
        outlet_id: activeOutletId,
        tanggal: targetDate,
        admin_id: adminId,
        nominal_setor: Number(nominalSetorInput),
        actual_cash: Number(nominalSetorInput),
        catatan: setoranNotes,
        metode_setor: metodeSetoran,
        bukti_url: buktiTransferUrl
      });
      if (res.status === "success") {
        onSuccess();
      } else {
        alert("Gagal setoran: " + res.message);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await callBackend("post", "/api/upload", formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      if (res.status === 'success' && res.url) {
        setBuktiTransferUrl(res.url);
      }
    } catch (e) {
      alert("Upload gagal");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-gray-800 text-sm">Buat Setoran (YoYi)</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Metode Setoran</label>
            <select value={metodeSetoran} onChange={e => setMetodeSetoran(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-emerald-500/20 focus:border-emerald-500 bg-gray-50">
              <option value="TUNAI">Tunai Fisik</option>
              <option value="TRANSFER">Transfer Bank</option>
              <option value="KAS_OUTLET">Tahan Kas Operasional</option>
            </select>
          </div>
          <div>
             <label className="block text-xs font-bold text-gray-700 mb-1">Nominal Setoran</label>
             <input type="number" value={nominalSetorInput} onChange={e => setNominalSetorInput(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-emerald-500/20 focus:border-emerald-500 bg-gray-50" />
          </div>
          {metodeSetoran === "TRANSFER" && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Bukti Transfer</label>
              {buktiTransferUrl ? (
                <div className="text-xs text-blue-600 truncate"><a href={buktiTransferUrl} target="_blank">Lihat Bukti</a> <button onClick={() => setBuktiTransferUrl("")} className="text-red-500 ml-2">X</button></div>
              ) : (
                <input type="file" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} className="text-xs w-full" />
              )}
            </div>
          )}
          <div>
             <label className="block text-xs font-bold text-gray-700 mb-1">Catatan</label>
             <textarea value={setoranNotes} onChange={e => setSetoranNotes(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-emerald-500/20 focus:border-emerald-500 bg-gray-50" />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
           <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-xs font-bold text-gray-600 rounded-lg hover:bg-gray-200">Batal</button>
           <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1">
             {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Simpan Setoran
           </button>
        </div>
      </div>
    </div>
  );
}
`;

code = code.replace(
  '<DailyClosingSetoranModal',
  '<InlineSetoranModal'
);

code = code.replace(
  '        />\n      )}',
  '        />\n      )}\n'
);

code += "\n\n" + modalImpl;

fs.writeFileSync('src/components/admin/LengkapiYoYiPage.tsx', code);
console.log("Patched LengkapiYoYiPage.tsx successfully");
