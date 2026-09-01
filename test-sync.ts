import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Mock DB
const db = {
  MASTER_TRANSAKSI: [
    { id: 1, resi_id: 'JD123', metode_bayar: 'QRIS' },
    { id: 2, resi_id: 'JD124', metode_bayar: 'TUNAI' }
  ],
  KeuanganOutlet: [
    { id: 'KNG-1', resi_id: 'JD123', lokasi_uang: 'OWNER' },
    { id: 'KNG-PENDING-2', resi_id: 'JD124', lokasi_uang: 'ADMIN' },
    { id: 'KNG-MANUAL-1', lokasi_uang: 'OWNER', deskripsi: 'Transfer', jenis: 'TRANSFER_INTERNAL' }
  ]
};

const remoteKeuangan = [
  { id: 'KNG-1', resi_id: 'JD123', lokasi_uang: null },
  { id: 'KNG-MANUAL-1', deskripsi: 'Transfer', jenis: 'TRANSFER_INTERNAL', lokasi_uang: undefined }
];

const localKeuangan = db.KeuanganOutlet || [];
const remoteKeuanganIds = new Set(remoteKeuangan.map((k: any) => k.id));

const mergedKeuangan = remoteKeuangan.map((remoteK: any) => {
  const localK = localKeuangan.find((l: any) => l.id === remoteK.id);
  let resolvedLokasiUang = remoteK.lokasi_uang || localK?.lokasi_uang;

  if (!resolvedLokasiUang && (remoteK.resi_id || (remoteK.deskripsi && remoteK.deskripsi.toLowerCase().includes("resi")))) {
    const resiIdMatch = remoteK.resi_id || remoteK.deskripsi.match(/resi\s+([a-z0-9]+)/i)?.[1];
    if (resiIdMatch) {
      const tx = (db.MASTER_TRANSAKSI || []).find((t: any) => t.resi_id === resiIdMatch);
      if (tx) {
        const mBayar = (tx.metode_bayar || "").toUpperCase();
        const isDigital = mBayar === "QRIS" || mBayar === "TRANSFER" || mBayar.includes("APP") || mBayar.includes("DFOD");
        resolvedLokasiUang = isDigital ? "OWNER" : "ADMIN";
      }
    }
  }
  if (!resolvedLokasiUang) {
    resolvedLokasiUang = "ADMIN";
  }
  return { ...remoteK, lokasi_uang: resolvedLokasiUang };
});

const localOnlyKeuangan = localKeuangan.filter((k: any) => k.id && !remoteKeuanganIds.has(k.id));
const result = [...mergedKeuangan, ...localOnlyKeuangan];
console.log(JSON.stringify(result, null, 2));
