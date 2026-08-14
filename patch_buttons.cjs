const fs = require('fs');
let code = fs.readFileSync('src/components/PreInputPage.tsx', 'utf8');

const targetButtons = `<button
                  type="button"
                  onClick={handleDraftBaru}
                  className="py-3 px-3 sm:px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Reset Form
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePreInput(false)}
                  disabled={loading || uploadingFotoPaket}`;

const replaceButtons = `<button
                  type="button"
                  onClick={handleDraftBaru}
                  className="py-3 px-3 sm:px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Reset Form
                </button>
                <button
                  type="button"
                  onClick={handleSimpanDraftManual}
                  disabled={loading || uploadingFotoPaket}
                  className="py-3 px-3 sm:px-4 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold rounded-xl text-xs transition cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Simpan Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePreInput(false)}
                  disabled={loading || uploadingFotoPaket}`;

code = code.replace(targetButtons, replaceButtons);
fs.writeFileSync('src/components/PreInputPage.tsx', code);
console.log("Buttons patched");
