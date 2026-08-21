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

code = code.replace("const handlePasteImage =", buktiPasteCode + "\n\n  const handlePasteImage =");

fs.writeFileSync('src/components/TransaksiPage.tsx', code);
