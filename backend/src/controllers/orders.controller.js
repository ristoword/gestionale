// backend/src/controllers/orders.controller.js
const ordersService = require("../service/orders.service");
const inventoryService = require("../service/inventory.service");
const { broadcastOrders, broadcastSupervisorSyncFromData } = require("../service/websocket.service");
const logger = require("../utils/logger");

async function broadcastOrderUpdates() {
  try {
    const orders = await ordersService.listActiveOrders();
    broadcastOrders(orders);
  } catch (err) {
    logger.error("WebSocket broadcast error", { message: err.message });
  }
}

async function listOrders(req, res, next) {
  try {
    const active = String(req.query.active || "").toLowerCase() === "true";
    const orders = active ? await ordersService.listActiveOrders() : await ordersService.listOrders();
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

async function listOrdersHistory(req, res, next) {
  try {
    const dateStr = req.query.date || "";
    const orders = await ordersService.listOrdersByDate(dateStr);
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

async function createOrder(req, res, next) {
  try {
    const order = await ordersService.createOrder(req.body || {});
    await broadcastOrderUpdates();

    // Auto-route print jobs by department
    try {
      const printService = require("../service/print.service");
      const printResults = await printService.submitOrderTickets(order);
      if (printResults.length > 0) {
        order._printJobs = printResults.map((r) => ({
          department: r.department,
          jobId: r.job.id,
          routed: r.routed,
          device: r.device,
          warning: r.warning,
        }));
      }
    } catch (printErr) {
      logger.warn("Print job creation failed (order still saved)", { orderId: order.id, message: printErr.message });
    }

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

async function setStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!status) {
      return res.status(400).json({ error: "Campo 'status' obbligatorio" });
    }

    const isFinalState = ["servito", "chiuso"].includes(String(status || "").toLowerCase());

    // Validate kitchen stock BEFORE changing status when closing/serving
    if (isFinalState) {
      const order = await ordersService.getOrderById(id);
      if (order && Array.isArray(order.items) && order.items.length > 0) {
        const validation = await inventoryService.validateOrderConsumption(order);
        if (!validation.valid) {
          return res.status(400).json({
            error: validation.error || "Stock cucina insufficiente per completare l'ordine",
            blocked: true,
            failures: validation.failures || [],
          });
        }
      }
    }

    const updated = await ordersService.setStatus(id, status);

    await broadcastOrderUpdates();

    if (updated && isFinalState) {
      const shouldDeduct = ordersService.tryMarkOrderInventoryProcessed(updated.id);
      if (shouldDeduct) {
        logger.info("Order final state (inventory sync)", { orderId: updated.id, status: updated.status, table: updated.table });
        const result = await inventoryService.onOrderFinalized(updated);
        if (result && result.blocked) {
          logger.error("Inventory deduction blocked after status save (race?)", {
            orderId: updated.id,
            error: result.error,
          });
        }
      }
      broadcastSupervisorSyncFromData();
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listOrders,
  listOrdersHistory,
  createOrder,
  setStatus,
};