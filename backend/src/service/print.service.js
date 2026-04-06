// backend/src/service/print.service.js
// Auto-routing of print jobs by eventType and department.
// Prepares architecture for future hardware bridge; supports browser/manual fallback.

const devicesRepository = require("../repositories/devices.repository");
const printRoutesRepository = require("../repositories/print-routes.repository");
const printJobsRepository = require("../repositories/print-jobs.repository");
const logger = require("../utils/logger");

const EVENT_BY_DEPARTMENT = {
  bar: "order_ticket_bar",
  cucina: "order_ticket_kitchen",
  pizzeria: "order_ticket_pizzeria",
};

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Resolve device for an event. Returns { device, route, warning }.
 * Warning is set when no route/device found – allows manual fallback.
 */
async function resolveDevice(eventType, department) {
  const route = await printRoutesRepository.findByEventAndDepartment(eventType, department);
  if (!route || !route.deviceId) {
    const defaultDevice = await devicesRepository.getDefaultForDepartment(department);
    if (defaultDevice) {
      return {
        device: defaultDevice,
        route: null,
        warning: `Nessuna route per ${eventType}; usato dispositivo default ${defaultDevice.name}`,
      };
    }
    return {
      device: null,
      route: null,
      warning: `Nessun dispositivo configurato per ${eventType} / ${department}. Usa stampa manuale.`,
    };
  }

  const device = await devicesRepository.getById(route.deviceId);
  if (!device) {
    return {
      device: null,
      route,
      warning: `Dispositivo ${route.deviceId} non trovato. Verificare configurazione route.`,
    };
  }
  if (!device.isActive) {
    return {
      device,
      route,
      warning: `Dispositivo "${device.name}" è inattivo. Usa stampa manuale o riattivalo.`,
    };
  }
  return { device, route, warning: null };
}

/**
 * Create and enqueue a print job. Returns { job, routed, device, warning }.
 */
async function submitJob(payload) {
  const {
    eventType,
    department,
    documentTitle,
    content,
    sourceModule,
    relatedOrderId,
    relatedTable,
  } = payload || {};

  if (!eventType || !department) {
    const err = new Error("eventType e department obbligatori");
    err.status = 400;
    throw err;
  }

  const { device, warning } = await resolveDevice(eventType, department);

  const jobData = {
    eventType,
    department,
    documentTitle: documentTitle || "",
    content: content || "",
    sourceModule: sourceModule || "",
    relatedOrderId: relatedOrderId || null,
    relatedTable: relatedTable || null,
    deviceId: device ? device.id : null,
    status: device ? "queued" : "failed",
    errorMessage: !device ? (warning || "Nessun dispositivo disponibile") : null,
  };

  const job = await printJobsRepository.create(jobData);

  if (!device) {
    // info: assenza stampante è frequente; warn su stderr finiva come "error" nei log aggregati
    logger.info("Print job without device", {
      jobId: job.id,
      eventType,
      department,
      warning,
    });
    return {
      job,
      routed: false,
      device: null,
      warning: warning || "Nessun dispositivo configurato. Usa stampa manuale.",
    };
  }

  return {
    job,
    routed: true,
    device: { id: device.id, name: device.name, department: device.department },
    warning: warning || null,
  };
}

/**
 * Build order ticket HTML for a given department's items.
 */
function buildOrderTicketHtml(order, items, department) {
  const table = order.table ?? "-";
  const waiter = order.waiter ?? "-";
  const covers = order.covers ?? "-";
  const note = order.notes ? `\nNote: ${order.notes}` : "";
  let rows = "";
  for (const it of items) {
    const qty = it.qty ?? 1;
    const name = it.name ?? "-";
    const itemNote = it.note ? ` (${it.note})` : "";
    rows += `${qty}x ${escapeHtml(name)}${itemNote}\n`;
  }
  return `
=== COMANDA TAVOLO ${table} ===
Reparto: ${department}
Cameriere: ${waiter}
Coperti: ${covers}
${rows}${note}
--- ${new Date().toLocaleTimeString("it-IT")} ---
`.trim();
}

/**
 * Submit print jobs for a new order – one job per department.
 * Called automatically when order is created.
 */
async function submitOrderTickets(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const byDept = {};
  for (const it of items) {
    const dept = (it.area || order.area || "cucina").toLowerCase();
    if (!byDept[dept]) byDept[dept] = [];
    byDept[dept].push(it);
  }

  const results = [];
  for (const [department, deptItems] of Object.entries(byDept)) {
    const eventType = EVENT_BY_DEPARTMENT[department] || "order_ticket_kitchen";
    const content = buildOrderTicketHtml(order, deptItems, department);
    const result = await submitJob({
      eventType,
      department,
      documentTitle: `Comanda Tavolo ${order.table ?? "-"} (${department})`,
      content,
      sourceModule: "sala",
      relatedOrderId: order.id,
      relatedTable: String(order.table ?? ""),
    });
    results.push({ department, ...result });
  }
  return results;
}

/**
 * Submit receipt (prebill or final). Department defaults to cassa.
 */
async function submitReceipt(payload) {
  const eventType =
    payload.receiptType === "prebill" ? "receipt_prebill" : "receipt_final";
  return submitJob({
    eventType,
    department: payload.department || "cassa",
    documentTitle: payload.documentTitle || (eventType === "receipt_prebill" ? "Preconto" : "Scontrino"),
    content: payload.content || "",
    sourceModule: payload.sourceModule || "cassa",
    relatedOrderId: payload.relatedOrderId,
    relatedTable: payload.relatedTable,
  });
}

/**
 * Submit inventory/magazzino print (label, report).
 */
async function submitInventoryPrint(payload) {
  const eventType =
    payload.type === "label" ? "inventory_label" : "inventory_report";
  return submitJob({
    eventType,
    department: payload.department || "magazzino",
    documentTitle: payload.documentTitle || "Magazzino",
    content: payload.content || "",
    sourceModule: payload.sourceModule || "magazzino",
  });
}

/**
 * Test print – validate device exists and is active.
 */
async function testPrint(deviceId) {
  const device = await devicesRepository.getById(deviceId);
  if (!device) {
    return { ok: false, error: "Dispositivo non trovato" };
  }
  if (!device.isActive) {
    return { ok: false, error: "Dispositivo inattivo" };
  }
  const job = await printJobsRepository.create({
    eventType: "test",
    department: device.department,
    documentTitle: "Test stampa",
    content: `=== TEST STAMPA ===\nDispositivo: ${device.name}\nReparto: ${device.department}\nData: ${new Date().toLocaleString("it-IT")}\n================`,
    sourceModule: "hardware",
    deviceId: device.id,
    status: "queued",
  });
  return {
    ok: true,
    jobId: job.id,
    message: "Job di test creato. Usa stampa manuale o bridge locale per inviare al dispositivo.",
  };
}

module.exports = {
  resolveDevice,
  submitJob,
  submitOrderTickets,
  submitReceipt,
  submitInventoryPrint,
  testPrint,
  buildOrderTicketHtml,
};
