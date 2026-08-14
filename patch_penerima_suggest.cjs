const fs = require('fs');
let code = fs.readFileSync('src/components/PreInputPage.tsx', 'utf8');

// 1. Add states for Penerima Suggestion
const targetState = `  const [customerSuggestions, setCustomerSuggestions] = useState<MasterCustomer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);`;
const replaceState = `  const [customerSuggestions, setCustomerSuggestions] = useState<MasterCustomer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [penerimaSuggestions, setPenerimaSuggestions] = useState<any[]>([]);
  const [showPenerimaSuggestions, setShowPenerimaSuggestions] = useState(false);
  const [searchingPenerima, setSearchingPenerima] = useState(false);
  const penerimaSuggestionContainerRef = useRef<HTMLDivElement>(null);
  const namaPenerimaInputRef = useRef<HTMLInputElement>(null);`;
code = code.replace(targetState, replaceState);

// 2. Click outside logic for both
const targetClickOutside = `      if (suggestionContainerRef.current && !suggestionContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }`;
const replaceClickOutside = `      if (suggestionContainerRef.current && !suggestionContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (penerimaSuggestionContainerRef.current && !penerimaSuggestionContainerRef.current.contains(event.target as Node)) {
        setShowPenerimaSuggestions(false);
      }`;
code = code.replace(targetClickOutside, replaceClickOutside);

// 3. handlePenerimaChange and handleSelectPenerima
const targetSenderChange = `  const handleSenderChange = (val: string, type: "nama" | "hp" | "alamat") => {`;
const replaceSenderChange = `  const handlePenerimaChange = (val: string, type: "nama" | "hp" | "alamat") => {
    if (type === "nama") setNamaPenerima(val);
    if (type === "hp") setHpPenerima(val);
    if (type === "alamat") setAlamatPenerima(val);

    if (type === "nama" || type === "hp") {
      if (val.length >= 3) {
        setSearchingPenerima(true);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(async () => {
          try {
            const res = await callBackend("getBukuPenerima", { search: val });
            if (res && res.status === "success" && Array.isArray(res.data)) {
              setPenerimaSuggestions(res.data.slice(0, 10));
              setShowPenerimaSuggestions(true);
            }
          } finally {
            setSearchingPenerima(false);
          }
        }, 500);
      } else {
        setShowPenerimaSuggestions(false);
        setPenerimaSuggestions([]);
      }
    }
  };

  const handleSelectPenerima = (penerima: any) => {
    setNamaPenerima(penerima.nama || penerima.nama_penerima || "");
    setHpPenerima(penerima.telepon || penerima.no_hp || penerima.no_hp_penerima || "");
    setAlamatPenerima(penerima.alamat || penerima.alamat_penerima || "");
    setShowPenerimaSuggestions(false);
    
    // Focus next input or just unfocus
    setTimeout(() => {
      document.getElementById("input-nama-barang")?.focus();
    }, 100);
  };

  const handleSenderChange = (val: string, type: "nama" | "hp" | "alamat") => {`;
code = code.replace(targetSenderChange, replaceSenderChange);

// 4. Update the Nama Penerima input area
const targetPenerimaInput = `{/* Nama Penerima */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nama Penerima <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={namaPenerima}
                    onChange={(e) => setNamaPenerima(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                    placeholder="Silahkan masukan nama"
                  />
                </div>`;
const replacePenerimaInput = `{/* Nama Penerima + Suggestions */}
                <div className="relative" ref={penerimaSuggestionContainerRef}>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nama Penerima <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      ref={namaPenerimaInputRef}
                      type="text"
                      value={namaPenerima}
                      onChange={(e) => handlePenerimaChange(e.target.value, "nama")}
                      className="w-full pl-3 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                      placeholder="Silahkan masukan nama"
                    />
                    {searchingPenerima && (
                      <div className="absolute right-3 inset-y-0 flex items-center">
                        <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
                      </div>
                    )}
                  </div>
                  {showPenerimaSuggestions && penerimaSuggestions.length > 0 && (
                    <div className="absolute z-20 w-full bg-white border border-gray-200 mt-1 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-50">
                      {penerimaSuggestions.map((pen, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectPenerima(pen)}
                          className="px-3 py-2 hover:bg-red-50 cursor-pointer transition-colors"
                        >
                          <div className="font-bold text-gray-800 text-[13px]">{pen.nama || pen.nama_penerima}</div>
                          <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[#E4002B]">{pen.telepon || pen.no_hp || pen.no_hp_penerima}</span>
                            <span className="truncate flex-1">{pen.alamat || pen.alamat_penerima}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>`;
code = code.replace(targetPenerimaInput, replacePenerimaInput);

// 5. Update HP Penerima
const targetHpPenerima = `                {/* HP Penerima */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nomor HP Penerima <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={hpPenerima}
                    onChange={(e) => setHpPenerima(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 font-mono focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                    placeholder="Contoh: 08123456789"
                  />
                </div>`;
const replaceHpPenerima = `                {/* HP Penerima */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nomor HP Penerima <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={hpPenerima}
                    onChange={(e) => handlePenerimaChange(e.target.value, "hp")}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 font-mono focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                    placeholder="Contoh: 08123456789"
                  />
                </div>`;
code = code.replace(targetHpPenerima, replaceHpPenerima);

fs.writeFileSync('src/components/PreInputPage.tsx', code);
console.log("Penerima Suggestion patched");
