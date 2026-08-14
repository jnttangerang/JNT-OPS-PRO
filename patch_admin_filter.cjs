const fs = require('fs');
let code = fs.readFileSync('src/components/PreInputPage.tsx', 'utf8');

const targetAdminFilter = `<option value="ALL">Semua Admin</option>
                      {Array.from(new Set(drafts.map((d) => d.admin_id).filter(Boolean))).map((adm) => (
                        <option key={adm} value={adm}>
                          {adm}
                        </option>
                      ))}`;

const replaceAdminFilter = `<option value="ALL">Semua Admin</option>
                      {Array.from(new Set(drafts.map((d) => d.admin_id).filter(Boolean))).map((adm) => {
                        const u = users.find(x => x.user_id === adm || x.username === adm);
                        const label = u ? (u.nama_lengkap || u.username || adm) : adm;
                        return (
                          <option key={adm} value={adm}>
                            {label}
                          </option>
                        );
                      })}`;
                      
code = code.replace(targetAdminFilter, replaceAdminFilter);
fs.writeFileSync('src/components/PreInputPage.tsx', code);
console.log("Admin filter patched");
