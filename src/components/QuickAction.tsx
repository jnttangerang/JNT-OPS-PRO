import React, { useState } from "react";
import { QrCode, FileText, Wallet, Plus, X } from "lucide-react";

interface QuickActionProps {
  onNavigate: (route: string) => void;
  currentRole?: string;
}

export default function QuickAction({ onNavigate, currentRole }: QuickActionProps) {
  const [open, setOpen] = useState(false);

  // Quick actions apply to ADMIN and OWNER
  if (currentRole !== "ADMIN" && currentRole !== "OWNER") {
    return null;
  }

  const actions = [
    {
      id: "pre-input",
      label: "Pre-Input",
      icon: FileText,
      color: "bg-amber-500 hover:bg-amber-600 text-white"
    },
    {
      id: "transaksi",
      label: "Scan / Input Transaksi",
      icon: QrCode,
      color: "bg-[#E4002B] hover:bg-red-700 text-white"
    },
    {
      id: "keuangan-outlet",
      label: "Kas Outlet",
      icon: Wallet,
      color: "bg-purple-600 hover:bg-purple-700 text-white"
    }
  ];

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-2 print:hidden">
      {/* Expanded Menu Options */}
      {open && (
        <div className="flex flex-col gap-2 mb-2 animate-in slide-in-from-bottom-2 duration-150">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.id}
                onClick={() => {
                  onNavigate(act.id);
                  setOpen(false);
                }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-lg font-bold text-xs transition-all cursor-pointer ${act.color}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Trigger Toggle FAB */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center p-3.5 sm:p-4 bg-[#E4002B] hover:bg-red-700 text-white rounded-2xl shadow-xl hover:shadow-2xl transition-all cursor-pointer border border-red-500/20 active:scale-95"
        title="Quick Action"
      >
        {open ? (
          <X className="h-6 w-6 stroke-[2.5]" />
        ) : (
          <div className="flex items-center gap-2 px-1">
            <Plus className="h-5 w-5 stroke-[2.5]" />
            <span className="hidden sm:inline font-black text-xs uppercase tracking-wider">Aksi Cepat</span>
          </div>
        )}
      </button>
    </div>
  );
}
