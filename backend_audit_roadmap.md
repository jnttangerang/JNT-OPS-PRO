# 1. Full Endpoint Audit (server.ts vs Code.gs)

| Endpoint | Status | Handled By | Notes |
|---|---|---|---|
| `/api/login` | ✅ Migrated | `apiLogin` | Completely handled in Code.gs |
| `/api/getOutlets` | ✅ Migrated | `apiGetOutlets` | Code.gs replaces both `/getOutlets` & `/outlets` |
| `/api/searchCustomer` | ✅ Migrated | `apiSearchCustomer` | Completely handled in Code.gs |
| `/api/getRiwayatPenerima` | ✅ Migrated | `apiGetRiwayatPenerima` | Completely handled in Code.gs |
| `/api/checkDuplicateResi` | ✅ Migrated | `apiCheckDuplicateResi` | Completely handled in Code.gs |
| `/api/saveDataPreInput` | ✅ Migrated | `apiSaveDataPreInput` | Completely handled in Code.gs |
| `/api/getPreInput` | ✅ Migrated | `apiGetPreInput` | Completely handled in Code.gs |
| `/api/saveTransaksi` | ✅ Migrated | `apiSaveTransaksi` | Completely handled in Code.gs |
| `/api/perbaikiAlamatAI` | ⚠️ Partially | `apiPerbaikiAlamatAI` | Handled in Code.gs but React still bypasses it via Local Action in useAppsScript.ts |
| `/api/uploadFile` | ✅ Migrated | `apiUploadFile` | Handled via Google Drive |
| `/api/getDashboardData` | ✅ Migrated | `apiGetDashboardData` | Handled in Code.gs for non-admin |
| `/api/getRiwayatTransaksi`| ✅ Migrated | `apiGetRiwayatTransaksi`| Completely handled in Code.gs |
| `/api/deleteTransaksi` | ✅ Migrated | `apiDeleteTransaksi` | Completely handled in Code.gs |
| `/api/updateSettingsOutlet` | ✅ Migrated | `apiUpdateOutletTarget` | Adapted implementation |
| `/api/getUsers` | ❌ Obsolete | N/A | Not used anywhere in React frontend |
| `/api/getReviews` | ✅ Migrated | `apiGetMapsReviews` | Completely handled in Code.gs |
| `/api/addReview` | ✅ Migrated | `apiSaveMapsReview` | Completely handled in Code.gs |

### **Endpoints Still Trapped in Express (`server.ts`)**
These endpoints fail in Vercel Production because they attempt to boot `server.ts` which crashes.

1. **`analyzeResiPhoto`**: Hardcoded `fetch("/api/analyzeResiPhoto")` in `TransaksiPage.tsx` and `PreInputPage.tsx`. Uses Gemini Vision logic.
2. **`getAdminDashboardData`**: Hardcoded as a "local action" in `useAppsScript.ts`. Complex data aggregation logic for the Owner Dashboard.
3. **`syncGoogleReviews`**: Hardcoded `fetch("/api/syncGoogleReviews")` in `UlasanMapsPage.tsx`. Google Places API logic.
4. **`analyzeReview`**: Hardcoded `fetch("/api/analyzeReview")` in `UlasanMapsPage.tsx`. Gemini logic.
5. **`deleteReview`**: Hardcoded `fetch("/api/deleteReview")` in `UlasanMapsPage.tsx`. Deletion logic missing in `Code.gs`.

---

# 2. Business Logic Audit (Trapped in `server.ts`)

The following critical business logic blocks need to be ported to `Code.gs`:
*   **Gemini Vision Integration (`analyzeResiPhoto`)**: Parsing base64 images of shipping labels and extracting details via Gemini API.
*   **Google Places API Integration (`syncGoogleReviews`)**: Fetching reviews from Google Maps.
*   **Gemini Text Integration (`analyzeReview`)**: Analyzing sentiment and generating automated replies for reviews.
*   **Admin Dashboard Aggregations (`getAdminDashboardData`)**: Complex reductions and `filterTransactions` calculations that generate the heavy payload.

---

# 3. Migration Priority & Risk Analysis

### Priority
1.  **HIGH (Blocker)**: `getAdminDashboardData`. The OWNER cannot view the dashboard in production.
2.  **HIGH (Core Feature)**: `analyzeResiPhoto`. The OCR feature for parsing receipts is broken in production.
3.  **MEDIUM**: Google Reviews features (`syncGoogleReviews`, `analyzeReview`, `deleteReview`).
4.  **LOW (Cleanup)**: Clean up React to fully utilize GAS and remove the Express architecture to fix the Vercel crash.

### Risks
*   **URL Fetch Limits**: `Code.gs` uses `UrlFetchApp.fetch`. We must ensure it can handle the API keys (Gemini, Google Places) correctly via variables.
*   **Execution Time Limits**: Google Apps Script has a 6-minute execution limit. Aggregating natively in JavaScript arrays in GAS is fast enough, provided we fetch `getDataRange().getValues()` exactly once per sheet.

---

# 4. Refactor Strategy & Step-by-Step Roadmap

### **Phase 1: Port the Remaining Logic to `Code.gs`**
1.  Implement `apiGetAdminDashboardData` in `Code.gs` utilizing the efficient array map/reduce logic.
2.  Implement `apiAnalyzeResiPhoto` using `UrlFetchApp.fetch` to call the Gemini API.
3.  Implement `apiSyncGoogleReviews` and `apiAnalyzeReview` using `UrlFetchApp.fetch`.
4.  Implement `apiDeleteMapsReview`.
5.  Add these new cases to the `handleRouting` switch statement.

### **Phase 2: Update React Frontend to point to GAS**
1.  Remove `"getAdminDashboardData"`, `"analyzeResiPhoto"`, and `"perbaikiAlamatAI"` from the `isLocalAction` bypass list in `src/hooks/useAppsScript.ts`.
2.  Refactor `TransaksiPage.tsx` and `PreInputPage.tsx` to replace `fetch("/api/analyzeResiPhoto")` with `callBackend("analyzeResiPhoto", {...})`.
3.  Refactor `UlasanMapsPage.tsx` to replace manual `fetch` calls with `callBackend`.
4.  Ensure `AdminDashboardPage.tsx` uses `callBackend("getAdminDashboardData")` and matches the response schema exactly.

### **Phase 3: Clean up the Project (Final Vercel Fix)**
1.  Delete `server.ts`.
2.  Remove backend-specific dependencies and Express scripts from `package.json`.
3.  Vercel deployment will become a standard static SPA deployment (`vite build`), completely resolving all Serverless Function crashes.
