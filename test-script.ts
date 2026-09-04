const fakeUsers = [
  { user_id: "USR-003", username: "admin1", nama_lengkap: "FITRI FAJRIA" },
  { user_id: "USR-005", username: "admin3", nama_lengkap: "RISKA AMUDIA" },
];

function isResolvedUserId(id: string, users: any[]): boolean {
  return users.some((u: any) => u.user_id === id);
}

function resolveAdmin(tx: any, localTx: any, users: any[]): string {
  const rawAdmin = tx.admin_id_pencatat || tx.admin_id || tx.admin || tx.user_id || tx.dibuat_oleh || tx.admin_pembuat || tx.created_by;
  let finalAdminId = rawAdmin;
  
  if (rawAdmin && String(rawAdmin).trim() !== "" && rawAdmin !== "SYSTEM") {
    const cleanAdmin = String(rawAdmin).trim();
    const matchedUser = (users || []).find((u: any) => 
      u.user_id === cleanAdmin || 
      u.username === cleanAdmin || 
      (u.nama_lengkap && u.nama_lengkap.trim().toUpperCase() === cleanAdmin.toUpperCase())
    );
    if (matchedUser) {
      finalAdminId = matchedUser.user_id;
    }
  }

  // Jika finalAdminId masih nama mentah (bukan valid user_id dari Users),
  // cek apakah local sudah punya ownership yang valid
  if (!isResolvedUserId(finalAdminId, users || [])) {
    const localOwner = localTx?.admin_id;
    if (localOwner && localOwner !== "SYSTEM" && localOwner !== "UNKNOWN" && localOwner !== "") {
      finalAdminId = localOwner;  // preserve local valid ownership
    } else if (!finalAdminId || finalAdminId === "SYSTEM") {
      finalAdminId = "SYSTEM";    // final fallback, sama seperti sekarang
    }
    // else: biarkan rawAdmin (nama mentah) daripada hilang total
  }

  return finalAdminId;
}

const cases = [
  // [desc, tx.admin_id_pencatat, localTx.admin_id, expected]
  ["remote=nama, local=USR-003", "FITRI FAJRIA", "USR-003", "USR-003"],
  ["remote=user_id valid",       "USR-003",      "USR-005", "USR-003"],
  ["remote=kosong, local valid", "",             "USR-003", "USR-003"],
  ["remote=SYSTEM, local valid", "SYSTEM",       "USR-003", "USR-003"],
  ["remote=USR-005, local=003",  "USR-005",      "USR-003", "USR-005"],
  ["keduanya kosong/SYSTEM",     "",             "SYSTEM",  "SYSTEM" ],
  ["remote nama salah eja",      "FITRI FAJRIAH","USR-003", "USR-003"],
];

let allPass = true;
for (const [desc, remoteAdmin, localAdmin, expected] of cases) {
  const tx = { admin_id_pencatat: remoteAdmin };
  const localTx = { admin_id: localAdmin };
  const result = resolveAdmin(tx, localTx, fakeUsers);
  const pass = result === expected ? "PASS" : "FAIL";
  console.log(`${pass} [${desc}] → ${result} (expected: ${expected})`);
  if (result !== expected) allPass = false;
}

if (!allPass) {
  process.exit(1);
}
