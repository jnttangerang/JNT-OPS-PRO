const fs = require('fs');
let code = fs.readFileSync('src/components/PreInputPage.tsx', 'utf8');

// 1. Remove Auto-Save effect
code = code.replace(/\/\/ Auto-Save Effect \(Debounced 800ms\)[\s\S]*?}, \[[\s\S]*?\]\);/, '');

// 2. Add Tab & Pagination states
const stateAdds = `  const [activeBoardTab, setActiveBoardTab] = useState<"DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI">("DRAFT");
  const [boardPage, setBoardPage] = useState(1);
  const [boardLimit, setBoardLimit] = useState(10);
  const [users, setUsers] = useState<any[]>([]);`;
  
code = code.replace(/const \[autoSaveStatus, setAutoSaveStatus\] = useState<string \| null>\(null\);/, 
  `const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);\n` + stateAdds);

// 3. Fetch users
const fetchUsersAdd = `      const draftsRes = await callBackend("getPreInputDrafts");
      if (draftsRes && draftsRes.status === "success" && Array.isArray(draftsRes.data)) {
        setDrafts(draftsRes.data);
      }
      const usersRes = await callBackend("getUsers");
      if (usersRes && usersRes.status === "success" && Array.isArray(usersRes.data)) {
        setUsers(usersRes.data);
      }`;
code = code.replace(/const draftsRes = await callBackend\("getPreInputDrafts"\);\s*if \(draftsRes && draftsRes\.status === "success" && Array\.isArray\(draftsRes\.data\)\) \{\s*setDrafts\(draftsRes\.data\);\s*\}/, fetchUsersAdd);

fs.writeFileSync('src/components/PreInputPage.tsx.temp', code);
console.log("temp created");
