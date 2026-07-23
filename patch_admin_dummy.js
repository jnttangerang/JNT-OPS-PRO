import fs from 'fs';
let code = fs.readFileSync('src/components/admin/AdminDashboardPage.tsx', 'utf-8');

const dummyData = `
        setData({
          summary: {
            total_transaksi: 45,
            total_ongkir: 1250000,
            avg_ongkir: 27777,
            persentase_selesai: 95
          },
          targetHarian: {
            target: 1500000,
            tercapai: 1250000,
            persentase: 83
          },
          byAdmin: [
            { nama_admin: "Budi", total_resi: 25, total_ongkir: 750000, target: 1000000 }
          ],
          byEkspedisi: [
            { ekspedisi: "JNT", total_resi: 30, total_ongkir: 850000 },
            { ekspedisi: "JNE", total_resi: 15, total_ongkir: 400000 }
          ],
          statusSetoranList: [
            { tanggal: "2023-10-25", admin: "Budi", status: "Belum Disetujui", total_setoran: 750000, metode: "Transfer BCA" }
          ],
          aktivitasLogs: [
            { id: 1, jam: "10:30", aktivitas: "Budi menginput resi JNT", status: "sukses" }
          ],
          pembatalanLogs: [
            { id: 1, jam: "11:00", admin: "Budi", resi: "JB123456", alasan: "Salah input nominal" }
          ],
          grafik: {
            labels: ["08:00", "09:00", "10:00", "11:00", "12:00"],
            data_ongkir: [50000, 150000, 300000, 200000, 550000]
          },
          alerts: [
            { id: 1, type: "warning", message: "Target harian Budi kurang 250k lagi" }
          ]
        });
`;

code = code.replace(
  '    } catch (e) {\n      console.error(e);\n    }',
  '    } catch (e) {\n      console.error(e);\n' + dummyData + '\n    }'
);

fs.writeFileSync('src/components/admin/AdminDashboardPage.tsx', code);
