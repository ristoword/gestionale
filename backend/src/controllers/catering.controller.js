// backend/src/controllers/catering.controller.js

const cateringRepository = require("../repositories/catering.repository");
const cateringPresetsRepository = require("../repositories/catering-presets.repository");

// ---- Presets ----
exports.listPresets = async (req, res) => {
  const data = await cateringPresetsRepository.getAll();
  res.json(data);
};

exports.getPresetById = async (req, res) => {
  const preset = await cateringPresetsRepository.getById(req.params.id);
  if (!preset) {
    return res.status(404).json({ error: "Preset non trovato" });
  }
  res.json(preset);
};

exports.createPreset = async (req, res) => {
  try {
    const preset = await cateringPresetsRepository.create(req.body || {});
    res.status(201).json(preset);
  } catch (err) {
    if (err.validationErrors) {
      return res.status(400).json({
        error: err.message,
        validationErrors: err.validationErrors,
      });
    }
    throw err;
  }
};

exports.updatePreset = async (req, res) => {
  try {
    const preset = await cateringPresetsRepository.update(req.params.id, req.body || {});
    if (!preset) {
      return res.status(404).json({ error: "Preset non trovato" });
    }
    res.json(preset);
  } catch (err) {
    if (err.validationErrors) {
      return res.status(400).json({
        error: err.message,
        validationErrors: err.validationErrors,
      });
    }
    throw err;
  }
};

exports.deletePreset = async (req, res) => {
  const ok = await cateringPresetsRepository.remove(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "Preset non trovato" });
  }
  res.json({ success: true });
};

// ---- Events ----
exports.listEvents = async (req, res) => {
  const data = await cateringRepository.getAll();
  res.json(data);
};

exports.getEventById = async (req, res) => {
  const event = await cateringRepository.getById(req.params.id);
  if (!event) {
    return res.status(404).json({ error: "Evento non trovato" });
  }
  res.json(event);
};

exports.createEvent = async (req, res) => {
  try {
    const event = await cateringRepository.create(req.body || {});
    res.status(201).json(event);
  } catch (err) {
    if (err.validationErrors) {
      return res.status(400).json({
        error: err.message,
        validationErrors: err.validationErrors,
      });
    }
    throw err;
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await cateringRepository.update(req.params.id, req.body || {});
    if (!event) {
      return res.status(404).json({ error: "Evento non trovato" });
    }
    res.json(event);
  } catch (err) {
    if (err.validationErrors) {
      return res.status(400).json({
        error: err.message,
        validationErrors: err.validationErrors,
      });
    }
    throw err;
  }
};

exports.deleteEvent = async (req, res) => {
  const ok = await cateringRepository.remove(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "Evento non trovato" });
  }
  res.json({ success: true });
};

exports.createEventFromPreset = async (req, res) => {
  const event = await cateringRepository.createFromPreset(
    req.params.presetId,
    req.body || {}
  );
  if (!event) {
    return res.status(404).json({ error: "Preset non trovato" });
  }
  res.status(201).json(event);
};

// ---- Print ----
exports.getEventPrintHtml = async (req, res) => {
  const event = await cateringRepository.getById(req.params.id);
  if (!event) {
    return res.status(404).json({ error: "Evento non trovato" });
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(renderPrintHtml(event));
};

function renderPrintHtml(event) {
  const title = event.title || event.eventName || "Proposta Catering";
  const client = event.clientName || event.customer || "—";
  const date = event.eventDate || event.date || "—";
  const guests = event.guestCount ?? event.people ?? "—";
  const pricePerPerson = event.pricePerPerson ? `€ ${Number(event.pricePerPerson).toFixed(2)}` : "—";
  const total = event.totalEstimatedPrice ? `€ ${Number(event.totalEstimatedPrice).toFixed(2)}` : "—";

  let sectionsHtml = "";
  for (const s of event.sections || []) {
    let itemsHtml = "";
    for (const it of s.items || []) {
      let priceInfo = "";
      if (it.mode === "priced") {
        const pp = Number(it.pricePerPerson);
        const fp = Number(it.fixedPrice);
        if (pp > 0) priceInfo = ` <small>€ ${pp.toFixed(2)}/pax</small>`;
        else if (fp > 0) priceInfo = ` <small>€ ${fp.toFixed(2)}</small>`;
      } else {
        const q = Number(it.quantityPerPerson);
        const u = it.unit || "g";
        if (q > 0) priceInfo = ` <small>${q} ${u}/pax</small>`;
      }
      itemsHtml += `<li>${escapeHtml(it.name)}${priceInfo}${it.notes ? ` <span class="item-notes">(${escapeHtml(it.notes)})</span>` : ""}</li>`;
    }
    sectionsHtml += `
      <div class="print-section">
        <h3>${escapeHtml(s.name || "Sezione")}</h3>
        <ul>${itemsHtml || "<li>—</li>"}</ul>
      </div>`;
  }

  const notesHtml = event.notes ? `<div class="print-notes"><strong>Note:</strong> ${escapeHtml(event.notes)}</div>` : "";

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)} – Proposta Catering</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; color: #222; }
    .print-header { text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #333; }
    .print-header h1 { margin: 0 0 8px; font-size: 24px; }
    .print-meta { display: flex; flex-wrap: wrap; gap: 20px; margin: 16px 0; font-size: 14px; color: #444; }
    .print-meta span { display: inline-block; }
    .print-section { margin: 24px 0; }
    .print-section h3 { margin: 0 0 10px; font-size: 16px; color: #333; }
    .print-section ul { margin: 0; padding-left: 22px; }
    .print-section li { margin: 6px 0; }
    .item-notes { font-size: 12px; color: #666; }
    .print-totals { margin-top: 28px; padding: 16px; background: #f5f5f5; border-radius: 8px; }
    .print-totals div { margin: 6px 0; }
    .print-notes { margin-top: 20px; padding: 12px; background: #fafafa; border-left: 4px solid #999; font-size: 13px; }
    @media print { body { margin: 0; padding: 16px; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:20px;">
    <button onclick="window.print()" style="padding:10px 20px;cursor:pointer;">Stampa / Salva come PDF</button>
    <button onclick="window.close()" style="padding:10px 20px;cursor:pointer;margin-left:8px;">Chiudi</button>
  </div>
  <div class="print-header">
    <h1>${escapeHtml(title)}</h1>
    <p style="margin:0;color:#666;">Proposta Catering</p>
    <div class="print-meta">
      <span><strong>Cliente:</strong> ${escapeHtml(client)}</span>
      <span><strong>Data:</strong> ${escapeHtml(String(date))}</span>
      <span><strong>Ospiti:</strong> ${escapeHtml(String(guests))}</span>
    </div>
  </div>
  ${sectionsHtml || '<div class="print-section"><p>Nessuna sezione definita.</p></div>'}
  <div class="print-totals">
    <div><strong>Prezzo per persona:</strong> ${pricePerPerson}</div>
    <div><strong>Totale stimato:</strong> ${total}</div>
  </div>
  ${notesHtml}
</body>
</html>`;

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

// ---- Legacy (backward compatibility) ----
exports.listCatering = async (req, res) => {
  const data = await cateringRepository.getAll();
  res.json(data);
};

exports.getCateringById = async (req, res) => {
  const event = await cateringRepository.getById(req.params.id);
  if (!event) {
    return res.status(404).json({ error: "Evento catering non trovato" });
  }
  res.json(event);
};

exports.createCatering = async (req, res) => {
  try {
    const event = await cateringRepository.create(req.body || {});
    res.status(201).json(event);
  } catch (err) {
    if (err.validationErrors) {
      return res.status(400).json({
        error: err.message,
        validationErrors: err.validationErrors,
      });
    }
    throw err;
  }
};

exports.updateCatering = async (req, res) => {
  try {
    const event = await cateringRepository.update(req.params.id, req.body || {});
    if (!event) {
      return res.status(404).json({ error: "Evento catering non trovato" });
    }
    res.json(event);
  } catch (err) {
    if (err.validationErrors) {
      return res.status(400).json({
        error: err.message,
        validationErrors: err.validationErrors,
      });
    }
    throw err;
  }
};

exports.deleteCatering = async (req, res) => {
  const ok = await cateringRepository.remove(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "Evento catering non trovato" });
  }
  res.json({ success: true });
};
