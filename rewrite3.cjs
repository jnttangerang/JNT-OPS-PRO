const fs = require('fs');
let content = fs.readFileSync('src/components/customer/ImportCustomerPage.tsx', 'utf-8');

const actionHeaderTarget = `{/* Action Header */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama atau nomor HP..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
              />
            </div>
            
            <button
              onClick={() => setShowConfirmModal(true)}
              className="w-full md:w-auto bg-[#E4002B] hover:bg-red-700 text-white font-bold px-8 py-2.5 rounded-xl shadow-sm text-sm transition-all flex items-center justify-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Import Customer
            </button>
          </div>`;

const actionHeaderReplacement = `{/* Action Header */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama, no HP, outlet..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E4002B] outline-none transition-all"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full md:w-auto bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-[#E4002B] outline-none transition-all"
              >
                <option value="ALL">Semua Status</option>
                <option value="NEW">NEW</option>
                <option value="UPDATE">UPDATE</option>
              </select>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="w-full md:w-auto bg-orange-100 text-orange-700 hover:bg-orange-200 font-bold px-4 py-2 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus ({selectedIds.size})
                </button>
              )}
            </div>
            
            <button
              onClick={() => setShowConfirmModal(true)}
              className="w-full md:w-auto bg-[#E4002B] hover:bg-red-700 text-white font-bold px-8 py-2.5 rounded-xl shadow-sm text-sm transition-all flex items-center justify-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Import Customer
            </button>
          </div>`;

if (content.includes(actionHeaderTarget)) {
  content = content.replace(actionHeaderTarget, actionHeaderReplacement);
} else {
  console.log("Could not find action header");
}

const tableTarget = `{/* Table */}
          <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-100">
                    <th className="p-4 font-bold">No</th>
                    <th className="p-4 font-bold">Status</th>
                    <th className="p-4 font-bold">Nama Pengirim</th>
                    <th className="p-4 font-bold">No HP</th>
                    <th className="p-4 font-bold">Nama Penerima</th>
                    <th className="p-4 font-bold">No HP</th>
                    <th className="p-4 font-bold">Alamat</th>
                    <th className="p-4 font-bold">Outlet Asal</th>
                    <th className="p-4 font-bold">Aksi</th>
                  </tr>
                </thead>`;

const SortableHeader = (label, key) => `
                    <th className="p-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none sticky top-0 bg-gray-50 z-10" onClick={() => handleSort('${key}')}>
                      <div className="flex items-center gap-1">
                        ${label}
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>`;

const tableReplacement = `{/* Table */}
          <div className="bg-white rounded-2xl border border-gray-150 shadow-sm flex flex-col">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
              <table className="w-full text-left border-collapse relative">
                <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
                  <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-100">
                    <th className="p-4 font-bold sticky top-0 bg-gray-50 z-10">
                      <input 
                        type="checkbox" 
                        className="rounded text-red-500 focus:ring-red-500 cursor-pointer"
                        checked={filteredPreview.length > 0 && selectedIds.size === filteredPreview.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="p-4 font-bold sticky top-0 bg-gray-50 z-10">No</th>${SortableHeader('Status', 'status')}${SortableHeader('Nama Pengirim', 'namaPengirim')}${SortableHeader('No HP', 'noHpPengirim')}${SortableHeader('Nama Penerima', 'namaPenerima')}
                    <th className="p-4 font-bold sticky top-0 bg-gray-50 z-10">No HP</th>
                    <th className="p-4 font-bold sticky top-0 bg-gray-50 z-10">Alamat</th>${SortableHeader('Outlet Asal', 'outletName')}
                    <th className="p-4 font-bold sticky top-0 bg-gray-50 z-10">Aksi</th>
                  </tr>
                </thead>`;

if (content.includes(tableTarget)) {
  content = content.replace(tableTarget, tableReplacement);
} else {
  console.log("Could not find table header block");
}

const emptyStateTarget = `<tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400">
                        Tidak ada data preview yang sesuai pencarian.
                      </td>
                    </tr>`;
const emptyStateReplacement = `<tr>
                      <td colSpan={10} className="p-8 text-center text-gray-400">
                        Tidak ada data preview yang sesuai pencarian.
                      </td>
                    </tr>`;
if (content.includes(emptyStateTarget)) {
  content = content.replace(emptyStateTarget, emptyStateReplacement);
} else {
  console.log("Could not find empty state block");
}

const rowTarget = `<tr key={row._id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-mono text-gray-500">{globalNum}</td>`;
const rowReplacement = `<tr key={row._id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <input 
                              type="checkbox" 
                              className="rounded text-red-500 focus:ring-red-500 cursor-pointer"
                              checked={selectedIds.has(row._id)}
                              onChange={(e) => handleSelectRow(row._id, e.target.checked)}
                            />
                          </td>
                          <td className="p-4 font-mono text-gray-500">{globalNum}</td>`;
if (content.includes(rowTarget)) {
  content = content.replace(rowTarget, rowReplacement);
} else {
  console.log("Could not find row block");
}

fs.writeFileSync('src/components/customer/ImportCustomerPage.tsx', content);
