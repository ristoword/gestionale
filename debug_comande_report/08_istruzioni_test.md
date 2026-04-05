# Istruzioni test manuale

Obiettivo: riprodurre e osservare i comportamenti descritti nei report su **popup tavolo**, **multi-corso**, **invio**, **cucina**, **servito**, **marcia**.

**Prerequisiti:** backend avviato, sala e cucina accessibili (stesso tenant), menù con almeno un piatto.

---

## Test 1 — Ultimo corso selezionato in bozza e invio

**Passi**

1. Apri sala, seleziona un tavolo.
2. Apri popup tavolo → **Start** (Corso 1).
3. **Aggiungi corso** due volte (totale 3 corsi).
4. Seleziona **Corso 3** nel popup (click sulla riga corso).
5. Aggiungi **un piatto per ogni corso** (per il corso 3, aggiungi dal menu con Corso 3 selezionato; per 1 e 2 ripeti selezionando il corso corrispondente).
6. **Invia comanda** (flusso creazione ordine con coperti/cameriere validi).

**Comportamento atteso (dal codice)**

- All’invio, la bozza viene riallineata al **Corso 1** prima del POST; payload **`activeCourse: 1`**.
- In cucina, la **marca** mostrata dovrebbe corrispondere a **`activeCourse` sul server** (1 dopo creazione), con blocchi per corso 1, 2, 3 visibili.
- I piatti risultano nelle righe con `course` 1, 2, 3 rispettivamente.

**Comportamento reale (da verificare)**

- Se in cucina il corso evidenziato non è 1, controllare **`activeCourse`** in risposta API o DB e **marcia** già effettuata.
- Se mancano piatti per corsi diversi dal 3, verificare che siano stati aggiunti con il corso corretto selezionato.

---

## Test 2 — Stesso scenario ma prima dell’invio si seleziona Corso 1

**Passi**

1. Ripeti preparazione 3 corsi con un piatto ciascuno.
2. Prima di inviare, seleziona **Corso 1** nel popup.
3. Invia comanda.

**Comportamento atteso (dal codice)**

- Anche così `handleCreateOrder` forza **`activeCourse: 1`** e resetta la selezione locale al corso 1; differenza rispetto al Test 1 solo **prima** del click invio (UI bozza).

**Comportamento reale (da verificare)**

- Dopo invio, stesso ordine del Test 1: **non** dovrebbe cambiare `activeCourse` iniziale sul server rispetto al Test 1.

---

## Test 3 — Servito sul “primo corso” con ordine multi-corso

**Passi**

1. Crea ordine con 3 corsi e piatti distinti (Test 1).
2. In cucina, porta la comanda **In prep** → **Pronto** (se il flusso richiede stato).
3. Clicca **Servito** una volta.

**Comportamento atteso (dal codice backend)**

- Se **`activeCourse` (es. 1) < maxCourse (3)** → **`status`** risultante **`in_attesa`** (non `servito` finale).
- La card **resta** in cucina (filtro esclude solo `servito`).
- **`activeCourse` non cambia** automaticamente: la marcia è dalla sala.

**Comportamento reale (da verificare)**

- Se la card **scompare** → probabilmente **`status` è diventato `servito`**: verificare **`activeCourse` vs `maxCourse`** e che le righe abbiano **`course`** 2 e 3 diversi da 1 (query DB, vedi `05_query_debug.sql`).

---

## Test 4 — Ordine con 4 corsi

**Passi**

1. Crea 4 corsi, un piatto per corso, invia.
2. In cucina: **Servito** ripetuto dopo ogni “fase” oppure una sola volta; in sala usa **Marcia prossima portata** tra un servizio e l’altro.
3. Osserva quando l’ordine scompare dalla cucina.

**Comportamento atteso (dal codice)**

- Scompare **solo** quando **`status`** è **`servito`** (e la cucina filtra).
- Ultimo `servito` quando **`activeCourse >= maxCourse`** (tipicamente dopo marcia fino all’ultimo corso e servizio finale).

**Comportamento reale (da verificare)**

- Se scompare al primo servito con 4 corsi → **Bug B/D** probabile (`maxCourse` o `activeCourse` errati).

---

## Checklist rapida API (opzionale)

Dopo ogni azione, registrare:

- `GET /api/orders?active=true` — `status`, `activeCourse`, `items[].course` per l’ordine di test.
- Dopo marcia: `PATCH` `active-course` con `activeCourse` atteso `prev+1`.

---

## Note su WebSocket

Se gli aggiornamenti sono in tempo reale, attendere refresh o usare pulsante refresh cucina per coerenza con polling.
