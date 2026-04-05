# Ipotesi di bug — gravità ed evidenze

Formato richiesto. Evidenze tratte da `sala.js`, `cucina.js`, `orders.service.js`, repository MySQL.

---

## Bug A — Ultimo corso selezionato in bozza vs invio in cucina

- **Nome breve:** Disallineamento percezione “corso attivo” in sala prima dell’invio.
- **Descrizione:** L’utente può lasciare selezionato l’ultimo corso nella bozza; in cucina la “marca” mostrata dipende da **`order.activeCourse`** sul server (in creazione forzato a 1), non dal corso evidenziato in bozza subito prima (dopo `handleCreateOrder` la bozza viene resettata).
- **File coinvolti:** `backend/public/sala/sala.js` (`handleCreateOrder`, `flattenCourseItemsForApi`), `backend/public/cucina/cucina.js` (`buildCourseBlocksHtml`).
- **Evidenza:** `handleCreateOrder` imposta `activeCourse: 1` e riallinea `activeCourseId` al corso 1 prima del POST; `buildCourseBlocksHtml` usa `order.activeCourse` per evidenziare il blocco.
- **Perché può causare il problema:** Se **`activeCourse` sul DB** è stato portato avanti (marcia) o **normalizzato** in modo inatteso, la cucina mostra “acceso” un corso diverso dal primo; se i **`item.course`** sono tutti 1 per errore di persistenza, `maxCourse` è 1 e il primo “Servito” chiude.
- **Gravità:** media.

---

## Bug B — “Servito” interpretato come chiusura ordine

- **Nome breve:** `setStatus("servito")` imposta `status = servito` quando `activeCourse >= maxCourse`.
- **Descrizione:** Il backend **non** avanza automaticamente il corso dopo servito; se `activeCourse` è già uguale a `maxCourse`, lo stato diventa **`servito`** (finale per quella transizione).
- **File coinvolti:** `backend/src/service/orders.service.js` (`setStatus`).
- **Evidenza:** `if (ac < maxCourse) nextStatus = "in_attesa"; else nextStatus = "servito";`
- **Perché provoca il problema:** Se per bug di dati **`maxCourse` è 1** (tutte le righe con `course` 1) oppure **`activeCourse` è già al massimo** mentre la cucina crede di servire il “primo” corso, l’ordine passa a **`servito`** e **scompare dalla cucina** (filtro su `servito`).
- **Gravità:** alta.

---

## Bug C — Nessuna tabella stato-per-corso

- **Nome breve:** Modello solo ordine+riga, senza entità “corso”.
- **Descrizione:** Non esiste una tabella dedicata allo stato di ogni corso; la semantica è emersa da **`status` ordine** + **`course` su righe** + **`activeCourse`**.
- **File coinvolti:** `backend/db/schema.sql`, `orders.service.js`.
- **Evidenza:** Solo `orders` + `order_items`; nessuna `order_courses`.
- **Perché provoca ambiguità:** Debugging richiede inferenza (`maxCourse` da righe); errori di serializzazione `course` in MySQL sono difficili da vedere senza query su `extra`.
- **Gravità:** media (diagnostica / manutenzione).

---

## Bug D — `course` solo in UI vs persistenza

- **Nome breve:** Perdita o default di `course` nelle righe.
- **Descrizione:** Se **`course`** non finisce correttamente in `order_items.extra` o viene letto male, tutte le righe equivalgono a corso 1 lato `getMaxCourseFromOrder`.
- **File coinvolti:** `backend/src/repositories/mysql/orders.repository.mysql.js` (`itemToDbRow`, `rowToItem`).
- **Evidenza:** Campi extra della riga serializzati in JSON `extra`.
- **Perché provoca il problema:** `maxCourse` diventa 1 → al primo “Servito” `ac < maxCourse` è falso → **`status` finale `servito`**.
- **Gravità:** alta (se si verifica in produzione).

---

## Bug E — Migrazione / MySQL e sequenza corsi

- **Nome breve:** Differenze JSON vs MySQL sul campo `course`.
- **Descrizione:** Dopo passaggio a MySQL, regressioni possono derivare da mapping `items` ↔ righe DB (indici, merge `extra`).
- **File coinvolti:** `orders.repository.mysql.js`, eventuali script migrazione (se presenti altrove nel repo).
- **Evidenza:** `course` non è colonna dedicata in DDL; dipende da `extra`.
- **Perché provoca il problema:** Ordini “vecchi” o migrati male possono avere **`course` assente** → normalizzazione a 1.
- **Gravità:** media (dipende dai dati reali).

---

## Bug F — Cucina “legge” ultimo corso

- **Nome breve:** Evidenziazione KDS da `activeCourse`, non dal “primo corso non servito”.
- **Descrizione:** `buildCourseBlocksHtml` marca come attivo il blocco con `cn === activeCourse`. Non c’è concetto di “primo corso in attesa di preparazione” separato.
- **File coinvolti:** `cucina.js` (`buildCourseBlocksHtml`).
- **Evidenza:** `if (cn === activeCourse) courseCls = "kds-course-active"`.
- **Perché sembra “ultimo corso acceso”:** Se **`activeCourse`** sul server è stato incrementato fino all’ultimo (marcia ripetuta, doppio invio, o valore errato), l’UI mostra l’ultimo come attivo.
- **Gravità:** media.

---

## Bug G — Dopo “Servito” non si cerca il prossimo corso

- **Nome breve:** Nessun auto-increment di `activeCourse` in `setStatus`.
- **Descrizione:** Dopo servito su corso non ultimo, lo stato torna **`in_attesa`** ma **`activeCourse` non cambia** nel service `setStatus`.
- **File coinvolti:** `orders.service.js` (`setStatus` vs `setActiveCourse`).
- **Evidenza:** `setStatus` aggiorna solo `nextStatus` e `updatedAt`, non `activeCourse`.
- **Perché importa:** La cucina continua a mostrare la **stessa** “marca corso” finché la sala non fa **marcia** (`PATCH active-course`). Se l’operatore si aspetta avanzamento automatico, il flusso “sembra rotto”.
- **Gravità:** bassa se il processo è “sempre marcia manuale”; **media** se l’UX promette avanzamento implicito.

---

## Bug H — Filtro cucina nasconde ordini `servito`

- **Nome breve:** Card sparisce quando `status === servito`.
- **Descrizione:** `renderKdsColumns` esclude ordini con status `servito`.
- **File coinvolti:** `cucina.js`.
- **Evidenza:** `o.status !== "servito"`.
- **Perché:** Comportamento **corretto** per ordine veramente completato; **sintomo errato** se il backend ha impostato `servito` troppo presto (vedi B, D).
- **Gravità:** alta (come effetto visivo del bug di stato), n/a come bug isolato se i dati sono corretti.

---

## Bug I — Popup richiude/riapre per ogni cambio corso

- **Nome breve:** UX popup e refresh.
- **Descrizione:** Selezione corso e aggiunta corso chiamano `openTablePopup` per ridisegnare; non c’è modalità “inline” senza refresh completo del body.
- **File coinvolti:** `sala.js` (handler popup).
- **Evidenza:** `setActiveCourse` → `openTablePopup(tableNum)`.
- **Perché:** Percepito come “obbligo di rientrare” o click ripetuti.
- **Gravità:** bassa (UX), non funzionale.

---

## Matrice ipotesi obbligatorie (checklist)

| # | Ipotesi | Bug ID | Gravità |
|---|---------|--------|---------|
| 1 | Corso attivo FE resta ultimo e viene inviato così in cucina | A (mitigato da `activeCourse: 1` in create; resta F per marcia) | media |
| 2 | Backend interpreta servito come chiusura | B, H | alta |
| 3 | Nessuna tabella/logica separata stato corsi | C | media |
| 4 | Piatti con corso solo UI, non persistente | D | alta se dati |
| 5 | MySQL ha rotto sequenza corsi | E | media |
| 6 | Cucina legge ultimo corso | F | media |
| 7 | Dopo servito non si cerca prossimo corso | G | media |
