const fs = require('fs');
let content = fs.readFileSync('src/components/customer/ImportCustomerPage.tsx', 'utf-8');

// Replace imports
content = content.replace(
  'import React, { useState } from "react";',
  'import React, { useState, useMemo } from "react";\nimport { ArrowUpDown } from "lucide-react";'
);

// Add state variables
const stateVars = `
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'} | null>(null);
`;
content = content.replace(
  'const [editForm, setEditForm] = useState<any>({});',
  'const [editForm, setEditForm] = useState<any>({});\n' + stateVars
);

// handlePreview success
content = content.replace(
  /const withIds = res\.data\.previewRows\.map\(\(r: any, i: number\) => \(\{ \.\.\.r, _id: i \}\)\);[\s\S]*?toast\.success\("Preview berhasil dimuat\."\);/,
  `const withIds = res.data.previewRows.map((r: any, i: number) => ({ ...r, _id: i }));
        setPreviewData({ ...res.data, previewRows: withIds });
        setDeletedIds(new Set());
        setSelectedIds(new Set());
        setStatusFilter("ALL");
        setSortConfig(null);
        setCurrentPage(1);
        toast.success("Preview berhasil dimuat.");`
);

fs.writeFileSync('src/components/customer/ImportCustomerPage.tsx', content);
