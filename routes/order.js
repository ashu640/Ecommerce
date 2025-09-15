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
  verifyStripePayment,
  getLastOrderUpdate
} from "../controller/order.js";

const router = express.Router();


router.post("/order/new/cod", isAuth, newOrderCod);
router.get("/order/all", isAuth, getAllOrders);
router.get("/order/admin/all", isAuth, getAllOrdersAdmin);
router.post("/order/verify/payment", isAuth, verifyStripePayment);
router.get("/order/:id", isAuth, getMyOrder);
router.post("/order/:id", isAuth, updateStatus);
router.get("/stats", isAuth, getStats);
router.post("/order/new/online", isAuth, newOrderOnline);
router.get("/orders/admin/last-update", isAuth, getLastOrderUpdate);



router.post("/order/:id/cancel", isAuth, cancelOrder);


// ================== Payment Status ==================





export default router;
