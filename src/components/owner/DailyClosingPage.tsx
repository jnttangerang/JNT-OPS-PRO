import React from "react";
import AdminDailySettlementView from "./AdminDailySettlementView";
import OwnerDailyClosingDashboard from "./OwnerDailyClosingDashboard";

export interface DailyClosingPageProps {
  session: {
    user_id?: string;
    username?: string;
    nama_lengkap?: string;
    role: string;
    outlet_id_home?: string;
  };
  outlets: Array<{ outlet_id: string; nama_outlet: string }>;
  activeOutletId?: string;
  onChangeActiveOutlet?: (outletId: string) => void;
}

export default function DailyClosingPage({
  session,
  outlets,
  activeOutletId,
  onChangeActiveOutlet
}: DailyClosingPageProps) {
  const isOwner = session?.role === "OWNER" || session?.role === "SUPER_ADMIN" || session?.role === "DEVELOPER";

  if (isOwner) {
    return (
      <OwnerDailyClosingDashboard
        session={session}
        outlets={outlets}
        activeOutletId={activeOutletId}
        onChangeActiveOutlet={onChangeActiveOutlet}
      />
    );
  }

  return (
    <AdminDailySettlementView
      session={session}
      outlets={outlets}
      activeOutletId={activeOutletId}
      onChangeActiveOutlet={onChangeActiveOutlet}
    />
  );
}
