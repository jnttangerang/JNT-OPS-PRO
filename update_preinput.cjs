const fs = require('fs');
let code = fs.readFileSync('src/components/PreInputPage.tsx', 'utf8');

// 1. Remove Auto-save effect
code = code.replace(/\/\/ Auto-Save Effect \(Debounced 800ms\)[\s\S]*?}, \[[\s\S]*?\]\);/, '');

// 2. Insert States & Functions
const insertPoint = code.indexOf('const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);');
if (insertPoint !== -1) {
  const newStates = `const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);
  const [activeBoardTab, setActiveBoardTab] = useState("DRAFT");
  const [boardPage, setBoardPage] = useState(1);
  const [boardLimit, setBoardLimit] = useState(10);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const res = await callBackend("getUsers");
      if (res && res.status === "success" && Array.isArray(res.data)) setUsers(res.data);
    };
    fetchUsers();
  }, [callBackend]);

  const handleSimpanDraftManual = async () => {
    setFormError(null);
    try {
      const calc = calcWeight();
      const payload = {
        transaksi_id: editingTxId,
        is_draft: true,
        status: "Draft",
        admin_id: session.user_id,
        outlet_id_tugas: activeOutletId,
        nama_pengirim: String(namaPengirim || "").trim(),
        hp_pengirim: String(hpPengirim || "").trim(),
        alamat_pengirim: String(alamatPengirim || "").trim(),
        nama_penerima: String(namaPenerima || "").trim(),
        hp_penerima: String(hpPenerima || "").trim(),
        alamat_penerima: String(alamatPenerima || "").trim(),
        alamat_penerima_asli: alamatPenerimaAsli || String(alamatPenerima || "").trim(),
        catatan_admin: String(catatanAdmin || "").trim(),
        nama_barang: String(namaBarang || "").trim(),
        ekspedisi,
        berat_timbangan: Number(beratKg) || 0,
        panjang_cm: Number(volP) || 0,
        lebar_cm: Number(volL) || 0,
        tinggi_cm: Number(volT) || 0,
        berat_volume: calc.berat_volume,
        dasar_berat: calc.dasar_berat,
        berat_kg: calc.berat_penagihan,
        volume: \`\${volP || 0} x \${volL || 0} x \${volT || 0}\`,
        nilai_barang: getCleanNumberValue(nilaiBarangRaw || ""),
        foto_paket_url: fotoPaketUrl || "",
        foto_resi_url: fotoResiUrl || ""
      };
      
      setAutoSaveStatus("Menyimpan draft...");
      const res = await callBackend("saveDataPreInput", payload);
      if (res && res.status === "success" && res.data) {
        const txId = res.data.transaksi_id;
        if (!editingTxId) setEditingTxId(txId);
        localStorage.setItem("active_draft_tx_id", txId);
        setAutoSaveStatus(\`Draft Tersimpan \${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}\`);
        
        const draftsRes = await callBackend("getPreInputDrafts");
        if (draftsRes && draftsRes.status === "success" && Array.isArray(draftsRes.data)) {
          setDrafts(draftsRes.data);
        }
      }
    } catch (e) {
      console.error("Manual save failed:", e);
      setAutoSaveStatus("Gagal menyimpan draft");
    }
  };

  const handleHapusDraft = async (txId: string) => {
    if (!window.confirm(\`Yakin ingin menghapus draft \${txId}? Data ini tidak dapat dipulihkan.\`)) return;
    
    try {
      const res = await callBackend("deletePreInputDraft", { transaksi_id: txId });
      if (res && res.status === "success") {
        if (editingTxId === txId) handleDraftBaru();
        const draftsRes = await callBackend("getPreInputDrafts");
        if (draftsRes && draftsRes.status === "success" && Array.isArray(draftsRes.data)) {
          setDrafts(draftsRes.data);
        }
      } else {
        alert("Gagal menghapus draft: " + (res?.message || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan saat menghapus draft");
    }
  };
`;
  code = code.substring(0, insertPoint) + newStates + code.substring(insertPoint + 'const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);'.length);
}

// 3. Fix Shortcuts to use handleSimpanDraftManual instead of auto-save status text
code = code.replace(/handleSavePreInput\(false\);\s*\/\/ Ctrl \+ S/g, 'handleSimpanDraftManual();');
code = code.replace(/else if \(\(e.ctrlKey \|\| e.metaKey\) && e.key.toLowerCase\(\) === "s"\) \{\s*e.preventDefault\(\);\s*handleSavePreInput\(false\);\s*\}/g, 
  `else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSimpanDraftManual();
      }`);

fs.writeFileSync('src/components/PreInputPage.tsx', code);
console.log("PreInputPage states and functions injected");
