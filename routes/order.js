import express from "express";
import { isAuth } from "../middleware/isAuth.js";
import {
  getAllOrders,
  getAllOrdersAdmin,
  getMyOrder,
  getStats,
  newOrderCod,
  newOrderOnline,
  updateStatus,
  cancelOrder,
  getOrderStatus,
  stripeWebhook,
} from "../controller/order.js";

const router = express.Router();

// ================== Create Orders ==================
router.post("/order/new/cod", isAuth, newOrderCod);
router.post("/order/new/online", isAuth, newOrderOnline);

// ================== Get Orders ==================
router.get("/order/all", isAuth, getAllOrders);
router.get("/order/admin/all", isAuth, getAllOrdersAdmin);
router.get("/order/:id", isAuth, getMyOrder);

// ================== Manage Orders ==================
router.put("/order/:id/status", isAuth, updateStatus);
router.post("/order/:id/cancel", isAuth, cancelOrder);

// ================== Stats ==================
router.get("/order/stats", isAuth, getStats);

// ================== Payment Status ==================
router.get("/order/status/:sessionId", isAuth, getOrderStatus);




export default router;
