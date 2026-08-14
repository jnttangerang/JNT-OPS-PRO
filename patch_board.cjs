const fs = require('fs');
let code = fs.readFileSync('src/components/PreInputPage.tsx', 'utf8');

const regex = /\{\/\* 4 OPERATIONAL BOARD COLUMNS \*\/\}[\s\S]*?(?=\{\/\* RECENT ACTIVITY LOG SECTION \*\/\}|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*$)/;

const newBoard = `{/* OPERATIONAL BOARD (ACCORDION TABS) */}
              {loadingDrafts ? (
                <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#E4002B]" />
                  <span>Memuat workspace operasional board...</span>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {/* ACCORDION TABS HEADER */}
                  <div className="flex flex-wrap sm:flex-nowrap bg-gray-100 p-1.5 rounded-xl w-full gap-1">
                    <button
                      onClick={() => { setActiveBoardTab("DRAFT"); setBoardPage(1); }}
                      className={\`flex-1 py-2 text-[11px] font-bold rounded-lg transition-colors \${activeBoardTab === "DRAFT" ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}\`}
                    >
                      DRAFT <span className={\`ml-1 px-1.5 py-0.5 rounded font-mono text-[9px] \${activeBoardTab === "DRAFT" ? "bg-blue-100" : "bg-gray-200"}\`}>{columnData.DRAFT.length}</span>
                    </button>
                    <button
                      onClick={() => { setActiveBoardTab("INPUT_YOYI"); setBoardPage(1); }}
                      className={\`flex-1 py-2 text-[11px] font-bold rounded-lg transition-colors \${activeBoardTab === "INPUT_YOYI" ? 'bg-white text-amber-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}\`}
                    >
                      INPUT YOYI <span className={\`ml-1 px-1.5 py-0.5 rounded font-mono text-[9px] \${activeBoardTab === "INPUT_YOYI" ? "bg-amber-100" : "bg-gray-200"}\`}>{columnData.INPUT_YOYI.length}</span>
                    </button>
                    <button
                      onClick={() => { setActiveBoardTab("SIAP_DIBAYAR"); setBoardPage(1); }}
                      className={\`flex-1 py-2 text-[11px] font-bold rounded-lg transition-colors \${activeBoardTab === "SIAP_DIBAYAR" ? 'bg-white text-emerald-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}\`}
                    >
                      SIAP DIBAYAR <span className={\`ml-1 px-1.5 py-0.5 rounded font-mono text-[9px] \${activeBoardTab === "SIAP_DIBAYAR" ? "bg-emerald-100" : "bg-gray-200"}\`}>{columnData.SIAP_DIBAYAR.length}</span>
                    </button>
                    <button
                      onClick={() => { setActiveBoardTab("SELESAI"); setBoardPage(1); }}
                      className={\`flex-1 py-2 text-[11px] font-bold rounded-lg transition-colors \${activeBoardTab === "SELESAI" ? 'bg-white text-gray-800 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}\`}
                    >
                      SELESAI <span className={\`ml-1 px-1.5 py-0.5 rounded font-mono text-[9px] \${activeBoardTab === "SELESAI" ? "bg-gray-100 text-gray-600" : "bg-gray-200"}\`}>{columnData.SELESAI.length}</span>
                    </button>
                  </div>

                  {/* ACTIVE TAB CONTENT */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-3 flex flex-col space-y-3 min-h-[400px]">
                    <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                      {columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"].length === 0 ? (
                        <p className="text-[11px] text-gray-500 text-center py-12 italic">Tidak ada data untuk status ini.</p>
                      ) : (
                        columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"]
                          .slice((boardPage - 1) * boardLimit, boardPage * boardLimit)
                          .map((card: any) => {
                          const dateObj = card.timestamp ? new Date(card.timestamp) : new Date();
                          const timeFormatted = dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                          
                          // Styling per tab
                          let cardBorder = "border-gray-200";
                          let badgeBg = "bg-gray-100 text-gray-600";
                          if (activeBoardTab === "DRAFT") { cardBorder = "border-blue-200"; badgeBg = "bg-blue-50 text-blue-600"; }
                          else if (activeBoardTab === "INPUT_YOYI") { cardBorder = "border-amber-200"; badgeBg = "bg-amber-50 text-amber-600"; }
                          else if (activeBoardTab === "SIAP_DIBAYAR") { cardBorder = "border-emerald-200"; badgeBg = "bg-emerald-50 text-emerald-600"; }
                          
                          // Is being edited?
                          const isCurrent = editingTxId === card.transaksi_id;

                          return (
                            <div key={card.transaksi_id} className={\`p-3 bg-white rounded-xl border \${cardBorder} transition space-y-2.5 shadow-2xs flex flex-col justify-between hover:shadow-sm \${isCurrent ? "ring-2 ring-[#E4002B]/20 border-[#E4002B]" : ""}\`}>
                              <div className="flex items-start justify-between gap-1 border-b border-gray-100 pb-1.5">
                                <div>
                                  <h5 className="font-bold text-slate-900 text-xs">{card.nama_pengirim || "Customer Umum"}</h5>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className={\`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded \${badgeBg}\`}>
                                      {card.transaksi_id.split("-")[1] || card.transaksi_id}
                                    </span>
                                    <span className="text-[9px] text-gray-400 font-mono">• {timeFormatted}</span>
                                  </div>
                                </div>
                                {renderProductBadge(card.ekspedisi, card.nama_barang)}
                              </div>
                              <div className="text-[11px] space-y-1 text-slate-700">
                                <p className="font-semibold truncate text-slate-800">📦 {card.nama_barang || "Tanpa Nama Barang"}</p>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                  <span>{card.berat_kg || card.berat_timbangan || 0} kg</span>
                                  <span>📍 {card.alamat_penerima ? card.alamat_penerima.slice(0, 18) + "..." : "-"}</span>
                                </div>
                                {renderPriorityBadges(card)}
                              </div>
                              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  {activeBoardTab !== "SELESAI" && (
                                    <button
                                      type="button"
                                      onClick={() => handleSelectDraftToEdit(card)}
                                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition text-[10px] flex items-center gap-1"
                                    >
                                      <Edit3 className="h-3 w-3" /> Edit
                                    </button>
                                  )}
                                  
                                  {activeBoardTab === "DRAFT" && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleBatalkanDraft(card.transaksi_id)}
                                        className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg transition text-[10px] flex items-center gap-1"
                                      >
                                        <XCircle className="h-3 w-3" /> Batal
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleHapusDraft(card.transaksi_id)}
                                        className="px-2 py-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 font-semibold rounded-lg transition text-[10px]"
                                        title="Hapus Data (Tidak bisa dikembalikan)"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}
                                  
                                  {activeBoardTab === "INPUT_YOYI" && (
                                    <button
                                      type="button"
                                      onClick={() => handleMoveStatus(card.transaksi_id, "Draft")}
                                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition text-[10px] flex items-center gap-1"
                                    >
                                      <RefreshCw className="h-3 w-3" /> Ke Draft
                                    </button>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-1.5">
                                  {activeBoardTab === "DRAFT" && (
                                    <button
                                      type="button"
                                      onClick={() => handleMoveStatus(card.transaksi_id, "INPUT_YOYI")}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg transition text-[10px] flex items-center gap-1 shadow-2xs"
                                    >
                                      Lanjut <ArrowRight className="h-3 w-3" />
                                    </button>
                                  )}
                                  
                                  {activeBoardTab === "INPUT_YOYI" && (
                                    <button
                                      type="button"
                                      onClick={() => setResiModalData(card)}
                                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-lg transition text-[10px] flex items-center gap-1 shadow-2xs"
                                    >
                                      Input Resi <ArrowRight className="h-3 w-3" />
                                    </button>
                                  )}
                                  
                                  {activeBoardTab === "SIAP_DIBAYAR" && (
                                    <button
                                      type="button"
                                      onClick={() => handleLanjutkanDraft(card)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg transition text-[10px] flex items-center gap-1 shadow-2xs"
                                    >
                                      Bayar <ArrowRight className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    
                    {/* PAGINATION */}
                    {columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"].length > 0 && (
                      <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between text-[11px] text-gray-500 gap-2">
                        <div className="flex items-center gap-1.5">
                          <select 
                            value={boardLimit} 
                            onChange={(e) => { setBoardLimit(Number(e.target.value)); setBoardPage(1); }}
                            className="bg-gray-50 border border-gray-200 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-[#E4002B] text-gray-700 font-semibold cursor-pointer"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                          </select>
                          <span>/ hal</span>
                        </div>
                        <div className="font-semibold hidden sm:block">
                          Menampilkan {Math.min((boardPage - 1) * boardLimit + 1, columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"].length)} - {Math.min(boardPage * boardLimit, columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"].length)} dari {columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"].length} data
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            disabled={boardPage === 1}
                            onClick={() => setBoardPage(p => Math.max(1, p - 1))}
                            className="p-1 rounded bg-gray-50 border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Halaman Sebelumnya"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="font-mono px-2 font-bold">{boardPage}</span>
                          <button 
                            disabled={boardPage * boardLimit >= columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"].length}
                            onClick={() => setBoardPage(p => p + 1)}
                            className="p-1 rounded bg-gray-50 border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Halaman Selanjutnya"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              `;

code = code.replace(regex, newBoard + "\n");
fs.writeFileSync('src/components/PreInputPage.tsx', code);
console.log("Board Layout patched to accordion style!");
