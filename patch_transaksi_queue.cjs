const fs = require("fs");
let code = fs.readFileSync("src/components/TransaksiPage.tsx", "utf8");

const yoyiSidebar = `
      {/* YOYI IMPORT QUEUE */}
      {yoyiQueue.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-orange-100 p-1.5 rounded-lg text-orange-600"><Layers className="w-4 h-4" /></div>
              <h3 className="font-bold text-sm text-gray-800">Antrian YoYi ({yoyiQueue.length})</h3>
            </div>
            <button onClick={handleSaveAllYoYi} className="text-[10px] bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded font-bold">Simpan Semua</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
            {yoyiQueue.map(q => (
              <div key={q.queue_id} className={\`p-3 border rounded-xl text-xs flex flex-col gap-1 \${q.status === "FAILED" ? "bg-red-50 border-red-200" : "bg-orange-50/50 border-orange-100"}\`}>
                <div className="flex justify-between font-bold text-gray-700">
                  <span>{q.resi}</span>
                  <span className="text-[#E4002B]">Rp {q.input_data.jumlah_dibayar.toLocaleString("id-ID")}</span>
                </div>
                <div className="text-[10px] text-gray-500 flex justify-between">
                  <span className="truncate w-32">{q.parsed_data.nama_penerima}</span>
                  <span>{q.status}</span>
                </div>
                {q.status === "FAILED" && <div className="text-[9px] text-red-600">{q.error_message}</div>}
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => handleRemoveYoYi(q.queue_id)} className="text-[10px] text-gray-400 hover:text-red-500 font-medium">Hapus</button>
                  <button onClick={() => handleSaveYoYi(q.queue_id)} disabled={q.status === "SAVING" || q.status === "SUCCESS"} className="text-[10px] bg-white border border-gray-200 hover:bg-gray-50 px-2 py-1 rounded font-bold disabled:opacity-50 shadow-sm">
                    {q.status === "SAVING" ? "Menyimpan..." : q.status === "SUCCESS" ? "Tersimpan" : "Simpan"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
`;

if (!code.includes("YOYI IMPORT QUEUE")) {
  code = code.replace(
    `      {formError && (`,
    yoyiSidebar + `\n      {formError && (`
  );
  fs.writeFileSync("src/components/TransaksiPage.tsx", code);
  console.log("YoYi Queue UI added to TransaksiPage");
} else {
  console.log("YoYi Queue UI already exists!");
}
