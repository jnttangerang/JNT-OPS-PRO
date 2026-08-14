const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const newApiGetAllCustomers = `function apiGetAllCustomers(params) {
  try {
    params = params || {};
    var pengirimRows = DatabaseService.getSheetData("MASTER_PENGIRIM");
    var penerimaRows = DatabaseService.getSheetData("MASTER_PENERIMA");
    
    var map = {}; // key: telepon, value: objek customer
    
    function addCustomer(row, source) {
      var id = row.id || row.customer_id || "";
      var nama = row.nama || row.nama_pengirim || row.nama_penerima || "";
      var telepon = row.telepon || row.no_hp || row.no_hp_penerima || "";
      var alamat = row.alamat || row.alamat_pengirim || row.alamat_penerima || "";
      var status = row.status || "AKTIF";
      var created = row.created_at || row.last_updated || new Date().toISOString();
      var updated = row.updated_at || created;
      var outlet = row.outlet_id_asal || "";
      
      if (!telepon) return;
      
      if (map[telepon]) {
        if (status === "AKTIF" && map[telepon].status !== "AKTIF") {
          map[telepon] = { customer_id: id, id: id, nama: nama, telepon: telepon, alamat: alamat, status: status, created_at: created, updated_at: updated, outlet_id_asal: outlet, sumber: source };
        }
        else if (status === "AKTIF" && map[telepon].status === "AKTIF" && new Date(updated) > new Date(map[telepon].updated_at)) {
          map[telepon] = { customer_id: id, id: id, nama: nama, telepon: telepon, alamat: alamat, status: status, created_at: created, updated_at: updated, outlet_id_asal: outlet, sumber: source };
        }
      } else {
        map[telepon] = { customer_id: id, id: id, nama: nama, telepon: telepon, alamat: alamat, status: status, created_at: created, updated_at: updated, outlet_id_asal: outlet, sumber: source };
      }
    }
    
    if (pengirimRows && pengirimRows.length > 1) {
      var headersPengirim = pengirimRows[0];
      for (var i = 1; i < pengirimRows.length; i++) {
        var obj = rowToObject_(headersPengirim, pengirimRows[i]);
        addCustomer(obj, "PENGIRIM");
      }
    }
    
    if (penerimaRows && penerimaRows.length > 1) {
      var headersPenerima = penerimaRows[0];
      for (var j = 1; j < penerimaRows.length; j++) {
        var obj = rowToObject_(headersPenerima, penerimaRows[j]);
        addCustomer(obj, "PENERIMA");
      }
    }
    
    var result = Object.keys(map).map(function(k) { return map[k]; });
    
    result.sort(function(a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });
    
    var query = (params.query || params.keyword || "").toString().toLowerCase().trim();
    if (query) {
      result = result.filter(function(item) {
        var str = ((item.nama || "") + " " + (item.telepon || "") + " " + (item.alamat || "") + " " + (item.id || "")).toLowerCase();
        return str.indexOf(query) !== -1;
      });
    }
    
    return { status: "success", data: result };
  } catch(e) {
    return { status: "error", message: e.message };
  }
}
`;

// Insert the new function before apiGetCustomers
code = code.replace(/function apiGetCustomers\(params, action\) {/, newApiGetAllCustomers + '\nfunction apiGetCustomers(params, action) {');

// Update routing
code = code.replace(/case "getCustomers":\s*case "getCustomersMaster":\s*case "getBukuPengirim":\s*case "getBukuPenerima":\s*return apiGetCustomers\(params, action\);/g, 
`case "getCustomers":
    case "getCustomersMaster":
      return apiGetAllCustomers(params);
    case "getBukuPengirim":
    case "getBukuPenerima":
      return apiGetCustomers(params, action);`);

fs.writeFileSync('Code.gs', code);
console.log('Code.gs updated successfully');
