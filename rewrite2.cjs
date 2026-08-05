const fs = require('fs');

let content = fs.readFileSync('src/components/customer/ImportCustomerPage.tsx', 'utf-8');

const blockToReplace = `  const handleSaveEdit = () => {
    if (!previewData) return;
    const newData = { ...previewData };
    const rowIdx = newData.previewRows.findIndex((r: any) => r._id === editingIdx);
    if (rowIdx > -1) {
      newData.previewRows[rowIdx] = { ...editForm };
      setPreviewData(newData);
    }
    setEditingIdx(null);
  };

  const handleDelete = (id: number) => {
    if (!previewData) return;
    const newData = { ...previewData };
    newData.previewRows = newData.previewRows.filter((r: any) => r._id !== id);
    setPreviewData(newData);
  };

  const handleImport = async () => {
    setShowConfirmModal(false);
    setIsImporting(true);
    
    try {
      const res = await callBackend("importCustomerFromSheet", {
        outletId,
        spreadsheetId: spreadsheetId.trim(),
        sheetName: sheetName.trim(),
        preview: false,
        editedRows: previewData?.previewRows
      });
      
      if (res.status === "success") {
        toast.success(\`Import selesai: \${res.data?.insertPengirim || 0} customer baru, \${res.data?.updatePengirim || 0} diupdate.\`);
        setPreviewData(null); // Clear preview after successful import
      } else {
        toast.error(res.message || "Gagal import customer.");
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal import customer.");
    } finally {
      setIsImporting(false);
    }
  };

  // Calculate dynamic stats
  const validRows = previewData?.previewRows || [];
  const totalValid = validRows.length;
  const newCustomers = validRows.filter((r: any) => r.status === "NEW").length;
  const existingCustomers = validRows.filter((r: any) => r.status === "UPDATE").length;
  const deletedCount = (previewData?.total || 0) - totalValid;
  const errorCount = previewData?.failed || 0;

  const filteredPreview = validRows.filter((row: any) => 
    row.namaPengirim?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.noHpPengirim?.includes(searchQuery) ||
    row.namaPenerima?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.noHpPenerima?.includes(searchQuery)
  ) || [];`;

const replacement = `  const handleSaveEdit = () => {
    if (!previewData) return;
    const newData = { ...previewData };
    const rowIdx = newData.previewRows.findIndex((r: any) => r._id === editingIdx);
    if (rowIdx > -1) {
      newData.previewRows[rowIdx] = { ...editForm };
      setPreviewData(newData);
    }
    setEditingIdx(null);
  };

  const handleDelete = (id: number) => {
    const newDeleted = new Set(deletedIds);
    newDeleted.add(id);
    setDeletedIds(newDeleted);
    
    const newSelected = new Set(selectedIds);
    newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const workingCopy = useMemo(() => {
    if (!previewData?.previewRows) return [];
    return previewData.previewRows.filter((r: any) => !deletedIds.has(r._id));
  }, [previewData?.previewRows, deletedIds]);

  const handleImport = async () => {
    setShowConfirmModal(false);
    setIsImporting(true);
    
    try {
      const res = await callBackend("importCustomerFromSheet", {
        outletId,
        spreadsheetId: spreadsheetId.trim(),
        sheetName: sheetName.trim(),
        preview: false,
        editedRows: workingCopy
      });
      
      if (res.status === "success") {
        toast.success(\`Import selesai: \${res.data?.insertPengirim || 0} customer baru, \${res.data?.updatePengirim || 0} diupdate.\`);
        setPreviewData(null);
      } else {
        toast.error(res.message || "Gagal import customer.");
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal import customer.");
    } finally {
      setIsImporting(false);
    }
  };

  const deletedCount = deletedIds.size;
  const totalValid = workingCopy.length;
  const newCustomers = workingCopy.filter((r: any) => r.status === "NEW").length;
  const existingCustomers = workingCopy.filter((r: any) => r.status === "UPDATE").length;
  const errorCount = previewData?.failed || 0;

  const filteredPreview = useMemo(() => {
    let result = workingCopy;
    
    if (statusFilter !== "ALL") {
      result = result.filter((r: any) => r.status === statusFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row: any) => {
        const outName = outlets.find((o: any) => o.outlet_id === row.outlet)?.nama_outlet || row.outlet || "";
        return (
          row.namaPengirim?.toLowerCase().includes(q) ||
          row.noHpPengirim?.includes(q) ||
          row.namaPenerima?.toLowerCase().includes(q) ||
          row.noHpPenerima?.includes(q) ||
          outName.toLowerCase().includes(q)
        );
      });
    }

    if (sortConfig) {
      result = [...result].sort((a: any, b: any) => {
        let aVal = a[sortConfig.key] || "";
        let bVal = b[sortConfig.key] || "";
        
        if (sortConfig.key === "outletName") {
          aVal = outlets.find((o: any) => o.outlet_id === a.outlet)?.nama_outlet || a.outlet || "";
          bVal = outlets.find((o: any) => o.outlet_id === b.outlet)?.nama_outlet || b.outlet || "";
        } else if (sortConfig.key === "status") {
          aVal = a.status || "";
          bVal = b.status || "";
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [workingCopy, statusFilter, searchQuery, sortConfig, outlets]);

  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction: direction as 'asc' | 'desc' });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredPreview.map((r: any) => r._id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    const newDeleted = new Set(deletedIds);
    selectedIds.forEach(id => newDeleted.add(id));
    setDeletedIds(newDeleted);
    setSelectedIds(new Set());
  };
`;

const escapedBlockToReplace = blockToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
if (content.includes(blockToReplace)) {
  content = content.replace(blockToReplace, replacement);
} else {
  console.log("Could not find block 1");
}

fs.writeFileSync('src/components/customer/ImportCustomerPage.tsx', content);
