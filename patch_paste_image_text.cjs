const fs = require("fs");
let code = fs.readFileSync("src/components/TransaksiPage.tsx", "utf8");

code = code.replace(
  `Foto Fisik Paket</span>`,
  `Foto Fisik Paket <span className="font-normal text-[9px] text-gray-500 ml-1">(Klik area ini lalu Ctrl+V untuk Paste)</span></span>`
);

code = code.replace(
  `Foto Resi Pada Paket</span>`,
  `Foto Resi Pada Paket <span className="font-normal text-[9px] text-gray-500 ml-1">(Klik area ini lalu Ctrl+V untuk Paste)</span></span>`
);

fs.writeFileSync("src/components/TransaksiPage.tsx", code);
console.log("Image paste UX text patched in TransaksiPage.tsx");
