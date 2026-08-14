const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldCode = `app.post("/api/getCustomersMaster", (req, res) => {
  const db = readDb();
  const customers = db.MASTER_CUSTOMER || [];`;

const newCode = `app.post("/api/getCustomersMaster", (req, res) => {
  const db = readDb();
  const pengirimRows = db.MASTER_PENGIRIM || [];
  const penerimaRows = db.MASTER_PENERIMA || [];
  
  const customerMap = new Map();
  const addCustomer = (row, source) => {
    const id = row.id || row.customer_id || "";
    const nama = row.nama || row.nama_pengirim || row.nama_penerima || "";
    const telepon = row.telepon || row.no_hp || row.no_hp_penerima || "";
    const alamat = row.alamat || row.alamat_pengirim || row.alamat_penerima || "";
    const status = row.status || "AKTIF";
    const created = row.created_at || row.last_updated || new Date().toISOString();
    const updated = row.updated_at || created;
    const outlet = row.outlet_id_asal || "";
    
    if (!telepon) return;
    
    if (customerMap.has(telepon)) {
      const existing = customerMap.get(telepon);
      if (status === "AKTIF" && existing.status !== "AKTIF") {
        customerMap.set(telepon, { customer_id: id, id, nama, telepon, alamat, status, created_at: created, updated_at: updated, outlet_id_asal: outlet, sumber: source });
      }
      else if (status === "AKTIF" && existing.status === "AKTIF" && new Date(updated) > new Date(existing.updated_at)) {
        customerMap.set(telepon, { customer_id: id, id, nama, telepon, alamat, status, created_at: created, updated_at: updated, outlet_id_asal: outlet, sumber: source });
      }
    } else {
      customerMap.set(telepon, { customer_id: id, id, nama, telepon, alamat, status, created_at: created, updated_at: updated, outlet_id_asal: outlet, sumber: source });
    }
  };
  
  pengirimRows.forEach(r => addCustomer(r, "PENGIRIM"));
  penerimaRows.forEach(r => addCustomer(r, "PENERIMA"));
  
  const customers = Array.from(customerMap.values());
`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('server.ts', code);
console.log('server.ts updated successfully');
