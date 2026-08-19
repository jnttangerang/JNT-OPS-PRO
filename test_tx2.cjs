const res2 = await fetch("http://127.0.0.1:3000/api/getRiwayatTransaksi", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ filterOutlet: "ALL" })
});
const data = await res2.json();
console.log(data.data.find(d => d.resi_id === "TEST-9999") ? "FOUND" : "NOT FOUND");
