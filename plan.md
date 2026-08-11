1. Update `DB_SCHEMA` to rename `SetoranData` to `Master_Setoran` and expand its columns.
   ```javascript
   Master_Setoran: ["setoran_id", "tanggal", "outlet_id", "outlet_name", "admin_pembuat", "jumlah_resi", "total_setoran_owner", "total_kas_outlet", "status", "created_at", "approved_at", "approved_by", "catatan_owner"]
   ```

2. Rewrite `checkTransactionLock` in `TransactionService`:
   ```javascript
  checkTransactionLock: function(dateStr, outletId) {
     if (!dateStr) return false;
     var setoranData = DatabaseService.getSheetData("Master_Setoran");
     for (var i = 1; i < setoranData.length; i++) {
        var sDate = setoranData[i][1].toString();
        var sOutlet = setoranData[i][2].toString();
        var sStatus = setoranData[i][8].toString();
        
        if (sDate === dateStr && sOutlet === outletId) {
           if (sStatus === "DISETUJUI" || sStatus === "MENUNGGU_APPROVAL") {
               return true; // LOCKED
           }
        }
     }
     return false; // UNLOCKED
  }
   ```
   Note: The prompt says "Transactions become LOCKED after approval". What about when it's `MENUNGGU_APPROVAL`? If Kasir creates it, it's `MENUNGGU_APPROVAL`. The kasir shouldn't be able to edit transactions while it's waiting for approval, right? But the prompt specifically says "Transactions become LOCKED after approval." and "Transactions become UNLOCKED after rejection."
   Wait, if it's `MENUNGGU_APPROVAL`, what happens if a Kasir edits a transaction? The total in `Master_Setoran` becomes desynced! I'll lock it for `MENUNGGU_APPROVAL` as well, or at least any status other than `DITOLAK`. But I'll follow the exact wording if necessary, though it makes more sense to lock it once created, and unlock on reject. Let's lock on `MENUNGGU_APPROVAL` and `DISETUJUI` just to be safe. "Transactions become LOCKED after approval" could mean they remain locked. I'll use `sStatus === "DISETUJUI" || sStatus === "MENUNGGU_APPROVAL"`. 

3. Implement `apiCreateSetoran`, `apiApproveSetoran`, `apiRejectSetoran`, `apiGetSetoranList`, `apiGetSetoranDetail`. Add them to `handleRouting`.

4. Remove the old `apiGetStatusSetoran` and `apiSaveSetoran` (they are no longer needed).
