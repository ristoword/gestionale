# Direct Goods Receiving – Barcode + Voice

## 1. Created and Modified Files

### Created
| File | Description |
|------|-------------|
| `RECEIVING-DELIVERABLES.md` | This document |

### Modified
| File | Change |
|------|--------|
| `backend/src/repositories/inventory.repository.js` | Added `load()`, `findInventoryItemByBarcode()`, `barcode` in create |
| `backend/src/repositories/stock-movements.repository.js` | Added `receivedBy`, `barcode`, `lot`, `unitCost`, `supplier` to movements |
| `backend/src/controllers/inventory.controller.js` | Added `receive`, `getByBarcode`, `voicePreview`, `parseVoiceReceiving` |
| `backend/src/routes/inventory.routes.js` | Added GET `/barcode/:code`, POST `/receive`, POST `/receive/voice-preview` |
| `backend/src/app.js` | Added `ROLES_INVENTORY` including magazzino |
| `backend/public/magazzino/magazzino.html` | Added "Ricezione merce" tab with barcode form |
| `backend/public/magazzino/magazzino.js` | Added `initReceive()`, barcode lookup, receive submit, voice for receiving |
| `backend/public/magazzino/magazzino.css` | Added receive form styles, badge.load |
| `backend/public/magazzino/magazzino.html` auth-guard | Added magazzino role |
| `backend/public/cucina/cucina.html` | Added "Ricezione merce" view with voice receiving |
| `backend/public/cucina/cucina.js` | Added `initReceiveVoice()`, voice → preview → confirm flow |
| `backend/public/cucina/cucina.css` | Added receive-preview, voice-hint styles |

---

## 2. UI Areas Added

### Magazzino
- **Tab:** "Ricezione merce" (between "Magazzino Centrale" and "Scorta Cucina")
- **Content:**
  - Barcode input (scanner-friendly, Enter to lookup)
  - Product name (prefilled from barcode or manual for new products)
  - Quantity, unit, destination warehouse (central, cucina, sala, bar, proprietà)
  - Received by, lot, unit cost, supplier, notes
  - Checkbox "Crea prodotto se barcode sconosciuto"
  - Microphone button for voice prefill
  - "Registra ricevuta" button
- **Movimenti interni:** Now shows "RICEVUTA" badge for load-type movements

### Cucina
- **Nav:** "Ricezione merce" button (between Ricette and Lista spesa)
- **Content:**
  - "Dettare ricevuta" microphone button
  - Transcript textarea (read-only)
  - Preview section (product, quantity, destination) after parsing
  - "Conferma e registra" / "Annulla" buttons
  - Destination defaults to cucina

---

## 3. Example Barcode Receiving Payload

```json
{
  "barcode": "8012345678901",
  "productName": "Mozzarella",
  "quantity": 2,
  "unit": "kg",
  "destinationWarehouse": "cucina",
  "receivedBy": "chef",
  "lot": "caseificio-14-03",
  "unitCost": 8.50,
  "supplier": "Caseificio Rossi",
  "notes": "Consegna mattutina",
  "createIfUnknown": true
}
```

---

## 4. Example Voice Preview Payload

**Request (POST /api/inventory/receive/voice-preview):**
```json
{
  "transcript": "aggiungi 2 kg mozzarella in cucina"
}
```

**Response:**
```json
{
  "parsed": true,
  "preview": {
    "parsed": true,
    "productName": "mozzarella",
    "quantity": 2,
    "unit": "kg",
    "destinationWarehouse": "cucina"
  },
  "raw": "aggiungi 2 kg mozzarella in cucina"
}
```

---

## 5. Direct Receiving Rule

**Goods may be received directly into central or cucina (or any department) without forcing central first.**

- **Central:** Load goes to `central` warehouse (central stock).
- **Cucina / Bar / Sala / Proprietà:** Load goes directly to that department's stock.
- **No transfer:** This is a direct load from supplier. `fromWarehouse` is `null`.
- **Movement type:** `load` (not `transfer`).

Existing transfer logic (central → department) remains unchanged. Receiving is additive only.

---

## 6. Barcode vs Voice – Operational Difference

| Aspect | Barcode | Voice |
|--------|---------|-------|
| **Primary use** | Magazzino (warehouse receiving) | Cucina (chef hands-busy) |
| **Input** | Scan or type barcode | Dictate phrase |
| **Product resolution** | Lookup by barcode; create if unknown | Parse phrase; always create if unknown |
| **Confirmation** | User fills form and clicks save | System shows parsed preview; user must confirm |
| **Workflow** | Scan → prefill → adjust → save | Dictate → preview → confirm → save |

**Barcode:** Best when products have barcodes and operator can scan. Fast, precise.

**Voice:** Best when operator cannot use hands (e.g. chef holding goods). Requires confirmation; never saves blindly.

---

## 7. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/inventory/barcode/:code` | Lookup product by barcode |
| POST | `/api/inventory/receive` | Direct goods receiving |
| POST | `/api/inventory/receive/voice-preview` | Parse voice transcript (no save) |

---

## 8. Stock Movement Fields (load type)

| Field | Description |
|-------|-------------|
| type | `load` |
| productId, productName | Product reference |
| quantity, unit | Amount received |
| fromWarehouse | `null` (external source) |
| toWarehouse | central, cucina, sala, bar, proprietà |
| sourceModule | magazzino |
| reason | Ricezione merce (or notes) |
| receivedBy | Operator username |
| barcode, lot, unitCost | Optional |
