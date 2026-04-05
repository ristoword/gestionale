# Dump codice rilevante (estratti)

Solo porzioni utili al flusso comande / corsi / servito. **Righe approssimative** riferite al file al momento dell’analisi.

---

## 1. Sala — bozza corsi e invio API

**File:** `backend/public/sala/sala.js`  
**Funzioni:** `pushItemToActiveCourse`, `flattenCourseItemsForApi`, `handleCreateOrder`  
**Righe:** ~176–226, ~1326–1354

```javascript
function pushItemToActiveCourse(tableNum, item) {
  const d = ensureCourseDraft(tableNum);
  if (!d.courses.length) {
    alert("Premi Start nel popup tavolo per creare il Corso 1.");
    return;
  }
  let c = getActiveCourse(tableNum);
  // ...
  c.items.push(row);
  saveCourseDrafts();
}

function flattenCourseItemsForApi(tableNum) {
  const d = ensureCourseDraft(tableNum);
  const out = [];
  for (const c of d.courses) {
    for (const it of c.items) {
      const courseNum = Number(c.n) >= 1 ? Number(c.n) : 1;
      out.push({
        name: it.name,
        qty: it.qty,
        // ...
        course: courseNum,
      });
    }
  }
  return out;
}

/* In cucina il corso in marcia è sempre 1 alla creazione ... */
const draft = ensureCourseDraft(tableNum);
if (draft.courses.length && draft.courses[0]) {
  draft.activeCourseId = draft.courses[0].id;
  saveCourseDrafts();
}
const activeCourseNum = 1;
const payload = {
  // ...
  activeCourse: activeCourseNum,
  items: itemsPayload,
};
```

**Spiegazione:** I piatti portano `course` per ogni riga; alla creazione l’ordine invia **`activeCourse: 1`** e resetta la selezione locale al corso 1.

---

## 2. Sala — popup tavolo e marcia

**File:** `backend/public/sala/sala.js`  
**Funzioni:** `openTablePopup`, handler `next-course`  
**Righe:** ~697–842

```javascript
function openTablePopup(tableNum) {
  popupOpenTable = tableNum;
  // ...
  if (hasPrimaryOpenOrderForCourses(tableNum)) {
    syncCourseDraftFromPrimaryOrder(tableNum);
  }
  // ...
  renderSelectedItems();
}

if (act === "next-course") {
  if (marciaRequestInFlight) return;
  const o = getPrimaryOrderForTableFlow(tableNum);
  // ...
  const next = cur + 1;
  marciaRequestInFlight = true;
  try {
    await apiPatchActiveCourse(o.id, next);
    await loadOrdersAndRender();
    openTablePopup(tableNum);
  } finally {
    marciaRequestInFlight = false;
  }
}
```

**Spiegazione:** La marcia avanza **`activeCourse` sul server** di +1; doppio invio è mitigato da `marciaRequestInFlight`.

---

## 3. Backend — servito e marcia

**File:** `backend/src/service/orders.service.js`  
**Funzioni:** `setStatus`, `setActiveCourse`, `listActiveOrders` + `normalizeOrderActiveCourseForRead`  
**Righe:** ~39–53, ~95–120, ~152–231

```javascript
async function listActiveOrders() {
  // ...
  const filtered = all.filter((o) => {
    const status = String(o.status || "").toLowerCase().trim();
    return !excludeStatuses.includes(status);
  });
  return filtered.map(normalizeOrderActiveCourseForRead);
}

function normalizeOrderActiveCourseForRead(order) {
  const maxC = getMaxCourseFromOrder(order);
  if (maxC == null) return order;
  let ac = Number(order.activeCourse);
  if (!Number.isFinite(ac) || ac < 1) ac = 1;
  if (ac > maxC) ac = maxC;
  return { ...order, activeCourse: ac };
}

async function setStatus(id, status) {
  // ...
  if (String(status || "").toLowerCase() === "servito") {
    const items = Array.isArray(target.items) ? target.items : [];
    if (items.length > 0) {
      const maxCourse = Math.max(...items.map((i) => Number(i.course) || 1));
      let ac = target.activeCourse || 1;
      ac = Math.floor(Number(ac));
      if (!Number.isFinite(ac) || ac < 1) ac = 1;
      if (ac < maxCourse) {
        nextStatus = "in_attesa";
      } else {
        nextStatus = "servito";
      }
    }
  }
  target.status = nextStatus;
  // ...
}

async function setActiveCourse(id, activeCourse) {
  // ...
  if (n > prev) {
    if (n !== prev + 1 && n !== 1) {
      const err = new Error("Marcia: avanza un solo corso alla volta ...");
      err.status = 400;
      throw err;
    }
  }
  target.activeCourse = n;
  // ...
}
```

**Spiegazione:** “Servito” mantiene l’ordine in **`in_attesa`** solo se **`activeCourse < maxCourse`** (da righe). Marcia impedisce salti di corso non validi.

---

## 4. Controller e route

**File:** `backend/src/routes/orders.routes.js`

```javascript
router.post("/", asyncHandler(OrdersController.createOrder));
router.patch("/:id/active-course", asyncHandler(OrdersController.patchActiveCourse));
router.patch("/:id/status", asyncHandler(OrdersController.setStatus));
```

---

## 5. Cucina — filtro e evidenziazione corso

**File:** `backend/public/cucina/cucina.js`  
**Funzioni:** `buildCourseBlocksHtml`, `renderKdsColumns`  
**Righe:** ~193–227, ~341–344

```javascript
function buildCourseBlocksHtml(order) {
  const activeCourse = Number(order.activeCourse) >= 1 ? Number(order.activeCourse) : 1;
  // ...
  if (cn === activeCourse) courseCls = "kds-course-active";
  else if (cn < activeCourse) courseCls = "kds-course-past";
      // ...
}

const active = orders.filter(
  (o) => o.status !== "chiuso" && o.status !== "annullato" && o.status !== "servito"
);
```

**Spiegazione:** Ordini con **`status servito`** non compaiono in cucina; il corso “acceso” è **`order.activeCourse`**.

---

## 6. MySQL — serializzazione extra

**File:** `backend/src/repositories/mysql/orders.repository.mysql.js`  
**Funzioni:** `buildOrderExtraForDb`, `itemToDbRow`  
**Righe:** ~35–88

```javascript
function buildOrderExtraForDb(order) {
  const ex = {};
  for (const [k, v] of Object.entries(order || {})) {
    if (!ORDER_EXTRA_SKIP.has(k)) ex[k] = v;
  }
  return Object.keys(ex).length ? ex : null;
}

function itemToDbRow(restaurantId, orderId, idx, line) {
  const l = line || {};
  const { name, qty, area, category, type, notes, ...rest } = l;
  const extra = Object.keys(rest).length ? JSON.stringify(rest) : null;
  return [ /* ... */, extra ];
}
```

**Spiegazione:** `activeCourse` e altri campi ordine finiscono in `orders.extra`; `course` sulla riga in `order_items.extra`.
