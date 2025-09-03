import { Cart } from "../model/cart.js";
import { Order } from "../model/order.js";
import { Product } from "../model/product.js";
import sendOrderCancellation from "../utils/sendOrderCancellation.js";
import sendOrderConfiramtion from "../utils/sendOrderconfirmation.js";
import TryCatch from "../utils/trycatch.js";
import Stripe from "stripe";

// ================= COD ORDER =================
export const newOrderCod = TryCatch(async (req, res) => {
  const { method, phone, address } = req.body;
  const cart = await Cart.find({ user: req.user._id }).populate({
    path: "product",
    select: "title price",
  });

  if (!cart.length) return res.status(400).json({ message: "cart is empty" });

  let subTotal = 0;
  const items = cart.map((i) => {
    const itemSubtotal = i.product.price * i.quantity;
    subTotal += itemSubtotal;

    return {
      product: i.product._id,
      name: i.product.title.en,
      price: i.product.price,
      quantity: i.quantity,
    };
  });

  const order = await Order.create({
    items,
    method,
    user: req.user._id,
    phone,
    address,
    subTotal,
  });

  for (let i of order.items) {
    const product = await Product.findById(i.product);
    if (product) {
      product.stock -= i.quantity;
      product.sold += i.quantity;
      await product.save();
    }
  }

  await Cart.deleteMany({ user: req.user._id });

  await sendOrderConfiramtion({
    email: req.user.email,
    subject: "Order confirmation",
    orderId: order._id,
    products: items,
    totalAmount: subTotal,
  });

  res.json({
    message: "order created successfully",
    order,
  });
});

// ================= GET ORDERS =================
export const getAllOrders = TryCatch(async (req, res) => {
  const orders = await Order.find({
    user: req.user._id,
  });
  res.json({ orders: orders.reverse() });
});

export const getAllOrdersAdmin = TryCatch(async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "you are not admin" });

  const orders = await Order.find().populate("user").sort({ createdAt: -1 });
  res.json(orders);
});

export const getMyOrder = TryCatch(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("items.product")
    .populate("user");
  res.json(order);
});

// ================= UPDATE STATUS =================
export const updateStatus = TryCatch(async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "you are not admin" });

  const order = await Order.findById(req.params.id).populate("user").populate("items.product");
  const { status } = req.body;

  if (!order) return res.status(404).json({ message: "Order not found" });

  order.status = status;
  await order.save();

  // ✅ If admin cancels, send email to both
  if (status === "cancelled") {
    const items = order.items.map(i => ({
      product: i.product._id,
      name: i.product.title.en,
      price: i.product.price,
      quantity: i.quantity,
    }));

    const subTotal = order.subTotal || items.reduce((acc, i) => acc + i.price * i.quantity, 0);

    // Send to user
    await sendOrderCancellation({
      email: order.user.email,
      subject: "Order Cancelled by Admin",
      orderId: order._id,
      products: items,
      totalAmount: subTotal,
      extraMessage: "Your order was cancelled by the administrator.",
    });

    // Send to admin
    await sendOrderCancellation({
      email: process.env.admin_email,
      subject: "Order Cancelled (Admin Action)",
      orderId: order._id,
      products: items,
      totalAmount: subTotal,
      extraMessage: `Order ${order._id} was cancelled by admin.`,
    });
  }

  res.json({
    message: "order status updated",
    order,
  });
});


// ================= CANCEL ORDER =================

export const cancelOrder = TryCatch(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("user")
    .populate("items.product");
    console.log(order.items)

  if (!order) return res.status(404).json({ message: "Order not found" });
  console.log(process.env.admin_email)
  if (
    order.user._id.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ message: "Not authorized to cancel this order" });
  }

  if (order.status === "shipped" || order.status === "delivered") {
    return res.status(400).json({
      message: "Order cannot be cancelled once it is shipped or delivered",
    });
  }

  if (order.status === "cancelled") {
    return res.status(400).json({ message: "Order already cancelled" });
  }

  order.status = "cancelled";
  await order.save();

  // ✅ Extract items + subtotal safely
  const items = order.items.map(i => ({
    product: i.product._id,
    name: i.product.title.en,
    price: i.product.price,
    quantity: i.quantity,
  }));

  const subTotal = order.subTotal || items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  console.log(order.user.email)
  await sendOrderCancellation({
    email: order.user.email,
    subject: "Order Cancelled",
    orderId: order._id,
    products: items,
    totalAmount: subTotal,
    extraMessage: "Your order has been cancelled.",
  });
console.log(process.env.admin_email)
  await sendOrderCancellation({
    email: process.env.admin_email,
    subject: "Order Cancelled by User/Admin",
    orderId: order._id,
    products: items,
    totalAmount: subTotal,
    extraMessage: `Order ${order._id} was cancelled.`,
  });

  res.json({ message: "Order cancelled successfully", order });
});

// ================= STRIPE (ONLINE ORDER) =================
const stripe = new Stripe(process.env.Stripe_Secret_key);

export const newOrderOnline = async (req, res) => {
  try {
    const { method, phone, address } = req.body;
    const cart = await Cart.find({ user: req.user._id }).populate("product");

    if (!cart.length) {
      return res.status(400).json({ message: "cart is empty" });
    }

    const subTotal = cart.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );

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
      metadata: {
        userId: req.user._id.toString(),
        phone,
        address,
        subTotal,
        method,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.log("Error creating Stripe session:", error.message);
    res.status(500).json({ message: "Failed to create payment session" });
  }
};

export const verifyPayment = async (req, res) => {
  const { sessionId } = req.body;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const { userId, phone, address, method } = session.metadata;

    const cart = await Cart.find({ user: userId }).populate("product");

    if (!cart.length) {
      return res
        .status(400)
        .json({ message: "Cart is empty or already processed" });
    }

    let backendSubTotal = 0;
    const items = cart.map((i) => {
      const itemSubtotal = i.product.price * i.quantity;
      backendSubTotal += itemSubtotal;

      return {
        product: i.product._id,
        name: i.product.title.en,
        price: i.product.price,
        quantity: i.quantity,
      };
    });

    if (session.amount_total !== Math.round(backendSubTotal * 100)) {
      return res.status(400).json({
        message: "Payment amount mismatch! Possible tampering detected",
      });
    }

    const existingOrder = await Order.findOne({ paymentInfo: sessionId });
    if (existingOrder) {
      return res
        .status(200)
        .json({ message: "Order already created", order: existingOrder });
    }

    const order = await Order.create({
      items,
      method,
      user: userId,
      address,
      phone,
      subTotal: backendSubTotal,
      paidAt: new Date(),
      paymentInfo: sessionId,
    });

    for (let i of order.items) {
      const product = await Product.findById(i.product);
      if (product) {
        product.stock -= i.quantity;
        product.sold += i.quantity;
        await product.save();
      }
    }

    await Cart.deleteMany({ user: userId });

    await sendOrderConfiramtion({
      email: req.user.email,
      subject: "Order confirmation",
      orderId: order._id,
      products: items,
      totalAmount: backendSubTotal,
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    console.log("Error verifying payment:", error.message);
    res.status(500).json({ message: error.message });
  }
};

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
    name: prod.title.en,
    sold: prod.sold,
  }));

  res.json({
    cod,
    online,
    data,
  });
});
// ================= POLLING ENDPOINT =================
export const getLastOrderUpdate = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "you are not admin" });
  }

  // Get the latest updated order
  const lastUpdatedOrder = await Order.findOne().sort({ updatedAt: -1 }).select("updatedAt");

  res.json({
    lastUpdate: lastUpdatedOrder ? lastUpdatedOrder.updatedAt : null,
  });
});

