// Storni – GET list by date/range, POST create, DELETE by id. Fonte unica per netto (lordo - storni).

const storniRepository = require("../repositories/storni.repository");

// GET /api/storni?date=YYYY-MM-DD oppure ?dateFrom=&dateTo=
exports.list = async (req, res) => {
  const { date, dateFrom, dateTo } = req.query || {};
  const from = date ? date : dateFrom;
  const to = date ? date : dateTo;
  const entries = await storniRepository.listByDateRange(from, to);
  res.json(entries);
};

// GET /api/storni/total?date=YYYY-MM-DD
exports.totalByDate = async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const total = await storniRepository.getTotalByDate(date);
  res.json({ date: String(date).slice(0, 10), total });
};

// POST /api/storni
exports.create = async (req, res) => {
  const { date, amount, reason, table, orderId, note } = req.body || {};
  const dateStr = date || new Date().toISOString().slice(0, 10);
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: "Importo obbligatorio e maggiore di zero." });
  }
  const entry = await storniRepository.create({
    date: String(dateStr).slice(0, 10),
    amount: amt,
    reason: String(reason || "").trim(),
    table: table != null ? String(table).trim() : "",
    orderId: orderId != null ? String(orderId).trim() : "",
    note: note != null ? String(note).trim() : "",
  });
  res.status(201).json(entry);
};

// DELETE /api/storni/:id
exports.deleteById = async (req, res) => {
  const id = req.params.id;
  const ok = await storniRepository.deleteById(id);
  if (!ok) return res.status(404).json({ error: "Storno non trovato." });
  res.json({ success: true });
}
