const printRoutesRepository = require("../repositories/print-routes.repository");
const devicesRepository = require("../repositories/devices.repository");

exports.listRoutes = async (req, res) => {
  const data = await printRoutesRepository.getAll();
  res.json(data);
};

exports.getRouteById = async (req, res) => {
  const route = await printRoutesRepository.getById(req.params.id);
  if (!route) {
    return res.status(404).json({ error: "Route non trovata" });
  }
  res.json(route);
};

exports.createRoute = async (req, res) => {
  const { eventType, department, deviceId } = req.body || {};
  if (!eventType || !deviceId) {
    return res.status(400).json({
      error: "eventType e deviceId obbligatori",
    });
  }
  const device = await devicesRepository.getById(deviceId);
  if (!device) {
    return res.status(400).json({
      error: "Dispositivo non trovato. Una route non può puntare a un dispositivo inesistente.",
    });
  }
  const route = await printRoutesRepository.create({
    eventType,
    department: department || device.department,
    deviceId,
  });
  res.status(201).json(route);
};

exports.updateRoute = async (req, res) => {
  const { deviceId } = req.body || {};
  if (deviceId) {
    const device = await devicesRepository.getById(deviceId);
    if (!device) {
      return res.status(400).json({
        error: "Dispositivo non trovato.",
      });
    }
  }
  const route = await printRoutesRepository.update(req.params.id, req.body || {});
  if (!route) {
    return res.status(404).json({ error: "Route non trovata" });
  }
  res.json(route);
};

exports.deleteRoute = async (req, res) => {
  const ok = await printRoutesRepository.remove(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "Route non trovata" });
  }
  res.json({ success: true });
};
