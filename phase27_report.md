# PHASE 27 — AUDIT TRAIL & EVIDENCE ENGINE REPORT

## 1. Files Changed
- `src/lib/auditTrailEngine.ts`: Core Audit Trail Engine implementing standard audit event schema, redaction helper (`redactSensitiveData`), central writer (`logAuditEvent`, `recordAuditEvent`), audit queries (`getAuditTrail`), idempotency protection, and timeline reconstruction (`reconstructTransactionHistory`).
- `server.ts`: Integrated audit trail logging into transaction lifecycle state transitions, customer upserts, login/authentication, financial setoran operations (creation, approval, rejection), and Audit Engine executions. Exposed dedicated audit endpoints (`/api/auditTrail`, `/api/getAuditTrail`, `/api/getAuditTrailByTransaction`, `/api/getAuditTrailByCustomer`, `/api/getAuditTrailByImport`, `/api/reconstructTransactionHistory`). Exported domain helpers for runtime testing.
- `test_phase27_audit_trail.ts`: 20-case test suite validating all Phase 27 requirements.
- `phase27_report.md`: Complete evidence report.

---

## 2. Audit Event Contract
Every audit record stored in `db.AuditLogs` conforms to the following standardized contract:
```typescript
export interface AuditEventInput {
  id?: string;
  audit_id?: string;
  created_at?: string;
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  outlet_id?: string;
  outlet_name?: string;
  entity_type: string;
  entity_id?: string;
  transaksi_id?: string;
  pengiriman_id?: string;
  import_id?: string;
  event_type: string;
  action: string;
  previous_status?: string;
  new_status?: string;
  before?: any;
  after?: any;
  result: "SUCCESS" | "REJECTED" | "FAILED" | "WARNING" | "CRITICAL";
  source?: string;
  route?: string;
  correlation_id?: string;
  reason?: string;
  error_code?: string;
  metadata?: any;
}
```

---

## 3. Event Types
Supported standardized event types:
- **Authentication**: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`
- **Customer**: `CUSTOMER_CREATED`, `CUSTOMER_UPDATED`, `CUSTOMER_VIEWED`
- **Import**: `IMPORT_PREVIEW`, `IMPORT_STARTED`, `IMPORT_COMPLETED`, `IMPORT_FAILED`
- **Transaction**: `TRANSACTION_CREATED`, `TRANSACTION_UPDATED`, `TRANSACTION_CANCELLED`, `TRANSACTION_LIFECYCLE_CHANGED`, `LIFECYCLE_TRANSITION`, `LIFECYCLE_REJECTED`
- **Shipment**: `SHIPMENT_CREATED`, `SHIPMENT_UPDATED`, `SHIPMENT_STATUS_CHANGED`
- **Financial**: `SETORAN_CREATED`, `SETORAN_APPROVED`, `SETORAN_REJECTED`, `FINANCIAL_ADJUSTMENT`
- **Audit Engine**: `AUDIT_EXECUTED`, `AUDIT_WARNING`, `AUDIT_ERROR`, `AUDIT_CRITICAL`

---

## 4. Actor Tracking
Audit records capture actor details:
- `actor_id`: User ID or `"SYSTEM"`
- `actor_name`: User name or `"System"`
- `actor_role`: `"OWNER"`, `"ADMIN"`, or `"SYSTEM"`
- `outlet_id`: Home/assigned outlet ID
- `outlet_name`: Outlet name

---

## 5. Entity Tracking
Events link directly to domain entities:
- `entity_type`: `"TRANSACTION"`, `"SHIPMENT"`, `"CUSTOMER"`, `"IMPORT"`, `"SETORAN"`, `"AUTHENTICATION"`, `"DAILY_AUDIT"`
- `entity_id`: Primary ID of the target entity
- `transaksi_id`, `pengiriman_id`, `import_id`: Contextual foreign keys for correlation

---

## 6. Before / After Mechanism
State-changing operations capture `before` and `after` field snapshots. Sensitive fields are redacted automatically prior to persistence using `redactSensitiveData()`.

---

## 7. Transaction Lifecycle Integration
Integrated with Phase 21 Operational Engine state validations:
- State changes log `LIFECYCLE_TRANSITION` / `TRANSACTION_LIFECYCLE_CHANGED` with `previous_status` and `new_status`.
- Invalid state transitions log `LIFECYCLE_REJECTED` with `result = "REJECTED"` and the exact validation reason without changing transaction state.

---

## 8. Financial Evidence
Integrated with Financial Engine setoran workflow:
- `SETORAN_CREATED`: Logged when setoran is submitted.
- `SETORAN_APPROVED`: Logged when setoran is approved by Owner.
- `SETORAN_REJECTED`: Logged when setoran is rejected by Owner with `reason`.

---

## 9. Import Integration
Import sessions track import lifecycle events linked via `import_id`:
- `IMPORT_PREVIEW`
- `IMPORT_STARTED`
- `IMPORT_COMPLETED`
- `IMPORT_FAILED`

---

## 10. Audit Engine Integration
Integrates Phase 26 Audit Engine outputs:
- Logged under `AUDIT_EXECUTED` (or `AUDIT_WARNING`, `AUDIT_ERROR`, `AUDIT_CRITICAL`) with score, issue lists, and audit status stored in `metadata`.

---

## 11. Persistence Mechanism
Uses `db.AuditLogs` in JSON DB (`readDb()` / `writeDb()`). Appends new records using `unshift` to guarantee append-only immutability. No existing audit records are updated or overwritten.

---

## 12. Idempotency Mechanism
Checks combination of `correlation_id` + `event_type` + entity identifier (`transaksi_id`, `pengiriman_id`, `import_id`, `entity_id`). Re-executing identical requests returns the existing audit log without creating duplicate rows.

---

## 13. Security / Redaction
`redactSensitiveData()` recursively sanitizes objects/arrays before storage, replacing keys containing `"password"`, `"token"`, `"access_token"`, `"refresh_token"`, `"secret"`, `"credential"`, `"api_key"`, `"pin"`, or `"otp"` with `"[REDACTED]"`.

---

## 14. Endpoint List
- `POST /api/auditTrail` & `POST /api/getAuditTrail`: Retrieve audit records with optional filters (`transaksi_id`, `correlation_id`, `import_id`, `actor_id`, `entity_id`, `entity_type`, `tanggal`, `event_type`, `outlet_id`, `result`).
- `POST /api/getAuditTrailByTransaction`: Query logs by `transaksi_id`.
- `POST /api/getAuditTrailByCustomer`: Query logs by `customer_id` or `entity_id`.
- `POST /api/getAuditTrailByImport`: Query logs by `import_id`.
- `POST /api/reconstructTransactionHistory`: Reconstructs chronological audit timeline for a transaction ordered ascending by timestamp.

---

## 15. Test Matrix
| Test Case | Description | Mode | Status |
|---|---|---|---|
| TEST 1 | Create transaction -> audit event created | RUNTIME | PASS |
| TEST 2 | Update transaction -> BEFORE/AFTER recorded | RUNTIME | PASS |
| TEST 3 | Lifecycle transition valid -> event SUCCESS | RUNTIME | PASS |
| TEST 4 | Lifecycle transition invalid -> event REJECTED | RUNTIME | PASS |
| TEST 5 | Transaction cancelled -> event CANCELLED | RUNTIME | PASS |
| TEST 6 | Customer created -> CUSTOMER_CREATED | RUNTIME | PASS |
| TEST 7 | Customer updated -> BEFORE/AFTER | RUNTIME | PASS |
| TEST 8 | Import preview -> IMPORT_PREVIEW | RUNTIME | PASS |
| TEST 9 | Import completed -> IMPORT_COMPLETED | RUNTIME | PASS |
| TEST 10 | Import failed -> IMPORT_FAILED | RUNTIME | PASS |
| TEST 11 | Shipment created -> SHIPMENT_CREATED | RUNTIME | PASS |
| TEST 12 | Setoran created -> SETORAN_CREATED | RUNTIME | PASS |
| TEST 13 | Setoran approved -> SETORAN_APPROVED | RUNTIME | PASS |
| TEST 14 | Audit Engine execution -> AUDIT_EXECUTED | RUNTIME | PASS |
| TEST 15 | Failed operation -> FAILED audit event | RUNTIME | PASS |
| TEST 16 | Duplicate request -> no duplicate audit event | RUNTIME | PASS |
| TEST 17 | Sensitive data redaction | RUNTIME | PASS |
| TEST 18 | Transaction timeline reconstruction | RUNTIME | PASS |
| TEST 19 | Audit query by transaksi_id | RUNTIME | PASS |
| TEST 20 | Audit query by import_id | RUNTIME | PASS |

---

## 16. Regression Result
- `npx tsx test_phase27_audit_trail.ts`: 20/20 PASSED (100%)
- `npx tsx run_all_tests.ts`: PASSED
- `npx tsc --noEmit` (`npm run lint`): PASSED (0 errors)
- `npm run build` (`compile_applet`): BUILD SUCCEEDED

---

## 17. Known Limitations
- Append-only immutability is enforced at application runtime level over JSON storage (`db.AuditLogs`). Cryptographic block-hashing / hardware WORM storage is not enabled (conforming to YAGNI guidelines).
