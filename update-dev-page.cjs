const fs = require('fs');
const content = fs.readFileSync('src/components/DeveloperPage.tsx', 'utf8');

const injection = `
        {/* AppsScript Sync Audit Logs */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4 md:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Activity className="text-orange-500 w-5 h-5" />
              <h2 className="font-bold text-gray-800">AppsScript Sync Audit Logs</h2>
            </div>
            <button
              onClick={fetchSyncLogs}
              disabled={loadingLogs}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors"
            >
              {loadingLogs ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Timestamp</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Duration (ms)</th>
                  <th className="px-4 py-3">Payload Items</th>
                  <th className="px-4 py-3 rounded-tr-lg">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {syncLogs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No logs available</td></tr>
                ) : (
                  syncLogs.map((log: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{new Date(log.timestamp).toLocaleString("id-ID")}</td>
                      <td className="px-4 py-3">
                        <span className={\`px-2 py-1 rounded-full text-[10px] font-bold \${log.status === 'ERROR' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}\`}>{log.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{log.duration_ms} ms</td>
                      <td className="px-4 py-3 text-gray-600 font-mono">{log.payload_size}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate" title={log.detail}>{log.detail}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
`;

const updated = content.replace(
  /        <\/div>\n      <\/div>\n    <\/div>\n  \);\n}/g,
  `        </div>\n${injection}\n      </div>\n    </div>\n  );\n}`
);

fs.writeFileSync('src/components/DeveloperPage.tsx', updated);
console.log("Updated DeveloperPage.tsx");
