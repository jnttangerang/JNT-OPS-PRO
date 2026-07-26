const fs = require('fs');
let code = fs.readFileSync('src/components/owner/OwnerAuditPage.tsx', 'utf8');

const importRegex = /import React, \{ useState, useEffect \} from "react";/;
const importReplacement = `import React, { useState, useEffect } from "react";`;

code = code.replace(importRegex, importReplacement);

const stateInsertIdx = code.indexOf('const [selectedTx, setSelectedTx] = useState<any>(null);');
if (stateInsertIdx !== -1) {
  const insertStr = `
  const [auditNote, setAuditNote] = useState("");
  const [savingAudit, setSavingAudit] = useState(false);
`;
  code = code.slice(0, stateInsertIdx) + 'const [selectedTx, setSelectedTx] = useState<any>(null);' + insertStr + code.slice(stateInsertIdx + 56);
}

const funcInsertIdx = code.indexOf('const getStatusBadge =');
if (funcInsertIdx !== -1) {
  const funcStr = `
  const handleSaveAudit = async (status: string) => {
    if (!selectedTx) return;
    setSavingAudit(true);
    try {
      const res = await callBackend("updateAuditDecision", {
        resi_id: selectedTx.resi_id,
        audit_status: status,
        audit_note: auditNote,
        owner_id: session.user_id
      });
      if (res.status === "success") {
        toast.success("Keputusan audit disimpan");
        
        // update local list instead of full refetch if we want, or just refetch
        await fetchAuditData();
        
        setSelectedTx(null);
        setAuditNote("");
      } else {
        toast.error(res.message || "Gagal menyimpan");
      }
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan");
    } finally {
      setSavingAudit(false);
    }
  };
`;
  code = code.slice(0, funcInsertIdx) + funcStr + code.slice(funcInsertIdx);
}

// Reset auditNote when selectedTx changes
const selectTxRegex = /setSelectedTx\(tx\)/g;
code = code.replace(selectTxRegex, '() => { setSelectedTx(tx); setAuditNote(tx.audit_note || ""); }()');
// wait, the button onClick is `onClick={() => setSelectedTx(tx)}`, replacing to `onClick={() => { setSelectedTx(tx); setAuditNote(tx.audit_note || ""); }}`
code = code.replace(/onClick=\{\(\) => setSelectedTx\(tx\)\}/g, 'onClick={() => { setSelectedTx(tx); setAuditNote(tx.audit_note || ""); }}');

// Update Drawer to show owner decision actions
const drawerCloseRegex = /<div className="p-4 border-t border-gray-100 bg-white">/;
const drawerReplacement = `
          {/* Audit Actions */}
          <div className="bg-white p-5 border-t border-gray-100 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Catatan Audit (Opsional)</label>
              <textarea 
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                rows={2}
                placeholder="Tambahkan catatan khusus..."
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50"
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleSaveAudit("PERLU_REVIEW")}
                disabled={savingAudit}
                className="flex-1 py-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-bold rounded-xl text-xs transition-colors border border-yellow-200 disabled:opacity-50"
              >
                {savingAudit ? "..." : "PERLU REVIEW"}
              </button>
              <button 
                onClick={() => handleSaveAudit("SESUAI")}
                disabled={savingAudit}
                className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition-colors border border-emerald-200 disabled:opacity-50"
              >
                {savingAudit ? "..." : "SESUAI"}
              </button>
            </div>
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">`;

code = code.replace(drawerCloseRegex, drawerReplacement);

fs.writeFileSync('src/components/owner/OwnerAuditPage.tsx', code);
console.log("Patched OwnerAuditPage.tsx with decision actions");
