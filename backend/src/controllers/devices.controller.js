const devicesRepository = require("../repositories/devices.repository");
const printService = require("../service/print.service");

exports.listDevices = async (req, res) => {
  const data = await devicesRepository.getAll();
  res.json(data);
};

exports.getDeviceById = async (req, res) => {
  const device = await devicesRepository.getById(req.params.id);
  if (!device) {
    return res.status(404).json({ error: "Dispositivo non trovato" });
  }
  res.json(device);
};

exports.createDevice = async (req, res) => {
  const device = await devicesRepository.create(req.body || {});
  res.status(201).json(device);
};

exports.updateDevice = async (req, res) => {
  const device = await devicesRepository.update(req.params.id, req.body || {});
  if (!device) {
    return res.status(404).json({ error: "Dispositivo non trovato" });
  }
  res.json(device);
};

exports.deleteDevice = async (req, res) => {
  const ok = await devicesRepository.remove(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "Dispositivo non trovato" });
  }
  res.json({ success: true });
};

exports.testPrint = async (req, res) => {
  const result = await printService.testPrint(req.params.id);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
};
