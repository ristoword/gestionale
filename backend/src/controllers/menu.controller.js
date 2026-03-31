// backend/src/controllers/menu.controller.js

const menuService = require("../service/menu.service");

exports.listMenu = async (req, res, next) => {
  try {
    const items = await menuService.listAll();
    res.json(items);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    e.status = 500;
    next(e);
  }
};

exports.listActiveMenu = async (req, res, next) => {
  try {
    const items = await menuService.listActive();
    res.json(items);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    e.status = 500;
    next(e);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const item = await menuService.getOne(req.params.id);
    if (!item) return res.status(404).json({ error: "Piatto non trovato" });
    res.json(item);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    e.status = 404;
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const created = await menuService.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    e.status = 400;
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const updated = await menuService.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    e.status = err.message === "Piatto non trovato" ? 404 : 400;
    next(e);
  }
};

exports.createFromRecipe = async (req, res, next) => {
  try {
    const { recipeId } = req.body || {};
    if (!recipeId) return res.status(400).json({ error: "recipeId obbligatorio" });
    const dish = await menuService.createDishFromRecipe(recipeId);
    res.status(201).json(dish);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    res.status(400).json({ error: e.message });
  }
};

exports.remove = async (req, res, next) => {
  try {
    await menuService.remove(req.params.id);
    res.json({ success: true });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    e.status = 404;
    next(e);
  }
};
