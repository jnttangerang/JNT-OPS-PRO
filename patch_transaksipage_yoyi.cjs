const fs = require("fs");
let code = fs.readFileSync("src/components/TransaksiPage.tsx", "utf8");

// Imports
code = code.replace(
  `import AddressBookDrawer from "./AddressBookDrawer";`,
  `import AddressBookDrawer from "./AddressBookDrawer";\nimport ImportYoYiModal, { YoYiImportQueueItem } from "./ImportYoYiModal";\nimport { Layers, Download, Check, RefreshCw } from "lucide-react";`
);

// State for YoYi
const yoyiState = `
  // YoYi Import State
  const [isYoYiModalOpen, setIsYoYiModalOpen] = useState(false);
  const [yoyiQueue, setYoyiQueue] = useState<YoYiImportQueueItem[]>([]);
  
  useEffect(() => {
    const saved = localStorage.getItem("yoyi_import_queue");
    if (saved) {
      try { setYoyiQueue(JSON.parse(saved)); } catch(e) {}
    }
  }, []);

  const updateYoyiQueue = (newQ: YoYiImportQueueItem[]) => {
    setYoyiQueue(newQ);
    localStorage.setItem("yoyi_import_queue", JSON.stringify(newQ));
  };

  const handleAddYoYiToQueue = (item: YoYiImportQueueItem) => {
    if (yoyiQueue.length >= 20) {
      toast.error("Antrian penuh. Simpan atau hapus transaksi terlebih dahulu.");
      return;
    }
    updateYoyiQueue([...yoyiQueue, item]);
  };

  const handleSaveYoYi = async (id: string) => {
    const item = yoyiQueue.find(q => q.queue_id === id);
    if (!item) return;
    
    // Update status to SAVING
    updateYoyiQueue(yoyiQueue.map(q => q.queue_id === id ? { ...q, status: "SAVING", error_message: undefined } : q));
    
    try {
      const res = await callBackend("importYoYi", { parsed: item.parsed_data, input: item.input_data });
      if (res.status === "success") {
        toast.success(\`YoYi \${item.resi} berhasil disimpan!\`);
        // Remove from queue
        updateYoyiQueue(yoyiQueue.filter(q => q.queue_id !== id));
      } else {
        throw new Error(res.message);
      }
    } catch (e: any) {
      updateYoyiQueue(yoyiQueue.map(q => q.queue_id === id ? { ...q, status: "FAILED", error_message: e.message } : q));
      toast.error(\`Gagal simpan YoYi \${item.resi}: \${e.message}\`);
    }
  };

  const handleSaveAllYoYi = async () => {
    const pending = yoyiQueue.filter(q => q.status !== "SUCCESS");
    if (pending.length === 0) return;
    
    let successCount = 0;
    let failCount = 0;
    
    // We update UI first to show all as saving if possible, but easier to do one by one or generic loading
    const currentQ = [...yoyiQueue];
    for (let i = 0; i < currentQ.length; i++) {
        if (currentQ[i].status === "SUCCESS") continue;
        currentQ[i].status = "SAVING";
    }
    updateYoyiQueue(currentQ);
    
    for (const item of pending) {
        try {
            const res = await callBackend("importYoYi", { parsed: item.parsed_data, input: item.input_data });
            if (res.status === "success") {
                successCount++;
                currentQ.find(q => q.queue_id === item.queue_id)!.status = "SUCCESS";
            } else {
                throw new Error(res.message);
            }
        } catch(e: any) {
            failCount++;
            const qItem = currentQ.find(q => q.queue_id === item.queue_id)!;
            qItem.status = "FAILED";
            qItem.error_message = e.message;
        }
        updateYoyiQueue([...currentQ]);
    }
    
    updateYoyiQueue(currentQ.filter(q => q.status !== "SUCCESS"));
    
    if (failCount === 0) {
        toast.success(\`Berhasil menyimpan \${successCount} transaksi YoYi!\`);
    } else {
        toast.warning(\`Berhasil: \${successCount} | Gagal: \${failCount}\`);
    }
  };
  
  const handleRemoveYoYi = (id: string) => {
    updateYoyiQueue(yoyiQueue.filter(q => q.queue_id !== id));
  };
`;

code = code.replace(
  `// Draft Queue State`,
  yoyiState + `\n  // Draft Queue State`
);

// Add button to header
const headerBtn = `
          {/* LOKASI TUGAS OVERRIDE */}
          <div className="flex gap-2 items-center">
            <button 
              onClick={() => setIsYoYiModalOpen(true)}
              className="bg-white border border-[#E4002B] text-[#E4002B] hover:bg-red-50 text-xs px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" /> Import YoYi
            </button>
`;

code = code.replace(
  `{/* LOKASI TUGAS OVERRIDE */}\n          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col gap-1 sm:min-w-[240px]">`,
  headerBtn + `\n          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col gap-1 sm:min-w-[240px]">`
);

// Add Sidebar UI for YoYi
const yoyiSidebar = `
          {/* YOYI IMPORT QUEUE */}
          {yoyiQueue.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-orange-100 p-1.5 rounded-lg text-orange-600"><Layers className="w-4 h-4" /></div>
                  <h3 className="font-bold text-sm text-gray-800">Antrian YoYi ({yoyiQueue.length})</h3>
                </div>
                <button onClick={handleSaveAllYoYi} className="text-[10px] bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded font-bold">Simpan Semua</button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {yoyiQueue.map(q => (
                  <div key={q.queue_id} className={\`p-2 border rounded-xl text-xs flex flex-col gap-1 \${q.status === "FAILED" ? "bg-red-50 border-red-200" : "bg-orange-50/50 border-orange-100"}\`}>
                    <div className="flex justify-between font-bold text-gray-700">
                      <span>{q.resi}</span>
                      <span className="text-[#E4002B]">Rp {q.input_data.jumlah_dibayar.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 flex justify-between">
                      <span className="truncate w-32">{q.parsed_data.nama_penerima}</span>
                      <span>{q.status}</span>
                    </div>
                    {q.status === "FAILED" && <div className="text-[9px] text-red-600">{q.error_message}</div>}
                    <div className="flex justify-end gap-2 mt-1">
                      <button onClick={() => handleRemoveYoYi(q.queue_id)} className="text-[10px] text-gray-400 hover:text-red-500 font-medium">Hapus</button>
                      <button onClick={() => handleSaveYoYi(q.queue_id)} disabled={q.status === "SAVING"} className="text-[10px] bg-white border border-gray-200 hover:bg-gray-50 px-2 py-0.5 rounded font-bold disabled:opacity-50">
                        {q.status === "SAVING" ? "Menyimpan..." : "Simpan"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
`;

code = code.replace(
  `{/* DRAFT QUEUE SIDEBAR */}`,
  yoyiSidebar + `\n        {/* DRAFT QUEUE SIDEBAR */}`
);

// Add Modal component near bottom
code = code.replace(
  `</LayoutSwitcher>`,
  `</LayoutSwitcher>\n      <ImportYoYiModal \n        isOpen={isYoYiModalOpen} \n        onClose={() => setIsYoYiModalOpen(false)} \n        activeOutletId={activeOutletId} \n        adminId={session?.user?.id || session?.user?.username || ""} \n        onAddedToQueue={handleAddYoYiToQueue} \n      />`
);

fs.writeFileSync("src/components/TransaksiPage.tsx", code);
console.log("TransaksiPage patched with YoYi UI");
