const fs = require('fs');

let code = fs.readFileSync('Code.gs', 'utf8');

if (!code.includes('case "updateYoYiTransaction":')) {
  // Add to switch case
  code = code.replace('case "importYoYi":', 'case "updateYoYiTransaction":\n      return apiUpdateYoYiTransaction(params);\n    case "importYoYi":');
  
  // Add function implementation
  const funcCode = `
function apiUpdateYoYiTransaction(params) {
  try {
    var targetResi = params.resi_id;
    var txId = params.transaksi_id;
    if (!targetResi && !txId) {
      return { status: "error", message: "resi_id atau transaksi_id diperlukan" };
    }

    var updateMap = {};
    if (params.ongkir_customer !== undefined) updateMap.ongkir_customer = Number(params.ongkir_customer) || 0;
    if (params.metode_bayar !== undefined) updateMap.metode_bayar = params.metode_bayar;
    if (params.bukti_bayar_url !== undefined) updateMap.bukti_bayar_url = params.bukti_bayar_url;
    if (params.biaya_lain !== undefined) updateMap.biaya_lain = Number(params.biaya_lain) || 0;
    if (params.metode_bayar_tambahan !== undefined) updateMap.metode_bayar_tambahan = params.metode_bayar_tambahan;
    if (params.bukti_tambahan_url !== undefined) updateMap.bukti_tambahan_url = params.bukti_tambahan_url;
    if (params.customer_maps_5star !== undefined) updateMap.customer_maps_5star = params.customer_maps_5star;
    if (params.bukti_maps_url !== undefined) updateMap.bukti_maps_url = params.bukti_maps_url;
    
    // Also update Wajib Setor Owner recalculating
    var existingTx = null;
    if (txId) {
      existingTx = DatabaseService.findRowByColumn("MASTER_TRANSAKSI", "transaksi_id", txId) || DatabaseService.findRowByColumn("MASTER_TRANSAKSI", "id", txId);
    } else {
      existingTx = DatabaseService.findRowByColumn("MASTER_TRANSAKSI", "no_resi", targetResi);
    }
    
    if (existingTx) {
       var o_cust = params.ongkir_customer !== undefined ? Number(params.ongkir_customer) || 0 : Number(existingTx.ongkir_customer || 0);
       var asuransi = Number(existingTx.asuransi || 0);
       var b_lain = params.biaya_lain !== undefined ? Number(params.biaya_lain) || 0 : Number(existingTx.biaya_lain || 0);
       var m_bayar = params.metode_bayar !== undefined ? params.metode_bayar : existingTx.metode_bayar;
       var total_dibayar = Number(existingTx.total_customer || 0);
       
       var biayaDasarLayanan = o_cust + asuransi + b_lain;
       var biayaDitagihkan = m_bayar === "DFOD" ? 0 : biayaDasarLayanan;
       var pembulatan = total_dibayar > 0 ? (total_dibayar - biayaDitagihkan) : 0;
       updateMap.wajib_setor_owner = biayaDitagihkan + pembulatan;
       
       var expTx = null;
       if (existingTx.tipe_produk === "Cargo") {
          expTx = DatabaseService.findRowByColumn("CRG_Resi", "transaksi_id", existingTx.id);
          if (expTx) DatabaseService.updateRowByColumn("CRG_Resi", "transaksi_id", existingTx.id, updateMap);
       } else {
          expTx = DatabaseService.findRowByColumn("EXP_Resi", "transaksi_id", existingTx.id);
          if (expTx) DatabaseService.updateRowByColumn("EXP_Resi", "transaksi_id", existingTx.id, updateMap);
       }
       DatabaseService.updateRowByColumn("MASTER_TRANSAKSI", "id", existingTx.id, updateMap);
    }
    
    return { status: "success", message: "Transaksi YoYi berhasil dilengkapi" };
  } catch(e) {
    return { status: "error", message: e.message };
  }
}
`;
  code += "\n\n" + funcCode;
  
  // also add missing fields to schema arrays in Code.gs
  code = code.replace(
    'MASTER_TRANSAKSI: [',
    'MASTER_TRANSAKSI: ["bukti_bayar_url", "metode_bayar_tambahan", "bukti_tambahan_url", "customer_maps_5star", "bukti_maps_url",'
  );
  code = code.replace(
    'EXP_Resi: ["resi_id", "transaksi_id",',
    'EXP_Resi: ["customer_maps_5star", "bukti_maps_url", "resi_id", "transaksi_id",'
  );
  code = code.replace(
    'CRG_Resi: ["resi_id", "transaksi_id",',
    'CRG_Resi: ["customer_maps_5star", "bukti_maps_url", "resi_id", "transaksi_id",'
  );

  fs.writeFileSync('Code.gs', code);
  console.log("Patched Code.gs successfully");
} else {
  console.log("Already patched Code.gs");
}
