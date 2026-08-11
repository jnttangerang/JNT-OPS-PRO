import app from "./server.ts";
import request from "supertest";

console.log("App imported!");

request(app)
  .post("/api/saveDataPreInput")
  .send({
    nama_pengirim: "Alice",
    hp_pengirim: "081122334455",
    alamat_pengirim: "A",
    nama_penerima: "Bob",
    hp_penerima: "089988776655",
    alamat_penerima: "B",
    berat_kg: 1,
    admin_id: "ADMIN-1",
    outlet_id_tugas: "OUT-001"
  })
  .expect(200)
  .end((err, res) => {
    if (err) throw err;
    console.log(res.body);
    process.exit(0);
  });
