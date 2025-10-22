import express from "express";
import dotenv from "dotenv";
import connectDb from "./utils/db.js";
import cloudinary from "cloudinary";
import cors from "cors";
import axios from "axios";
import cookieParser from "cookie-parser";
import morgan from "morgan";

// --------------------------------------
// 🔹 1️⃣ Load environment variables
// --------------------------------------
dotenv.config();

// --------------------------------------
// 🔹 2️⃣ Cloudinary Configuration
// --------------------------------------
cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const app = express();

// --------------------------------------
// 🔹 3️⃣ Core Middlewares
// --------------------------------------
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "https://ecommerce-frontend-sand-ten.vercel.app",
    // origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(morgan("dev")); // logs basic requests info

// --------------------------------------
// 🔹 4️⃣ Custom Logger (for body + response)
// --------------------------------------
app.use((req, res, next) => {
  console.log(`\n🕒 [${new Date().toLocaleString()}] ${req.method} ${req.originalUrl}`);

  if (Object.keys(req.body).length > 0) {
    console.log("📦 Request Body:", req.body);
  }

  const oldSend = res.send.bind(res);
  res.send = (data) => {
    try {
      // Only log small responses to avoid console flooding
      const output = typeof data === "string" && data.length < 500 ? data : "[Large Response]";
      console.log(`✅ Response for ${req.method} ${req.originalUrl}:`, output);
    } catch (e) {
      console.error("❌ Error logging response:", e.message);
    }
    return oldSend(data);
  };

  next();
});

// --------------------------------------
// 🔹 5️⃣ Import Routes
// --------------------------------------
import userRoutes from "./routes/user.js";
import productRoutes from "./routes/product.js";
import cartRoutes from "./routes/cart.js";
import addressRoutes from "./routes/address.js";
import orderRoutes from "./routes/order.js";
import catalogueRoutes from "./routes/catalogue.js";

// --------------------------------------
// 🔹 6️⃣ Mount Routes
// --------------------------------------
app.use("/api", userRoutes);
app.use("/api", productRoutes);
app.use("/api", cartRoutes);
app.use("/api", addressRoutes);
app.use("/api", orderRoutes);
app.use("/api", catalogueRoutes);

// --------------------------------------
// 🔹 7️⃣ Error Handler (must be last)
// --------------------------------------
app.use((err, req, res, next) => {
  console.error(
    `❌ [${new Date().toLocaleString()}] Error on ${req.method} ${req.originalUrl}:`,
    err.stack || err.message
  );
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, error: err.message });
});

// --------------------------------------
// 🔹 8️⃣ Start Server
// --------------------------------------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  connectDb();
});
