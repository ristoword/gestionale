# Cassa / Z Closure – Technical Audit Report

**Date:** 2026-03-11  
**Scope:** Cash register closure flow, Apri Cassa, Chiusura Z, order archival, supervisor view

---

## 1. Executive Summary

**Ristoword has a real Z closure flow.** The system implements backend logic for daily cash closure, persisted shift state, and proper order visibility rules. The "Apri Cassa" and "Chiusura Z" buttons are separate; the former does not become the latter. Both trigger real backend APIs. Closure records are stored; closed orders disappear from active views; new payments are blocked after Z.

---

## 2. Answers to Expected Questions

| # | Question | Answer |
|---|----------|--------|
| 1 | Does Ristoword already have a real Z closure flow? | **Yes.** `POST /api/payments/z-report` exists and performs full closure logic. |
| 2 | Is the "Apri Cassa" button stateful and persisted? | **Yes.** Shift state is stored in `pos-shifts.json` (tenant). |
| 3 | After opening cassa, does the button become a closure/Z action? | **No.** "Apri Cassa" and "Chiusura Z" are **separate buttons**. Both are visible in the header. Apri Cassa does not morph into Chiudi Z. |
| 4 | Is there backend logic for daily closure or only frontend UI? | **Yes, real backend logic.** `payments.service.zReport()` closes shifts, creates closure record, prevents duplicate Z. |
| 5 | Are closure totals stored anywhere? | **Yes.** `closures.json` (tenant) stores date, cashTotal, cardTotal, otherTotal, grandTotal, closedAt, closedBy, notes. |
| 6 | After Z, do closed tables/orders disappear from active Sala/Cassa/Supervisor views? | **Yes.** Orders with status `chiuso` are excluded by `listActiveOrders()`. Table closure (Chiudi tavolo) sets status to `chiuso` immediately; Z blocks new payments for the day. |
| 7 | Are they still available in daily history? | **Yes.** `GET /api/orders/history?date=YYYY-MM-DD` returns orders by date regardless of status. |
| 8 | If Z is missing or partial, exactly what is missing? | **Nothing critical.** Z is implemented. See section 6 for minor notes. |
| 9 | Which files govern this logic? | See section 3. |
| 10 | What is the minimum safe fix if needed? | No fix required. Optional improvements listed in section 7. |

---

## 3. Files Involved

### Frontend (Cassa)
| File | Role |
|------|------|
| `backend/public/cassa/cassa.html` | UI: Apri Cassa, Chiusura Z, Cambio Turno, Chiusura Parziale; modals; Report tab; Storico chiusure Z |
| `backend/public/cassa/cassa.js` | Calls `/api/payments/open`, `/api/payments/z-report`, `/api/closures/check/:date`, `/api/payments/current-shift`; renderDayStatus, renderShiftStatus; Chiudi tavolo → createPayment |

### Backend
| File | Role |
|------|------|
| `backend/src/controllers/payments.controller.js` | `openShift`, `shiftChange`, `partialClose`, `zReport`, `getCurrentShift`, `createPayment` (checks `isDayClosed`) |
| `backend/src/controllers/closures.controller.js` | `checkDateClosed`, `getClosureByDate`, `listClosures`, `exportClosure`, `computeDayTotals` |
| `backend/src/routes/payments.routes.js` | `POST /open`, `POST /z-report`, `POST /shift-change`, `POST /partial-close`, `GET /current-shift` |
| `backend/src/routes/closures.routes.js` | `GET /check/:date`, `GET /:date`, `GET /` (list), `GET /:date/export` |
| `backend/src/service/payments.service.js` | `openShift`, `shiftChange`, `partialClose`, `zReport`, `getCurrentShift` |
| `backend/src/repositories/closures.repository.js` | `createClosure`, `getClosureByDate`, `isDayClosed`, `listClosures` |
| `backend/src/repositories/pos-shifts.repository.js` | `getOpenShift`, `createShift`, `closeShift`, `getShiftsByDate` |
| `backend/src/repositories/payments.repository.js` | Payments CRUD, `listPayments`, `findByOrderIds` |
| `backend/src/service/orders.service.js` | `listActiveOrders` (excludes chiuso, annullato, etc.) |
| `backend/src/controllers/orders.controller.js` | `listOrders` (uses `active=true` → `listActiveOrders`) |

### Data (tenant-aware)
| File | Role |
|------|------|
| `data/tenants/{id}/closures.json` | Closure records (date, totals, closedAt, closedBy) |
| `data/tenants/{id}/pos-shifts.json` | Shifts (opened_at, closed_at, operator, opening_float, status) |
| `data/tenants/{id}/payments.json` | Payment records (table, orderIds, total, paymentMethod, closedAt) |
| `data/tenants/{id}/orders.json` | Orders (status chiuso when table closed) |

---

## 4. Current Real Cassa/Z Behavior

### A. UI Flow
- **Apri Cassa** (`rw-btn-open-shift`): Opens modal → operator + float → `POST /api/payments/open`. Backend creates shift in `pos-shifts.json` with `status: "open"`.
- **Chiusura Z** (`rw-btn-z-closure`): Opens modal → counted cash, operator, notes → `POST /api/payments/z-report`. Backend closes open shift, creates closure in `closures.json`.
- **Chiusura Z visibility:** Shown only when `isManagerAuthorizedForZ(session)` (cassa or supervisor). Requires manager login via Staff Access.
- **Giornata status:** Fetched from `GET /api/closures/check/:dateISO` and `GET /api/closures/:date`. Displayed as "Z chiusa • HH:mm • operator" or "Aperta".

### B. Backend Z Flow (`zReport`)
1. Check if day already closed → 409 if yes.
2. If shift open: close it (counted_cash, computed card/other from payments).
3. Get day shifts (by `opened_at` date), sum cash/card/other from closed shifts.
4. Create closure record: date, cashTotal, cardTotal, otherTotal, grandTotal, paymentsCount, closedOrdersCount, closedAt, closedBy, notes.
5. Return closure. Broadcast supervisor sync.

### C. Order Visibility
- **Active** (`/api/orders?active=true`): Excludes `chiuso`, `annullato`, `closed`, `cancelled`, `archived`, `pagato`, `paid`. Used by Sala, Cassa, Cucina, Bar, Pizzeria, Supervisor, Dashboard.
- **History** (`/api/orders/history?date=YYYY-MM-DD`): All orders for that date, any status.
- **Chiudi tavolo** in Cassa: `createPayment` → `ordersService.setStatus(oid, "chiuso")` for each order → orders immediately excluded from active.

### D. Post-Z Behavior
- `createPayment` checks `closuresRepository.isDayClosed(paymentDateStr)` before creating. If closed → 409.
- Frontend also checks `fetchDayStatus(todayISO()).closed` before Chiudi tavolo and shows alert.
- No new payments or table closures for that date after Z.

---

## 5. What Is Missing or Unclear

### Minor / Optional
1. **Button UX:** "Apri Cassa" and "Chiusura Z" are always both visible (when authorized). Some users may expect "Apri Cassa" to toggle to "Chiudi Z" when the shift is open. Current design uses separate actions.
2. **Z grandTotal source:** In `zReport`, grandTotal is derived from shift totals (cash from counted, card/other from payments). For shifts that span midnight, the day attribution is by `opened_at`; edge cases exist but are uncommon.
3. **Closure history refresh:** The "Storico chiusure Z" uses `fetchClosureHistory()` and refresh button; it loads from `/api/closures?dateFrom=&dateTo=` correctly.

### Nothing Critical
The Z closure is **functionally complete**. Orders are properly finalized (chiuso) at table closure; they leave the active view; Z blocks new payments; closure data is stored.

---

## 6. Minimum Safe Correction (If Needed)

**No mandatory fix.** The flow works as designed.

**Optional improvements (non-breaking):**
1. **Pre-fill Z modal:** When opening Chiusura Z, call `GET /api/payments/partial-close` (or similar) to pre-fill expected totals and counted cash suggestion.
2. **Closure preview before Z:** Use `GET /api/closures/preview/:date` to show totals before the user confirms Z.
3. **UX clarification:** Add a short hint under "Chiusura Z" explaining that it closes the day and blocks new payments.

---

## 7. Data Flow Summary

```
Apri Cassa    → POST /api/payments/open        → pos-shifts.json (status: open)
Chiudi tavolo → POST /api/payments             → payments.json + orders.status=chiuso
Chiusura Z    → POST /api/payments/z-report    → closures.json + shift status=closed

GET /api/orders?active=true  → listActiveOrders() → excludes chiuso
GET /api/closures/check/:d   → isDayClosed()      → blocks new payments if true
```

---

## 8. Conclusion

The Cassa Z closure is **implemented and operational**. Backend logic is real; data is persisted; order visibility and payment blocking work correctly. The only nuance is that "Apri Cassa" and "Chiusura Z" are separate buttons, not a single stateful control—this is a design choice, not a bug.
