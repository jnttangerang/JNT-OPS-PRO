const fs = require("fs");
let code = fs.readFileSync("src/components/TransaksiPage.tsx", "utf8");

if (!code.includes("handlePasteImage")) {
  const pasteLogic = `
  const handlePasteImage = (e: React.ClipboardEvent, type: "paket" | "resi") => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const previewUrl = URL.createObjectURL(file);
          if (type === "paket") {
            if (fotoPaketPreview) URL.revokeObjectURL(fotoPaketPreview);
            setFotoPaketBlob(file);
            setFotoPaketPreview(previewUrl);
            setFotoPaketUrl("");
            toast.success("Gambar paket dipaste dari clipboard");
          } else {
            if (fotoResiPreview) URL.revokeObjectURL(fotoResiPreview);
            setFotoResiBlob(file);
            setFotoResiPreview(previewUrl);
            setFotoResiUrl("");
            toast.success("Gambar resi dipaste dari clipboard");
          }
        }
        break;
      }
    }
  };
`;

  code = code.replace(`  const handleFileSelect = (`, pasteLogic + `\n  const handleFileSelect = (`);
  
  // Attach onPaste to CARD FOTO PAKET and CARD FOTO RESI
  code = code.replace(
    `{/* CARD FOTO PAKET */}\n                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">`,
    `{/* CARD FOTO PAKET */}\n                    <div \n                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 focus-within:ring-2 focus-within:ring-[#E4002B]/30 outline-none"\n                      onPaste={(e) => handlePasteImage(e, "paket")}\n                      tabIndex={0}\n                    >`
  );

  code = code.replace(
    `{/* CARD FOTO RESI */}\n                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">`,
    `{/* CARD FOTO RESI */}\n                    <div \n                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 focus-within:ring-2 focus-within:ring-[#E4002B]/30 outline-none"\n                      onPaste={(e) => handlePasteImage(e, "resi")}\n                      tabIndex={0}\n                    >`
  );
  
  fs.writeFileSync("src/components/TransaksiPage.tsx", code);
  console.log("Image paste patched in TransaksiPage.tsx");
}
