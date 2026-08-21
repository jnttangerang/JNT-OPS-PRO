const fs = require('fs');
let code = fs.readFileSync('src/components/TransaksiPage.tsx', 'utf8');

const buktiPasteCode = `
  const handlePasteBukti = async (e: React.ClipboardEvent, isSurchargeProof: boolean) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const formattedDate = new Date().toISOString().split("T")[0].replace(/-/g, "");
          const finalResiStr = (resiId || "").trim() || "MOCK_RESI";
          
          let generatedFileName = "";
          if (isSurchargeProof) {
            generatedFileName = \`BB-ADD_\${formattedDate}_\${finalResiStr}\`;
          } else {
            generatedFileName = \`BB-\${jenisLayanan === "Express" ? "YoYi" : "JTC"}_\${formattedDate}_\${finalResiStr}\`;
          }

          if (isSurchargeProof) {
            setUploadingBuktiTambahan(true);
          } else {
            setUploadingBukti(true);
          }
          setFormError(null);

          try {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Str = reader.result as string;
              try {
                const response = await callBackend("uploadFile", {
                  fileBase64: base64Str,
                  fileName: generatedFileName,
                  category: isSurchargeProof ? "BUKTI_ADD" : "BUKTI_BAYAR"
                });

                if (response.status === "success" && response.data) {
                  if (isSurchargeProof) {
                    setBuktiTambahanUrl(response.data);
                  } else {
                    setBuktiBayarUrl(response.data);
                  }
                  toast.success(isSurchargeProof ? "Bukti tambahan berhasil di-paste" : "Bukti transfer berhasil di-paste");
                } else {
                  setFormError(response.message || "Gagal mengunggah bukti bayar dari clipboard.");
                }
              } catch (err: any) {
                setFormError(err.message || "Gagal mengunggah bukti bayar dari clipboard.");
              } finally {
                if (isSurchargeProof) setUploadingBuktiTambahan(false);
                else setUploadingBukti(false);
              }
            };
            reader.readAsDataURL(file);
          } catch (err: any) {
            if (isSurchargeProof) setUploadingBuktiTambahan(false);
            else setUploadingBukti(false);
            setFormError(err.message || "Gagal memproses gambar bukti bayar");
          }
        }
        break;
      }
    }
  };
`;

code = code.replace("  // Clear errors", buktiPasteCode + "\n  // Clear errors");

// Bukti Transfer main
const targetBuktiTransfer = `                  {metodeBayar !== "Tunai" && metodeBayar !== "DFOD" && (
                    <div className="bg-red-50/40 p-3.5 rounded-xl border border-red-100/50 space-y-2.5 animate-fade-in">`;
const replacementBuktiTransfer = `                  {metodeBayar !== "Tunai" && metodeBayar !== "DFOD" && (
                    <div 
                      className="bg-red-50/40 p-3.5 rounded-xl border border-red-100/50 space-y-2.5 animate-fade-in focus-within:ring-2 focus-within:ring-[#E4002B]/30 outline-none"
                      onPaste={(e) => handlePasteBukti(e, false)}
                      tabIndex={0}
                    >`;

code = code.replace(targetBuktiTransfer, replacementBuktiTransfer);

const targetBuktiTransferSpan = `<span className="text-[11px] font-bold text-red-800">
                          Wajib Upload Bukti {metodeBayar}
                        </span>`;
const replacementBuktiTransferSpan = `<span className="text-[11px] font-bold text-red-800 flex flex-col sm:flex-row gap-1">
                          <span>Wajib Upload Bukti {metodeBayar}</span>
                          <span className="font-normal text-[9px] text-red-600 sm:ml-1">(Klik area ini lalu Ctrl+V untuk Paste)</span>
                        </span>`;

code = code.replace(targetBuktiTransferSpan, replacementBuktiTransferSpan);


// Bukti Tambahan
const targetBuktiTambahan = `                      {metodeBayarTambahan !== "Tunai" && (
                        <div className="bg-red-50/40 p-3 rounded-xl border border-red-100/50 space-y-2">`;
const replacementBuktiTambahan = `                      {metodeBayarTambahan !== "Tunai" && (
                        <div 
                          className="bg-red-50/40 p-3 rounded-xl border border-red-100/50 space-y-2 focus-within:ring-2 focus-within:ring-[#E4002B]/30 outline-none"
                          onPaste={(e) => handlePasteBukti(e, true)}
                          tabIndex={0}
                        >`;

code = code.replace(targetBuktiTambahan, replacementBuktiTambahan);

const targetBuktiTambahanSpan = `<span className="text-[11px] font-bold text-red-800">Bukti Tambahan</span>`;
const replacementBuktiTambahanSpan = `<span className="text-[11px] font-bold text-red-800 flex flex-col sm:flex-row gap-1">
                              <span>Bukti Tambahan</span>
                              <span className="font-normal text-[9px] text-red-600 sm:ml-1">(Ctrl+V Paste)</span>
                            </span>`;
code = code.replace(targetBuktiTambahanSpan, replacementBuktiTambahanSpan);

fs.writeFileSync('src/components/TransaksiPage.tsx', code);
