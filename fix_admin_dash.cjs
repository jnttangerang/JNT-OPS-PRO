const fs = require('fs');
const file = 'src/components/admin/AdminDashboardPage.tsx';
let code = fs.readFileSync(file, 'utf8');

const defaultData = `{
          summary: { totalTransaksi: 0, totalResiExpress: 0, totalResiCargo: 0, grandTotalCustomer: 0, totalWajibSetorOwner: 0, totalKasOutlet: 0 },
          targetHarian: { current: 0, target: 100 },
          byAdmin: [],
          byEkspedisi: { Express: { resi: 0, setoran: 0 }, Cargo: { resi: 0, setoran: 0 } },
          statusSetoranList: [],
          aktivitasLogs: [],
          pembatalanLogs: [],
          grafik: [],
          alerts: [],
          recentTransactions: []
        }`;

code = code.replace(
  `      if (res.status === "success") {
        setData(res.data);
      }
    } catch (e) {
      console.error(e);
    }`,
  `      if (res.status === "success") {
        setData(res.data);
      } else {
        setData(${defaultData});
      }
    } catch (e) {
      console.error("Dashboard error:", e);
      setData(${defaultData});
    }`
);

fs.writeFileSync(file, code);
