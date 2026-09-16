const fs = require('fs');

let code = fs.readFileSync('src/components/admin/LengkapiYoYiPage.tsx', 'utf8');

// Fix YoYiInlineRow useAppsScript
code = code.replace(
  'const { callBackend, uploadFile } = useAppsScript();',
  '// no useAppsScript needed here anymore, or just keep it empty if unused'
);

// We need a helper for file uploads since we replaced it with uploadFile.
// Let's replace the `handleFileUpload` inside YoYiInlineRow to use fetch.
code = code.replace(
  /const handleFileUpload = async \(file: File, setter: \(url: string\) => void\) => \{[\s\S]*?\}\s*catch \(e\) \{[\s\S]*?\}\s*\};/,
  `const handleFileUpload = async (file: File, setter: (url: string) => void) => {
     if (!file) return;
     const formData = new FormData();
     formData.append("file", file);
     try {
        const resData = await fetch("/api/upload", { method: "POST", body: formData });
        const res = await resData.json();
        if (res.status === 'success' && res.url) {
           setter(res.url);
        }
     } catch (e) {
        alert("Upload gagal");
     }
  };`
);

// Fix InlineSetoranModal signature
code = code.replace(
  'function InlineSetoranModal({\n  callBackend, uploadFile,',
  'function InlineSetoranModal({'
);
code = code.replace(
  '<InlineSetoranModal callBackend={callBackend} uploadFile={uploadFile}',
  '<InlineSetoranModal '
);

// Fix handleUpload in InlineSetoranModal to use fetch
code = code.replace(
  /const handleUpload = async \(file: File\) => \{[\s\S]*?\}\s*catch \(e\) \{[\s\S]*?\}\s*\};/,
  `const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const resData = await fetch("/api/upload", { method: "POST", body: formData });
      const res = await resData.json();
      if (res.status === 'success' && res.url) {
        setBuktiTransferUrl(res.url);
      }
    } catch (e) {
      alert("Upload gagal");
    }
  };`
);

// Also need to use fetch instead of callBackend for `/api/createSetoran` in InlineSetoranModal
code = code.replace(
  /const res = await callBackend\("createSetoran", \{/g,
  `const resData = await fetch("/api/createSetoran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({`
);
code = code.replace(
  /bukti_url: buktiTransferUrl\n      \}\);/g,
  `bukti_url: buktiTransferUrl\n      })});
      const res = await resData.json();`
);


fs.writeFileSync('src/components/admin/LengkapiYoYiPage.tsx', code);
console.log("Fixed fetch uploads");
