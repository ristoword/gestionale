const qrTablesRepository = require("../repositories/qr-tables.repository");

exports.listTables = async (req, res) => {
  const tables = await qrTablesRepository.getTables();
  res.json(tables);
};

exports.getTableById = async (req, res) => {
  const table = await qrTablesRepository.getTableById(req.params.id);
  if (!table) {
    return res.status(404).json({ error: "Tavolo non trovato" });
  }
  res.json(table);
};

exports.getTablePrint = async (req, res) => {
  const table = await qrTablesRepository.getTableById(req.params.id);
  if (!table) {
    return res.status(404).send("Tavolo non trovato");
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(renderQrCardHtml(table, req));
};

exports.getAllPrint = async (req, res) => {
  const tables = await qrTablesRepository.getTables();
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(renderAllQrCardsHtml(tables, req));
};

function getBaseUrl(req) {
  const host = req.get("host") || "localhost:3001";
  const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
  return `${protocol}://${host}`;
}

function renderQrCardHtml(table, req) {
  const baseUrl = getBaseUrl(req);
  const qrUrl = `${baseUrl}/qr/${table.id}`;
  const label = table.label || `Tavolo ${table.id}`;
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>QR ${escapeHtml(label)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; }
    .card { max-width: 300px; margin: 0 auto; text-align: center; padding: 24px; border: 2px solid #333; border-radius: 12px; }
    .card h2 { margin: 0 0 16px; font-size: 20px; }
    .card .qr-wrap { padding: 16px; background: #fff; border-radius: 8px; display: inline-block; }
    .card .qr-wrap img { display: block; }
    .card .hint { margin-top: 16px; font-size: 12px; color: #666; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
  <script src="https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs@gh-pages/qrcode.min.js"></script>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px;">
    <button onclick="window.print()" style="padding:10px 20px;cursor:pointer;">Stampa</button>
    <button onclick="window.close()" style="padding:10px 20px;cursor:pointer;margin-left:8px;">Chiudi</button>
  </div>
  <div class="card">
    <h2>${escapeHtml(label)}</h2>
    <p>Scansiona per ordinare</p>
    <div class="qr-wrap" id="qr"></div>
    <p class="hint">Inquadra il QR con la fotocamera</p>
  </div>
  <script>
    (function() {
      var url = ${JSON.stringify(qrUrl)};
      var el = document.getElementById("qr");
      if (el && typeof QRCode !== "undefined") new QRCode(el, { text: url, width: 200, height: 200 });
    })();
  </script>
</body>
</html>`;
}

function renderAllQrCardsHtml(tables, req) {
  const baseUrl = getBaseUrl(req);
  const cards = tables
    .map((t) => {
      const qrUrl = `${baseUrl}/qr/${t.id}`;
      const label = t.label || `Tavolo ${t.id}`;
      return `
    <div class="card">
      <h2>${escapeHtml(label)}</h2>
      <p>Scansiona per ordinare</p>
      <div class="qr-wrap" data-url="${escapeHtml(qrUrl)}"></div>
      <p class="hint">Inquadra il QR con la fotocamera</p>
    </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>QR Tavoli</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; }
    .no-print { margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
    .card { text-align: center; padding: 24px; border: 2px solid #333; border-radius: 12px; page-break-inside: avoid; }
    .card h2 { margin: 0 0 16px; font-size: 18px; }
    .card .qr-wrap { padding: 16px; background: #fff; border-radius: 8px; display: inline-block; }
    .card .qr-wrap canvas { display: block; }
    .card .hint { margin-top: 12px; font-size: 11px; color: #666; }
    @media print { body { padding: 0; } .no-print { display: none; } .grid { gap: 16px; } }
  </style>
  <script src="https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs@gh-pages/qrcode.min.js"></script>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding:10px 20px;cursor:pointer;">Stampa tutti</button>
    <button onclick="window.close()" style="padding:10px 20px;cursor:pointer;margin-left:8px;">Chiudi</button>
  </div>
  <div class="grid">
    ${cards}
  </div>
  <script>
    (function() {
      if (typeof QRCode === "undefined") return;
      document.querySelectorAll(".qr-wrap").forEach(function(el) {
        var url = el.dataset.url;
        if (url) new QRCode(el, { text: url, width: 160, height: 160 });
      });
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
