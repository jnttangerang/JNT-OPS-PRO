const fs = require("fs");
let code = fs.readFileSync("src/components/TransaksiPage.tsx", "utf8");

code = code.replace(
  `<button 
              onClick={() => setIsYoYiModalOpen(true)}
              className="bg-white border border-[#E4002B] text-[#E4002B] hover:bg-red-50 text-xs px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >`,
  `<button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setIsYoYiModalOpen(true);
                console.log("Import YoYi clicked");
              }}
              className="relative z-20 bg-white border border-[#E4002B] text-[#E4002B] hover:bg-red-50 text-xs px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >`
);

fs.writeFileSync("src/components/TransaksiPage.tsx", code);
console.log("Button patched");
