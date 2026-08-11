export function calculateWeight(
  berat_timbangan: number,
  panjang: number,
  lebar: number,
  tinggi: number,
  ekspedisi: "Express" | "Cargo" | string,
  divisor_express: number = 6000,
  divisor_cargo: number = 5000
): {
  berat_volume: number;
  berat_penagihan: number;
  dasar_berat: "TIMBANGAN" | "VOLUME";
} {
  const p = panjang || 0;
  const l = lebar || 0;
  const t = tinggi || 0;
  const b = berat_timbangan || 0;
  const divisor = ekspedisi === "Cargo" ? divisor_cargo : divisor_express;
  
  let berat_volume_raw = 0;
  if (p > 0 || l > 0 || t > 0) {
    berat_volume_raw = (p * l * t) / divisor;
  }
  
  // Hindari floating point panjang (maksimal 2 desimal)
  const berat_volume = Number(berat_volume_raw.toFixed(2));
  
  // Bandingkan untuk dasar ongkir
  const dasar = Math.max(b, berat_volume);
  
  // Terapkan toleransi / aturan pembulatan resmi J&T
  let berat_penagihan = 0;
  if (dasar > 0) {
    const intPart = Math.floor(dasar);
    const fracPart = Number((dasar - intPart).toFixed(2));
    
    let rounded = intPart;
    if (fracPart > 0.30) {
      rounded = intPart + 1;
    }
    
    // Minimum tagihan = 1 kg jika berat > 0
    berat_penagihan = Math.max(1, rounded);
  }

  return {
    berat_volume,
    berat_penagihan,
    dasar_berat: berat_volume > b ? "VOLUME" : "TIMBANGAN"
  };
}
