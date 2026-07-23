import fs from 'fs';
let rtCode = fs.readFileSync('src/components/RiwayatTransaksiPage.tsx', 'utf-8');

const effect = `  useEffect(() => {
    if (session.role !== "OWNER" && activeOutletId) {
      setFilterOutlet(activeOutletId);
    }
  }, [activeOutletId, session.role]);
`;

rtCode = rtCode.replace(
  '  const [searchTerm, setSearchTerm] = useState("");',
  '  const [searchTerm, setSearchTerm] = useState("");\n' + effect
);

fs.writeFileSync('src/components/RiwayatTransaksiPage.tsx', rtCode);
