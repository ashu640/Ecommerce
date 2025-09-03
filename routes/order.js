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
  verifyPayment,
  cancelOrder,
  getLastOrderUpdate  // ✅ import cancelOrder
} from "../controller/order.js";

const router = express.Router();

// ================== Create Orders ==================
router.post("/order/new/cod", isAuth, newOrderCod);
router.post("/order/new/online", isAuth, newOrderOnline);
router.post("/order/verify/payment", isAuth, verifyPayment);

// ================== Get Orders ==================
router.get("/order/all", isAuth, getAllOrders);
router.get("/order/admin/all", isAuth, getAllOrdersAdmin);
router.get("/order/:id", isAuth, getMyOrder);

// ================== Manage Orders ==================
// ✅ Changed POST → PUT (more RESTful, avoids conflict with cancel)
router.post("/order/:id/status", isAuth, updateStatus);  
router.post("/order/:id/cancel", isAuth, cancelOrder);   

// ================== Stats ==================
router.get("/stats", isAuth, getStats);



router.get("/orders/admin/last-update", isAuth, getLastOrderUpdate);


export default router;
