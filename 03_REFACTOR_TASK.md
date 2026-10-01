# JNT OPS PRO --- MASTER ROADMAP

## Tujuan

Dokumen ini adalah **Master Roadmap + Architecture Contract** untuk
pembangunan JNT OPS PRO oleh Bos Akmal bersama ChatGPT dan Claude AI.

Prinsip utama:

> **Setoran = uang**\
> **Audit = resi**\
> **Daily Closing = status hari**

Google Spreadsheet adalah **Business SSOT**. Apps Script (`Code.gs`)
adalah backend/database manager. Jangan membuat financial engine kedua
hanya untuk fitur baru.

------------------------------------------------------------------------

# 1. Dua Alur yang Wajib Dipisahkan

## A. Historical Backfill

``` text
Bulk Import YoYi
        ↓
Lengkapi Transaksi
        ↓
Daily Closing
        ↓
Setoran ADMIN → OWNER
```

**Bulk Import YoYi = historical backfill/seeding.**

Tujuannya memasukkan histori sejak outlet mulai beroperasi, termasuk
data customer.

**Bulk Import YoYi bukan sumber Audit YoYi.**

## B. Operational Daily Flow

``` text
Import YoYi per Resi / Transaksi
        ↓
Audit YoYi
        ↓
Lengkapi Transaksi
        ↓
Daily Closing
        ↓
Setoran ADMIN → OWNER
```

**Import YoYi per resi = operasional ADMIN.**

**Audit YoYi = control layer** untuk menjawab:

> Apakah semua resi YoYi yang sudah berstatus **Diserahkan** pada
> tanggal tersebut sudah masuk ke JNT OPS PRO?

Audit tidak mengaudit Bulk Import.

------------------------------------------------------------------------

# 2. Arsitektur SSOT

Sheet utama:

-   `MASTER_TRANSAKSI`
-   `EXP_Resi`
-   `CRG_Resi`
-   `MASTER_PENGIRIMAN`
-   `KEUANGAN_OUTLET`
-   `MASTER_OUTLET`
-   `Users`
-   `YOYI_RAW`
-   `Master_Setoran`
-   `Setoran_Realization`
-   `AuditYoyiBatch`

Arsitektur:

``` text
React
  ↓
useAppsScript
  ↓
server.ts
  ↓
Code.gs / DatabaseService
  ↓
Google Spreadsheet
```

Financial Engine tetap menjadi satu-satunya sumber perhitungan
finansial.

------------------------------------------------------------------------

# 3. Financial Contract

-   `owner_deposit` = hak ekonomi OWNER.
-   `cash_payment` = uang fisik yang harus disetor ADMIN.
-   `digital_payment` = pembayaran digital milik OWNER.
-   `expected_cash` = kewajiban setoran fisik.
-   actual settlement = realisasi setoran.

Setoran dihitung berdasarkan:

``` text
ADMIN + OUTLET + TANGGAL TRANSAKSI
```

Satu kewajiban dapat mempunyai beberapa realization:

``` text
TRANSFER
TUNAI
KAS_OUTLET
```

Status settlement:

``` text
BELUM SETOR
SEBAGIAN
MENUNGGU APPROVAL OWNER
LUNAS
KURANG SETOR
LEBIH SETOR
```

------------------------------------------------------------------------

# 4. Roadmap

## Phase 0 --- Architecture & SSOT Audit

**Status: SELESAI + maintenance**

Database schema, API boundary, auth/outlet context, financial engine,
settlement architecture.

## Phase 1 --- Core Transaction & Financial Engine

**Status: SELESAI**

Input transaksi, resi, financial calculation, cash/digital, DFOD,
rounding, promo/discount.

## Phase 2 --- YoYi Import & Historical Backfill

**Status: SELESAI**

Bulk Import YoYi, parser, duplicate protection, historical seeding,
customer/address auto-upsert, timestamp separation, schema alignment.

Kontrak:

> Bulk Import = historical backfill.

## Phase 3 --- Lengkapi Transaksi

**Status: ONGOING / target operasional**

Per tanggal:

``` text
01 Sep ✓
02 Sep ✓
03 Sep ⚠
...
16 Sep ⚠
```

Field:

-   nominal customer
-   metode pembayaran
-   bukti pembayaran
-   biaya lain-lain
-   metode pembayaran tambahan
-   bukti tambahan
-   Maps 5★
-   bukti Maps

Status:

``` text
LENGKAP
BELUM LENGKAP
```

## Phase 4 --- Daily Closing

**Status: STABIL**

Daily Closing adalah kontrol tanggal.

Tidak boleh menghitung ulang financial engine.

## Phase 5 --- Setoran ADMIN → OWNER

**Status: PRODUCTION PILOT**

Flow:

``` text
Kewajiban Setoran
      ↓
Realization
      ↓
OWNER Review
      ↓
Approve / Reject
```

## Phase 6 --- AUDIT YOYI + OPERATIONAL CONTROL

**Status: NEXT BUILD TARGET**

Ini adalah **roadmap poin 6** yang harus dibangun bersama ChatGPT +
Claude.

------------------------------------------------------------------------

# 5. Phase 6 --- Audit YoYi

## Tujuan

Memastikan seluruh resi YoYi yang sudah **Diserahkan** benar-benar sudah
diinput ADMIN ke JNT OPS PRO.

Audit tidak membuat transaksi.

Audit tidak menggantikan Bulk Import.

Audit tidak menjadi financial engine.

Audit adalah comparator/control layer.

## Sumber Audit

Sumber:

**Rincian Serah Terima YoYi**

Bukan:

-   Bulk Import YoYi
-   historical seed
-   Daily Closing

YoYi dapat mempunyai banyak batch serah terima dalam satu hari.

Tanggal audit harus ditentukan dari `waktu_serah_terima` pada resi,
bukan sekadar row batch.

## Ecommerce

Prefix:

``` text
JY
JX
JZ
```

ditandai:

``` text
DILEWATI (Ecommerce)
```

dan tidak masuk completeness audit.

------------------------------------------------------------------------

# 6. AuditYoyiBatch

Schema:

``` text
id
outlet_id
admin_id_terkait
tanggal_serah_terima
resi_id
sumber_order
waktu_pemesanan
metode_perhitungan
status_waybill
waktu_serah_terima
operator_yoyi
total_yoyi
imported_by
imported_at
```

Data disimpan per-resi agar satu batch yang melintasi tanggal tetap
dapat diaudit dengan benar.

------------------------------------------------------------------------

# 7. Screenshot / OCR Flow

OWNER upload satu atau beberapa screenshot.

``` text
Upload Screenshot
      ↓
Gemini Vision
      ↓
Extract Rows
      ↓
Merge
      ↓
Deduplicate resi_id
      ↓
Mark JY/JX/JZ
      ↓
Preview
      ↓
OWNER Correction
      ↓
Confirm
      ↓
AuditYoyiBatch
```

Reuse pattern existing:

``` text
/api/parseYoYiScreenshot
getGeminiClient
generateGeminiContentWithFallback
```

**Jangan membuat OCR engine baru.**

------------------------------------------------------------------------

# 8. Audit Completeness

Per tanggal + outlet:

``` text
AuditYoyiBatch
       VS
MASTER_TRANSAKSI
EXP_Resi
CRG_Resi
```

Untuk setiap resi non-ecommerce:

Jika ada di YoYi tetapi tidak ada di JNT OPS PRO:

``` text
CRITICAL
```

Pesan:

``` text
Resi belum diinput ke sistem
```

Tampilkan daftar resi yang hilang.

Audit tidak otomatis membuat transaksi.

------------------------------------------------------------------------

# 9. Audit Payment Correctness

Untuk resi yang ditemukan:

Bandingkan `total_yoyi` dengan nilai internal menggunakan **financial
engine existing**.

Discount hanya valid jika:

``` text
is_potential_vip_promo = true
AND
PromoReviewValidation = APPROVED
```

Jika discount belum approved, jangan menganggap discount valid hanya
karena ada angka discount di YoYi.

Jika total YoYi sudah discounted tetapi internal discount belum
approved:

``` text
AUDIT EXCEPTION
```

Metode pembayaran juga diperiksa.

Contoh:

``` text
YoYi = DFOD
Internal = NON-DFOD
```

→ exception.

------------------------------------------------------------------------

# 10. Integrasi Existing Audit Engine

Jangan membuat audit engine kedua.

Trace dan reuse:

``` text
src/lib/auditEngine.ts
src/components/OwnerAuditPage.tsx
```

Tetap gunakan:

``` text
VALID
WARNING
ERROR
CRITICAL
```

dan:

``` text
owner_audit_status
owner_audit_note
```

Audit YoYi harus menjadi perluasan existing audit architecture.

------------------------------------------------------------------------

# 11. Setoran Gate

Sebelum `approveSetoran` mengubah header menjadi `DISETUJUI`:

``` text
ADMIN Setoran
      ↓
OWNER Review
      ↓
Audit YoYi Check
      ↓
APPROVE / BLOCK
```

### CRITICAL

Jika ada CRITICAL:

``` text
BLOCK APPROVAL
```

Tampilkan jumlah + daftar resi.

### WARNING

WARNING tidak otomatis memblokir.

OWNER tetap dapat mengambil keputusan.

### Tidak ada AuditYoyiBatch

Jangan block.

Tampilkan:

``` text
Audit YoYi belum dilakukan untuk tanggal ini.
```

sebagai warning.

### Wajib trace join key terlebih dahulu

Jangan mengasumsikan:

``` text
tanggal_serah_terima
=
tanggal_transaksi
=
tanggal_setoran
```

Trace:

``` text
YoYi handover timestamp
        ↓
resi_id
        ↓
internal transaction
        ↓
tanggal_transaksi
        ↓
admin_id
        ↓
outlet_id
        ↓
kewajiban setoran
```

Baru setelah join key terbukti stabil, gate boleh diterapkan.

------------------------------------------------------------------------

# 12. Admin Control

Jika tanggal memiliki CRITICAL:

Lengkapi Transaksi / Admin Dashboard menampilkan:

``` text
X resi belum diinput
JD...
JD...
```

Audit tidak otomatis membuat transaksi.

ADMIN tetap melakukan input transaksi melalui workflow normal.

------------------------------------------------------------------------

# 13. Phase 7 --- Data Customer & Customer Analysis

**Status: NEXT**

Setelah transaksi operasional lengkap:

``` text
Sender / Recipient
        ↓
Customer SSOT
        ↓
Data Customer
        ↓
Customer Analysis
```

Jangan membuat database customer kedua.

------------------------------------------------------------------------

# 14. Phase 8 --- Rekonsiliasi & Financial Control

Fokus:

-   cash variance
-   settlement outstanding
-   owner entitlement
-   digital payment
-   kas outlet
-   transfer
-   anomaly
-   YoYi vs internal reconciliation

------------------------------------------------------------------------

# 15. Phase 9 --- Owner Control Tower

Dashboard OWNER:

``` text
TODAY
├── Resi YoYi belum diinput
├── Audit WARNING
├── Audit CRITICAL
├── Transaksi belum lengkap
├── Setoran belum masuk
├── Setoran kurang
├── Setoran menunggu approval
├── Kas Outlet anomaly
└── Daily Closing belum selesai
```

Dashboard membaca hasil control layer; jangan membuat calculation engine
baru.

------------------------------------------------------------------------

# 16. Phase 10 --- Reporting & BI

Setelah operational data stabil:

-   omzet
-   cash
-   owner deposit
-   kas outlet
-   performa admin
-   performa outlet
-   customer repeat
-   Maps review
-   seller analysis
-   YoYi reconciliation
-   trend harian/bulanan

------------------------------------------------------------------------

# 17. Contract Kerja Claude AI

Claude harus memperlakukan dokumen ini sebagai:

> **ROADMAP + ARCHITECTURE CONTRACT**

Sebelum coding:

1.  Trace execution path.
2.  Baca file existing yang relevan.
3.  Cari implementation existing.
4.  Identifikasi SSOT.
5.  Identifikasi API boundary.
6.  Identifikasi schema.
7.  Identifikasi side effect.
8.  Baru patch.

Jangan langsung refactor besar.

Jika bug dapat diselesaikan dengan patch kecil, gunakan patch kecil.

Hindari:

-   engine baru
-   database kedua
-   API duplicate
-   schema duplicate
-   speculative abstraction
-   UI redesign unrelated
-   perubahan financial engine tanpa alasan bisnis yang jelas

------------------------------------------------------------------------

# 18. Contract Phase 6 untuk Claude

Jika Claude diminta membangun Phase 6, urutannya:

### FIX 1 --- Persistence

Trace dan implementasikan `AuditYoyiBatch`.

### FIX 2 --- OCR + Preview

Implementasikan screenshot parser menggunakan pattern OCR existing.

### FIX 3 --- Audit Comparison

Perluas `auditEngine.ts` untuk:

``` text
YoYi Diserahkan
VS
JNT OPS PRO transaction
```

### FIX 4 --- Settlement Gate

Integrasikan hasil CRITICAL ke `approveSetoran`.

### FIX 5 --- Admin Warning

Tampilkan resi yang belum diinput.

Setiap FIX wajib melaporkan:

``` text
Files changed
Execution path
Root cause / reason
Schema/API impact
Regression risk
Test result
```

**STOP setelah acceptance criteria Phase 6 PASS.**

------------------------------------------------------------------------

# 19. Contract Kerja ChatGPT + Claude

## ChatGPT

Bertindak sebagai:

**Architecture / Business Controller**

Menjaga:

-   business semantics
-   roadmap
-   SSOT
-   financial contract
-   menu boundary
-   acceptance criteria
-   root cause
-   scope control

## Claude

Bertindak sebagai:

**Codebase Investigator / Implementer**

Tugas:

-   inspect repository
-   trace execution
-   implement patch
-   build/test
-   report exact changes

Workflow:

``` text
ChatGPT menentukan contract
        ↓
Claude trace code
        ↓
Claude implement
        ↓
Claude test
        ↓
ChatGPT review
        ↓
Correction prompt jika diperlukan
        ↓
Next FIX
```

------------------------------------------------------------------------

# 20. Acceptance Gate Phase 6

Phase 6 hanya dianggap selesai jika:

### A --- Multi Screenshot

2+ screenshot dapat:

``` text
merge PASS
dedupe PASS
```

### B --- OCR Correction

OWNER dapat mengoreksi hasil OCR sebelum commit.

### C --- Missing Resi

Resi YoYi yang tidak ada di sistem:

``` text
CRITICAL
```

dan terlihat di OwnerAudit + Admin warning.

### D --- Discount Validation

VIP/EZ:

``` text
APPROVED → discount valid
NOT APPROVED → discount tidak valid untuk expected comparison
```

### E --- Settlement Gate

Ada CRITICAL:

``` text
approveSetoran = BLOCK
```

### F --- No Audit

Tidak ada AuditYoyiBatch:

``` text
warning only
approval tetap dapat berjalan
```

### G --- Regression

Tetap PASS:

-   Bulk Import YoYi
-   Lengkapi Transaksi
-   Daily Closing
-   Setoran
-   Ulasan Maps
-   Kas Outlet
-   financial regression

------------------------------------------------------------------------

# 21. Status Board

  Phase   Modul                                    Status
  ------- ---------------------------------------- -----------------------
  0       Architecture / SSOT                      SELESAI + maintenance
  1       Core Transaction + Financial Engine      SELESAI
  2       Bulk Import YoYi / Historical Backfill   SELESAI
  3       Lengkapi Transaksi                       ONGOING
  4       Daily Closing                            STABIL
  5       Setoran ADMIN → OWNER                    PRODUCTION PILOT
  6       Audit YoYi + Operational Control         **NEXT BUILD TARGET**
  7       Data Customer + Customer Analysis        NEXT
  8       Rekonsiliasi + Financial Control         NEXT
  9       Owner Control Tower                      NEXT
  10      Reporting + BI                           FUTURE

------------------------------------------------------------------------

# 22. Master Principle

JNT OPS PRO harus dibangun sebagai **satu sistem operasional**, bukan
kumpulan fitur terpisah.

Setiap fitur baru wajib menjawab:

1.  Apa masalah operasionalnya?
2.  Apa SSOT-nya?
3.  Siapa yang input?
4.  Siapa yang verifikasi?
5.  Data apa yang berubah?
6.  Data apa yang hanya dibaca?
7.  Apa dampaknya ke Daily Closing?
8.  Apa dampaknya ke Setoran?
9.  Apa acceptance test-nya?
10. Apa regression yang harus tetap PASS?

Untuk Phase 6, pertanyaan utamanya:

> **Apakah semua resi YoYi yang sudah Diserahkan pada tanggal tersebut
> sudah masuk ke JNT OPS PRO melalui operasional ADMIN?**

Jika belum, sistem harus membuat resi tersebut terlihat jelas sebelum
settlement OWNER dianggap aman.
