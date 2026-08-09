import React, { useState, useEffect } from "react";
import { DollarSign, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Lock, ShieldCheck } from "lucide-react";

interface SettlementData {
  settlement_id: string;
  outlet_id: string;
  tanggal: string;
  status: string;
  expected_owner_deposit: number;
  actual_owner_deposit: number;
  difference: number;
  deposit_status: string;
  reconciliation_status: string;
  open_critical_count: number;
  open_error_count: number;
  total_customer: number;
  total_outlet_cash: number;
  valid_financial_transaction_count: number;
  created_by?: string;
  approved_by?: string;
  rejected_by?: string;
  rejection_reason?: string;
  updated_at: string;
}

export function FinancialSettlementPanel({
  outletId = "OUT-001",
  tanggal = new Date().toISOString().split("T")[0],
  userRole = "OWNER",
  userId = "USER-01"
}: {
  outletId?: string;
  tanggal?: string;
  userRole?: string;
  userId?: string;
}) {
  const [settlement, setSettlement] = useState<SettlementData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actualAmountInput, setActualAmountInput] = useState<string>("");
  const [rejectReason, setRejectReason] = useState<string>("");
  const [reopenReason, setReopenReason] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settlement/status?outlet_id=${outletId}&tanggal=${tanggal}`);
      const json = await res.json();
      if (json.status === "success" && json.data) {
        setSettlement(json.data);
        setActualAmountInput(String(json.data.actual_owner_deposit || ""));
      } else {
        // Auto create initial settlement if missing
        const createRes = await fetch("/api/settlement/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outlet_id: outletId,
            tanggal,
            actor_id: userId,
            actor_role: userRole
          })
        });
        const createJson = await createRes.json();
        if (createJson.status === "success") {
          setSettlement(createJson.data);
          setActualAmountInput(String(createJson.data.actual_owner_deposit || ""));
        }
      }
    } catch (e: any) {
      console.error("Failed to fetch settlement", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [outletId, tanggal]);

  const handleRecordDeposit = async () => {
    setMessage(null);
    const amount = Number(actualAmountInput);
    if (isNaN(amount)) {
      setMessage({ type: "error", text: "Nominal setoran tidak valid" });
      return;
    }
    try {
      const res = await fetch("/api/settlement/recordDeposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: outletId,
          tanggal,
          actual_amount: amount,
          actor_id: userId,
          actor_role: userRole
        })
      });
      const json = await res.json();
      if (json.status === "success") {
        setSettlement(json.data);
        setMessage({ type: "success", text: json.message });
      } else {
        setMessage({ type: "error", text: json.message || "Gagal merekam deposit" });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Error network" });
    }
  };

  const handleApprove = async () => {
    setMessage(null);
    try {
      const res = await fetch("/api/settlement/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: outletId,
          tanggal,
          actor_id: userId,
          actor_role: userRole
        })
      });
      const json = await res.json();
      if (json.status === "success") {
        setSettlement(json.data);
        setMessage({ type: "success", text: json.message });
      } else {
        setMessage({ type: "error", text: json.message || "Approval ditolak" });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Error network" });
    }
  };

  const handleReject = async () => {
    setMessage(null);
    if (!rejectReason.trim()) {
      setMessage({ type: "error", text: "Alasan penolakan wajib diisi" });
      return;
    }
    try {
      const res = await fetch("/api/settlement/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: outletId,
          tanggal,
          reason: rejectReason,
          actor_id: userId,
          actor_role: userRole
        })
      });
      const json = await res.json();
      if (json.status === "success") {
        setSettlement(json.data);
        setMessage({ type: "success", text: json.message });
      } else {
        setMessage({ type: "error", text: json.message || "Gagal menolak settlement" });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Error network" });
    }
  };

  const handleReopen = async () => {
    setMessage(null);
    if (!reopenReason.trim()) {
      setMessage({ type: "error", text: "Alasan reopen wajib diisi" });
      return;
    }
    try {
      const res = await fetch("/api/settlement/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: outletId,
          tanggal,
          reason: reopenReason,
          actor_id: userId,
          actor_role: userRole
        })
      });
      const json = await res.json();
      if (json.status === "success") {
        setSettlement(json.data);
        setMessage({ type: "success", text: json.message });
      } else {
        setMessage({ type: "error", text: json.message || "Gagal mereopen settlement" });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Error network" });
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span>Memuat Settlement Engine...</span>
      </div>
    );
  }

  const expected = settlement?.expected_owner_deposit || 0;
  const actual = settlement?.actual_owner_deposit || 0;
  const diff = settlement?.difference || 0;
  const status = settlement?.status || "UNSETTLED";

  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            Financial Settlement & Owner Approval
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Outlet: <span className="font-semibold text-slate-700 dark:text-slate-300">{outletId}</span> | Tanggal: <span className="font-semibold text-slate-700 dark:text-slate-300">{tanggal}</span>
          </p>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              status === "APPROVED" || status === "SETTLED"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : status === "MATCHED" || status === "PENDING_APPROVAL"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                : status === "REJECTED"
                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            STATUS: {status}
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 uppercase font-semibold">Expected Owner Deposit</div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Rp {expected.toLocaleString("id-ID")}
          </div>
          <div className="text-xs text-slate-400 mt-1">Single Source: Financial Engine</div>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 uppercase font-semibold">Actual Owner Deposit</div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Rp {actual.toLocaleString("id-ID")}
          </div>
          <div className="text-xs text-slate-400 mt-1">Disetor oleh Admin</div>
        </div>

        <div
          className={`p-4 rounded-lg border ${
            diff === 0
              ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800"
          }`}
        >
          <div className="text-xs text-slate-500 uppercase font-semibold">Difference Analysis</div>
          <div
            className={`text-xl font-bold mt-1 ${
              diff === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            Rp {diff.toLocaleString("id-ID")}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Status: <span className="font-semibold">{diff === 0 ? "MATCHED" : "MISMATCH"}</span>
          </div>
        </div>
      </div>

      {/* Admin Section: Deposit Recording */}
      {(userRole === "ADMIN" || userRole === "OWNER") && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-500" />
            Input / Update Setoran Aktual
          </h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={actualAmountInput}
              onChange={(e) => setActualAmountInput(e.target.value)}
              placeholder="Masukkan nominal setoran..."
              className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
            <button
              onClick={handleRecordDeposit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors"
            >
              Simpan Deposit
            </button>
          </div>
        </div>
      )}

      {/* Owner Section: Approval / Rejection / Reopen */}
      {(userRole === "OWNER") && (
        <div className="p-4 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-lg border border-emerald-200 dark:border-emerald-800/50 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Otorisasi Final Owner Approval
          </h3>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleApprove}
              disabled={status === "APPROVED" || status === "SETTLED"}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve Settlement
            </button>

            <div className="flex gap-2 flex-1 min-w-[280px]">
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Alasan penolakan..."
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
              />
              <button
                onClick={handleReject}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>

            {(status === "SETTLED" || status === "APPROVED") && (
              <div className="flex gap-2 flex-1 min-w-[280px]">
                <input
                  type="text"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Alasan reopen..."
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                />
                <button
                  onClick={handleReopen}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reopen
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
