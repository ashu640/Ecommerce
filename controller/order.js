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
    address: address._id,
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

  const orders = await Order.find()
    .populate("user")
    .populate("address")
    .sort({ createdAt: -1 });
  res.json(orders);
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

  order.status = req.body.status;
  await order.save();

  console.log(`🔹 Order ${order._id} status updated to ${order.status}`);
  res.json({ message: "Order status updated", order });
});

// ================= CANCEL ORDER =================
export const cancelOrder = TryCatch(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("user")
    .populate("items.product")
    .populate("address");

  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.user._id.toString() !== req.user._id.toString())
    return res.status(403).json({ message: "Not authorized" });

  if (["shipped", "delivered"].includes(order.status))
    return res.status(400).json({ message: "Cannot cancel shipped/delivered order" });

  order.status = "cancelled";
  await order.save();

  await sendOrderCancellation({ email: order.user.email, orderId: order._id });

  console.log("🔹 Order cancelled successfully:", order._id);
  res.json({ message: "Order cancelled successfully", order });
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

// ================= STRIPE WEBHOOK WITH FULL LOGGING =================
export const stripeWebhook = async (req, res) => {
  console.log("⚡ Webhook triggered");

  let event;
  try {
    const sig = req.headers["stripe-signature"];
    const rawBody = req.body; // NOTE: must be raw, handled by express.raw()

    console.log("🔹 Verifying webhook signature");
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.Stripe_Webhook_Key);
    console.log("✅ Webhook verified successfully:", event.type);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log("💳 Checkout completed. Session ID:", session.id);

        // Verify payment status
        if (session.payment_status !== "paid") {
          console.warn("⚠️ Session not fully paid:", session.id, "status:", session.payment_status);
          break;
        }

        console.log("✅ Payment confirmed. Metadata:", session.metadata);
        const { userId, addressId, method } = session.metadata;

        // Fetch cart
        const cart = await Cart.find({ user: userId }).populate("product");
        if (!cart.length) {
          console.warn("⚠️ Cart empty or already processed:", userId);
          break;
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

        // Prevent duplicate order
        const existingOrder = await Order.findOne({ paymentInfo: session.id });
        if (existingOrder) {
          console.warn("⚠️ Order already exists for session:", session.id);
          break;
        }

        const address = await Address.findById(addressId);

        const order = await Order.create({
          items,
          method,
          user: userId,
          address: addressId,
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
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object;
        console.log("✅ PaymentIntent succeeded:", intent.id, "amount:", intent.amount);
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        console.warn("❌ PaymentIntent failed:", intent.id, "reason:", intent.last_payment_error?.message);
        break;
      }

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
        break;
    }

    // ✅ Always respond quickly
    res.json({ received: true });
  } catch (error) {
    console.error("❌ Error processing webhook:", error.message);
    res.status(500).send("Internal Server Error");
  }
};

// ================= STATUS CHECK =================
export const getOrderStatus = TryCatch(async (req, res) => {
  const { sessionId } = req.params;
  const order = await Order.findOne({ paymentInfo: sessionId });

  if (!order) {
    console.warn("⚠️ Order not created yet for session:", sessionId);
    return res.json({ success: false, reason: "Order not created yet" });
  }

  console.log("🔹 Order found for session:", sessionId);
  res.json({ success: true, order });
});

// ================= STATS =================
export const getStats = TryCatch(async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "You are not admin" });

  const totalOrders = await Order.countDocuments();
  const totalRevenue = await Order.aggregate([
    { $group: { _id: null, total: { $sum: "$subTotal" } } },
  ]);

  console.log("🔹 Stats fetched: totalOrders =", totalOrders, ", totalRevenue =", totalRevenue[0]?.total || 0);
  res.json({
    totalOrders,
    totalRevenue: totalRevenue[0]?.total || 0,
  });
});
