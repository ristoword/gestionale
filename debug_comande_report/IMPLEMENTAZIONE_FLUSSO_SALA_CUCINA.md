# Implementazione flusso sala / cucina multi-corso

Data: 2026-04-01

## 1. File modificati

| File | Ruolo |
|------|--------|
| `backend/src/service/orders.service.js` | Logica `courseStates`, servito sequenziale, creazione ordine |
| `backend/public/sala/sala.js` | Pannello corsi principale, popup semplificato, invio comanda, auto-Start |
| `backend/public/sala/sala.html` | Nuova card “Corsi (tavolo attivo)” |
| `backend/public/sala/sala.css` | Stili pannello corsi e badge stato |
| `backend/public/cucina/cucina.js` | Etichette stato per corso, hint “Corso operativo” |
| `backend/public/cucina/cucina.css` | Badge stato corso in KDS |

## 2. Cosa è cambiato per file

### `orders.service.js`

- Introdotto **`order.courseStates`**: oggetto con chiavi `"1"`, `"2"`, … e valori `queued` | `in_attesa` | `in_preparazione` | `pronto` | `servito`.
- Introdotto opzionale **`courseFlowVersion: 1`** sugli ordini nuovi.
- **`createOrder`**: calcola i numeri corso dalle righe; il **primo corso con piatti** (minimo `item.course`) è `in_attesa`, gli altri `queued`; **`activeCourse`** = quel primo corso (non dipende dall’UI). Il payload **`activeCourse`** del client non è più necessario.
- **`setStatus("servito")`**: chiude il **primo** corso non ancora `servito` (ordine sequenziale); attiva il successivo con piatti (`in_attesa`) e mantiene `order.status = in_attesa` finché restano corsi; solo quando tutti i corsi sono `servito` → `order.status = servito`.
- **`setStatus`** per `in_preparazione` / `pronto` / `in_attesa`: aggiorna lo stato sul **primo** corso non ancora servito e allinea `order.status`.
- **`ensureCourseStatesForOrder` + `migrateLegacyCourseStates`**: ordini vecchi senza `courseStates` ottengono stati inferiti da `status` + `activeCourse` + righe.
- **`getOrderById`** e **`listActiveOrders`**: normalizzazione con `normalizeOrderForRead` (include migrazione `courseStates`).
- **`setActiveCourse`** (marcia manuale): se il corso era `queued`, viene portato a `in_attesa`.

### `sala.js` / `sala.html` / `sala.css`

- Nuovo pannello **`#sala-main-course-panel`**: Start, Aggiungi corso, righe cliccabili per **corso attivo UI**; badge **stato server** (`serverStatus`) quando esiste un ordine attivo sincronizzato.
- **`renderMainCoursePanel()`** richiamata da **`renderSelectedItems()`** (sempre aggiornata).
- **`resyncCourseDraftForActiveTable()`** dopo ogni refresh ordini per ricostruire la bozza dal server (corsi + stati).
- **`syncCourseDraftFromPrimaryOrder`**: ogni corso include **`serverStatus`** da `order.courseStates`.
- **Popup**: `buildPopupCoursesBlockHtml` ridotto a messaggio che rimanda al pannello sinistro; niente più lista corsi nel popup.
- **Invio comanda**: rimosso riallineamento forzato al corso 1 e rimosso **`activeCourse`** dal payload JSON.
- **Aggiunta piatti**: se non ci sono corsi, viene chiamato **`courseStart`** automaticamente; messaggi aggiornati (“pannello Corsi”).
- **Apri tavolo / Prendi ordine**: **`courseStart`** se bozza vuota; **`renderSelectedItems`** dopo chiusura popup.
- **Marcia** nel popup: dopo PATCH chiude il popup e aggiorna il pannello (niente riapertura obbligatoria).

### `cucina.js` / `cucina.css`

- **`buildCourseBlocksHtml`**: legge `order.courseStates` per etichetta stato; classifica visivamente: `servito` → passato; corso operativo da `order.activeCourse`.
- Hint testuale: “Corso operativo” invece di “Marca corso (sala)”.

## 3. Nuove strutture dati

- **`order.courseStates`**: `{ "1": "in_attesa", "2": "queued", ... }` (persistito in JSON ordine / `orders.extra` su MySQL).
- **`courseFlowVersion`**: numero intero (1) su ordini creati dopo questa versione (informativo / compatibilità).

## 4. Query / migrazioni

- **Nessuna migrazione SQL** obbligatoria: colonne già esistenti; `courseStates` vive in **`orders.extra`** (MySQL) o nel documento JSON.
- Ordini esistenti: stati corsi **inferiti** in lettura; al prossimo salvataggio verranno serializzati esplicitamente.

## 5. Flusso finale implementato

1. Sala imposta tavolo, crea corsi nel **pannello sinistro**, seleziona corso attivo per l’inserimento piatti.
2. Invio comanda: il **primo corso con piatti** (min `course`) è operativo in cucina (`in_attesa`), gli altri `queued`.
3. Cucina: prep / pronto / servito sul **primo corso non servito** (coerente con `activeCourse` normalizzato).
4. **Servito**: chiude quel corso, passa al successivo con piatti; l’ordine resta con `status` operativo fino all’ultimo corso; solo alla fine `status = servito` (scompare dalla KDS come prima).
5. Popup mappa: apertura tavolo, azioni rapide, hint; **non** è più il centro per inserire piatti o gestire la lista corsi.

## 6. Esito test A–E

| Test | Esito | Note |
|------|--------|------|
| A — UI corso 3, invio, cucina parte da corso 1 | **Da verificare in UI** | Backend: `activeCourse = min(course nums)`. |
| B — Servito corso 1, ordine attivo, corso 2 operativo | **Da verificare in UI** | Backend: avanzamento automatico su `servito`. |
| C — Servito corso 2 → corso 3 | **Da verificare in UI** | Stessa logica sequenziale. |
| D — Servito ultimo corso → ordine chiuso (`servito`) | **Da verificare in UI** | `order.status = servito`. |
| E — Inserimento senza riaprire popup | **Da verificare in UI** | Pannello corsi sempre in colonna sinistra. |

Verifica automatica: caricamento modulo `orders.service.js` con Node senza errori di sintassi.

## 7. Limiti residui

- **Marcia manuale** (`PATCH /active-course`) resta disponibile; in flusso normale l’avanzamento è guidato da **Servito** in cucina.
- Ordini **legacy** molto anomali (stati incoerenti) possono richiedere una correzione manuale o un nuovo salvataggio dopo la prima lettura normalizzata.
- **Sala** dopo invio: la bozza è ricostruita dal server; aggiunte successive alla stessa comanda (se il prodotto non le supporta già) non sono state modificate oltre la sincronizzazione esistente.
