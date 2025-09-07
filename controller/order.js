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
  const { method, addressId } = req.body;
  const cart = await Cart.find({ user: req.user._id }).populate("product");

  if (!cart.length) return res.status(400).json({ message: "Cart is empty" });

  const address = await Address.findOne({ _id: addressId, user: req.user._id });
  if (!address) return res.status(404).json({ message: "Address not found" });

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
    return res
      .status(400)
      .json({ message: "Cannot cancel shipped/delivered order" });

  order.status = "cancelled";
  await order.save();

  res.json({ message: "Order cancelled successfully", order });
});

// ================= STRIPE CHECKOUT =================
export const newOrderOnline = TryCatch(async (req, res) => {
  const { method, addressId } = req.body;

  const cart = await Cart.find({ user: req.user._id }).populate("product");
  if (!cart.length) return res.status(400).json({ message: "Cart is empty" });

  const address = await Address.findOne({ _id: addressId, user: req.user._id });
  if (!address) return res.status(404).json({ message: "Address not found" });

  const lineItems = cart.map((item) => ({
    price_data: {
      currency: "inr",
      product_data: { name: item.product.title.en ,
        images: [item.product.images[0].url],},
      unit_amount: Math.round(item.product.price * 100),
    },
    quantity: item.quantity,
  }));
   //create session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    success_url: `${process.env.Frontend_Url}/ordersuccess?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.Frontend_Url}/cart`,
    metadata: { userId: req.user._id.toString(), addressId, method },
  });

  res.json({ url: session.url });
});

// ================= STRIPE WEBHOOK =================
export const stripeWebhook = async (req, res) => {
  let event;

  try {
    // Stripe sends raw body as text
    const sig = req.headers["stripe-signature"]; // correct in Express
    const rawBody = req.body; // express.raw gives raw buffer

    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.Stripe_Webhook_Key
    );
  } catch (err) {
    console.log("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const { userId, addressId, method } = session.metadata;

        // Fetch user's cart
        const cart = await Cart.find({ user: userId }).populate("product");
        if (!cart.length) {
          console.log("Cart is empty or already processed");
          return res.status(400).send("Cart is empty or already processed");
        }

        // Recompute subtotal and build items array
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

        // Prevent duplicate order creation
        const existingOrder = await Order.findOne({ paymentInfo: session.id });
        if (existingOrder) {
          console.log("Order already exists for this session:", session.id);
          return res.json({ received: true });
        }

        // Create order
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

        // Update product stock and sold count
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

        console.log("Order created successfully for session:", session.id);
        break;
      }

      case "checkout.session.async_payment_failed":
      case "payment_intent.payment_failed":
        console.log("Payment failed for session:", event.data.object.id);
        return res.status(400).send("Payment failed");

      default:
        console.log(`Unhandled event type ${event.type}`);
        break;
    }

    // Respond to Stripe that the webhook was received
    res.json({ received: true });
  } catch (error) {
    console.log("Error processing webhook:", error.message);
    res.status(500).send("Internal Server Error");
  }
};


// ================= STATUS CHECK =================
export const getOrderStatus = TryCatch(async (req, res) => {
  const { sessionId } = req.params;
  const order = await Order.findOne({ paymentInfo: sessionId });

  if (!order) return res.json({ success: false, reason: "Order not created yet" });

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

  res.json({
    totalOrders,
    totalRevenue: totalRevenue[0]?.total || 0,
  });
});
