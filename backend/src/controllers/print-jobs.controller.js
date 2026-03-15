const printJobsRepository = require("../repositories/print-jobs.repository");
const printService = require("../service/print.service");

exports.listJobs = async (req, res) => {
  const status = req.query.status || null;
  const sourceModule = req.query.sourceModule || null;
  const limit = parseInt(req.query.limit, 10) || 100;
  const data = await printJobsRepository.getAll({
    status: status || undefined,
    sourceModule: sourceModule || undefined,
    limit,
  });
  res.json(data);
};

exports.getJobById = async (req, res) => {
  const job = await printJobsRepository.getById(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Print job non trovato" });
  }
  res.json(job);
};

exports.createJob = async (req, res) => {
  const result = await printService.submitJob(req.body || {});
  res.status(201).json(result);
};

exports.getJobPrintView = async (req, res) => {
  const job = await printJobsRepository.getById(req.params.id);
  if (!job) {
    return res.status(404).send("Print job non trovato");
  }
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(job.documentTitle)}</title>
<style>body{font-family:monospace;padding:20px;white-space:pre-wrap;}</style></head>
<body>${escapeHtml(job.content)}</body></html>`;
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(html);
};

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

exports.retryJob = async (req, res) => {
  const job = await printJobsRepository.getById(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Print job non trovato" });
  }
  if (job.status !== "failed") {
    return res.status(400).json({
      error: "Solo i job falliti possono essere ritentati",
    });
  }
  const result = await printService.submitJob({
    eventType: job.eventType,
    department: job.department,
    documentTitle: job.documentTitle,
    content: job.content,
    sourceModule: job.sourceModule,
    relatedOrderId: job.relatedOrderId,
    relatedTable: job.relatedTable,
  });
  res.json(result);
};
