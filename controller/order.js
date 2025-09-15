import { Cart } from "../model/cart.js";
import { Order } from "../model/order.js";
import { Product } from "../model/product.js";
import { Address } from "../model/address.js";
import sendOrderCancellation from "../utils/sendOrderCancellation.js";
import sendOrderConfiramtion from "../utils/sendOrderconfirmation.js";
import TryCatch from "../utils/trycatch.js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.Stripe_Secret_key, {
  apiVersion: "2024-06-20",
});

// ================= COD ORDER =================
export const newOrderCod = TryCatch(async (req, res) => {
  console.log("⚡ COD Order triggered");

  const { method, addressId } = req.body;
  const cart = await Cart.find({ user: req.user._id }).populate("product");

  if (!cart.length) {
    console.warn("⚠️ Cart is empty");
    return res.status(400).json({ message: "Cart is empty" });
  }

  const address = await Address.findOne({ _id: addressId, user: req.user._id });
  if (!address) {
    console.warn("⚠️ Address not found");
    return res.status(404).json({ message: "Address not found" });
  }

  let subTotal = 0;
  const items = cart.map((i) => {
    subTotal += i.product.price * i.quantity;
    return {
      product: i.product._id,
      name: i.product.title.en,
      price: i.product.price,
      quantity: i.quantity,
    };
  });

  console.log("🔹 Creating COD order with items:", items);

  const order = await Order.create({
    items,
    method,
    user: req.user._id,
    name:address.fullName,
    address: address.addressLine1,
    phone: address.phone,
    subTotal,
  });

  for (let i of order.items) {
    const product = await Product.findById(i.product);
    if (product) {
      product.stock -= i.quantity;
      product.sold += i.quantity;
      await product.save();
      console.log(`🔹 Updated product ${product._id}: stock=${product.stock}, sold=${product.sold}`);
    }
  }

  await Cart.deleteMany({ user: req.user._id });
  console.log("🗑️ Cart cleared after COD order");

  await sendOrderConfiramtion({
    name:address.fullName,
    email: req.user.email,
    subject: "Order confirmation",
    orderId: order._id,
    products: items,
    totalAmount: subTotal,
  });

  console.log("✅ COD Order created successfully:", order._id);
  res.json({ message: "Order created successfully", order });
});

// ================= GET ORDERS =================
export const getAllOrders = TryCatch(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate("address")
    .sort({ createdAt: -1 });
  res.json({ orders });
});

export const getAllOrdersAdmin = TryCatch(async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "You are not admin" });

  // 1️⃣ Read page & limit from query (default: page=1, limit=10)
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // 2️⃣ Count total orders
  const totalOrders = await Order.countDocuments();

  // 3️⃣ Fetch orders with pagination
  const orders = await Order.find()
    .populate("user")
    .populate("address")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit) // skip previous pages
    .limit(limit); // limit per page

  // 4️⃣ Send response with pagination meta
  res.json({
    orders,
    totalOrders,
    totalPages: Math.ceil(totalOrders / limit),
    currentPage: page,
  });
});


export const getMyOrder = TryCatch(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("items.product")
    .populate("user")
    .populate("address");

  if (!order) return res.status(404).json({ message: "Order not found" });

  res.json(order);
});

// ================= UPDATE STATUS =================
export const updateStatus = TryCatch(async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "You are not admin" });

  const order = await Order.findById(req.params.id)
    .populate("user")
    .populate("items.product")
    .populate("address");

  if (!order) return res.status(404).json({ message: "Order not found" });

  // Check if status is actually changing
  if (order.status === req.body.status) {
    return res.status(400).json({ message: `Order already ${order.status}` });
  }

  const isAdminCancelling = req.body.status === "cancelled";

  order.status = req.body.status;
  await order.save();

  // Send emails if admin cancelled
  if (isAdminCancelling) {
    const products = order.items.map((i) => ({
      name: i.product.title.en,
      quantity: i.quantity,
      price: i.product.price,
    }));

    await sendOrderCancellation({
      name:order.address.fullName,
      email: order.user.email,
      subject: "Your order has been cancelled by admin",
      orderId: order._id,
      products,
      totalAmount: order.subTotal,
    });

    await sendOrderCancellation({
      email: process.env.ADMIN_EMAIL,
      subject: "Order Cancelled by Admin",
      orderId: order._id,
      products,
      totalAmount: order.subTotal,
    });
  }

  console.log(`🔹 Order ${order._id} status updated to ${order.status}`);
  res.json({ message: "Order status updated", order });
});

// ================= CANCEL ORDER (USER) =================
export const cancelOrder = TryCatch(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("user")
    .populate("items.product")
    .populate("address");

  if (!order) return res.status(404).json({ message: "Order not found" });

  // Only the user who made the order can cancel
  if (order.user._id.toString() !== req.user._id.toString())
    return res.status(403).json({ message: "Not authorized" });

  // ✅ Already cancelled check
  if (order.status === "cancelled") {
    return res.status(400).json({ message: "Order is already cancelled" });
  }

  if (["shipped", "delivered"].includes(order.status))
    return res.status(400).json({ message: "Cannot cancel shipped/delivered order" });

  order.status = "cancelled";
  await order.save();

  const products = order.items.map((i) => ({
    name: i.product.title.en,
    quantity: i.quantity,
    price: i.product.price,
  }));

  // Send emails to user and admin
  await sendOrderCancellation({
    name:order.address.fullName,
    email: order.user.email,
    subject: "Your order has been cancelled",
    orderId: order._id,
    products,
    totalAmount: order.subTotal,
  });

  await sendOrderCancellation({
    email: process.env.ADMIN_EMAIL,
    subject: "Order Cancelled by User",
    orderId: order._id,
    products,
    totalAmount: order.subTotal,
  });

  console.log("🔹 Order cancelled successfully by user:", order._id);

  res.json({
    success: true,
    message: "Order cancelled successfully",
    order, // returning full order so frontend can render safely
  });
});


// ================= STRIPE CHECKOUT =================
export const newOrderOnline = TryCatch(async (req, res) => {
  console.log("⚡ Stripe Online Order triggered");

  const { method, addressId } = req.body;
  const cart = await Cart.find({ user: req.user._id }).populate("product");
  if (!cart.length) return res.status(400).json({ message: "Cart is empty" });

  const address = await Address.findOne({ _id: addressId, user: req.user._id });
  if (!address) return res.status(404).json({ message: "Address not found" });

  const lineItems = cart.map((item) => ({
    price_data: {
      currency: "inr",
      product_data: {
        name: item.product.title.en,
        images: [item.product.images[0].url],
      },
      unit_amount: Math.round(item.product.price * 100),
    },
    quantity: item.quantity,
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    success_url: `${process.env.Frontend_Url}/ordersuccess?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.Frontend_Url}/cart`,
    metadata: { userId: req.user._id.toString(), addressId, method },
  });

  console.log("🔹 Stripe session created:", session.id);
  res.json({ url: session.url });
});


// ================= VERIFY PAYMENT AFTER SUCCESS =================
export const verifyStripePayment = TryCatch(async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ message: "Session ID required" });

  console.log("🔹 Verifying Stripe session:", sessionId);

  // Fetch session from Stripe
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session) return res.status(404).json({ message: "Session not found" });

  if (session.payment_status !== "paid") {
    console.warn("⚠️ Payment not successful for session:", sessionId);
    return res.status(400).json({ message: "Payment not completed" });
  }

  const { userId, addressId, method } = session.metadata;

  // Prevent duplicate order
  const existingOrder = await Order.findOne({ paymentInfo: session.id });
  if (existingOrder) {
    console.log("⚠️ Order already exists for session:", session.id);
    return res.json({ success: true, order: existingOrder });
  }

  // Fetch cart
  const cart = await Cart.find({ user: userId }).populate("product");
  if (!cart.length) return res.status(400).json({ message: "Cart is empty" });

  let subTotal = 0;
  const items = cart.map((i) => {
    subTotal += i.product.price * i.quantity;
    return {
      product: i.product._id,
      name: i.product.title.en,
      price: i.product.price,
      quantity: i.quantity,
    };
  });

  const address = await Address.findById(addressId);

  // Create order
  const order = await Order.create({
    items,
    method,
    user: userId,
    name: address.fullName,
    address:address.addressLine1,
    phone: address?.phone || "",
    subTotal,
    paidAt: new Date(),
    paymentInfo: session.id,
  });

  console.log("✅ Order created:", order._id);

  // Update stock
  for (let i of order.items) {
    const product = await Product.findById(i.product);
    if (product) {
      product.stock -= i.quantity;
      product.sold += i.quantity;
      await product.save();
    }
  }

  // Clear cart
  await Cart.deleteMany({ user: userId });
  console.log("🎉 Order flow completed for session:", session.id);
  await sendOrderConfiramtion({
    name:order.address.fullName,
    email: req.user.email,
    subject: "Order confirmation",
    orderId: order._id,
    products: items,
    totalAmount: subTotal,
  });

  return res.status(201).json({
    success: true,
    message: "Order created Successfully",
    order,
  });
});




// ================= STATS =================
export const getStats = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "you are not admin",
    });
  }
  const cod = await Order.find({ method: "cod" }).countDocuments();
  const online = await Order.find({ method: "online" }).countDocuments();

  const products = await Product.find();

  const data = products.map((prod) => ({
    name: prod.title,
    sold: prod.sold,
  }));

  res.json({
    cod,
    online,
    data,
  });
});

export const getLastOrderUpdate = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "you are not admin" });
  }

  // Get the latest updated order
  const lastUpdatedOrder = await Order.findOne()
    .sort({ updatedAt: -1 })
    .select("updatedAt");
    res.json({ lastUpdate: lastUpdatedOrder?.updatedAt || null });
});
