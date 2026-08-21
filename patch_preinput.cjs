const fs = require('fs');
let code = fs.readFileSync('src/components/PreInputPage.tsx', 'utf8');

const pasteCode = `
  const handlePasteImage = async (e: React.ClipboardEvent, type: "paket") => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setUploadingFotoPaket(true);
          setFormError(null);
          try {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Str = reader.result as string;
              try {
                const response = await callBackend("uploadFile", {
                  fileBase64: base64Str,
                  fileName: file.name || "pasted-image.png",
                  category: "FOTO_PAKET"
                });
                const remoteUrl = (response && response.status === "success" && response.data) ? response.data : base64Str;
                setValidationPopupData({
                  type: "paket",
                  previewUrl: base64Str,
                  remoteUrl: remoteUrl,
                  detectedResiId: null
                });
                setShowValidationPopup(true);
              } catch (err: any) {
                setValidationPopupData({
                  type: "paket",
                  previewUrl: base64Str,
                  remoteUrl: base64Str,
                  detectedResiId: null
                });
                setShowValidationPopup(true);
              } finally {
                setUploadingFotoPaket(false);
              }
            };
            reader.readAsDataURL(file);
          } catch (err: any) {
            setUploadingFotoPaket(false);
            setFormError(err.message || "Gagal memproses gambar dari clipboard");
          }
        }
        break;
      }
    }
  };
`;

code = code.replace("// Upload Photo Handlers", "// Upload Photo Handlers\n" + pasteCode);

const divTarget = `                {/* Camera Upload */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">`;
                
const divReplacement = `                {/* Camera Upload */}
                <div 
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 focus-within:ring-2 focus-within:ring-[#E4002B]/30 outline-none"
                  onPaste={(e) => handlePasteImage(e, "paket")}
                  tabIndex={0}
                >`;

code = code.replace(divTarget, divReplacement);

const spanTarget = `<span>Foto Fisik Paket</span>`;
const spanReplacement = `<span className="uppercase tracking-wider">Foto Fisik Paket <span className="font-normal text-[9px] text-gray-500 ml-1">(Klik area ini lalu Ctrl+V untuk Paste)</span></span>`;

code = code.replace(spanTarget, spanReplacement);

fs.writeFileSync('src/components/PreInputPage.tsx', code);
