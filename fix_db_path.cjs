const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  `function readDb() {
  if (!fs.existsSync(dbPath)) {
    const dbToSave = { ...initialDb, MapsReviews: defaultReviews, MasterKategoriKeuangan: defaultKategoriKeuangan };
    syncExistingDataToThreeLayers(dbToSave);
    fs.writeFileSync(dbPath, JSON.stringify(dbToSave, null, 2));
    return dbToSave;
  }`,
  `function readDb() {
  if (!fs.existsSync(dbPath)) {
    let dbToSave;
    const repoDbPath = path.join(process.cwd(), "db.json");
    if (isVercel && fs.existsSync(repoDbPath)) {
      try {
        dbToSave = JSON.parse(fs.readFileSync(repoDbPath, "utf-8"));
      } catch (e) {
        dbToSave = { ...initialDb, MapsReviews: defaultReviews, MasterKategoriKeuangan: defaultKategoriKeuangan };
      }
    } else {
      dbToSave = { ...initialDb, MapsReviews: defaultReviews, MasterKategoriKeuangan: defaultKategoriKeuangan };
    }
    syncExistingDataToThreeLayers(dbToSave);
    fs.writeFileSync(dbPath, JSON.stringify(dbToSave, null, 2));
    return dbToSave;
  }`
);

fs.writeFileSync('server.ts', code);
