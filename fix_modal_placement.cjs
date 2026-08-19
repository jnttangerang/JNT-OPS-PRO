const fs = require("fs");
let code = fs.readFileSync("src/components/TransaksiPage.tsx", "utf8");

// Insert the modal before the final </div>  );
const modalJSX = `
      <ImportYoYiModal 
        isOpen={isYoYiModalOpen} 
        onClose={() => setIsYoYiModalOpen(false)} 
        activeOutletId={activeOutletId} 
        adminId={session?.user?.id || session?.user?.username || ""} 
        onAddedToQueue={handleAddYoYiToQueue} 
      />
    </div>
  );
`;

code = code.replace(
  /    <\/div>\s*  \);\s*}\s*$/,
  modalJSX + `}`
);

fs.writeFileSync("src/components/TransaksiPage.tsx", code);
console.log("Modal placement fixed");
