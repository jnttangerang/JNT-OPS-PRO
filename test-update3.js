const req = {
  action: "updateTransaksi",
  data: {
    jenis_layanan: "Express",
    data: {
      resi_id: "Jt08796859341", 
      old_resi_id: "Jt08796859341",
      metode_bayar: "QRIS",
      ongkir_dasar: 10000,
      transaksi_id: "TRX-1726058055627-915"
    }
  }
};
console.log(JSON.stringify(req));
