import express from "express";
import dotenv from "dotenv";
import connectDb from "./utils/db.js";
import cloudinary from "cloudinary";
import cors from "cors";
import axios from "axios";
import cookieParser from "cookie-parser";
import morgan from "morgan";

dotenv.config();

// ---------------------------
// 🔹 1️⃣ Configure Cloudinary
// ---------------------------
cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const app = express();

// ---------------------------
// 🔹 2️⃣ Core middlewares (must come first)
// ---------------------------
app.use(morgan("dev")); // Logs method, route, status, time
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

// ---------------------------
// 🔹 3️⃣ Custom request/response logger
// ---------------------------
app.use((req, res, next) => {
  console.log(
    `\n🕒 [${new Date().toLocaleString()}] ${req.method} ${req.originalUrl}`
  );

  if (Object.keys(req.body).length > 0) {
    console.log("📦 Request Body:", req.body);
  }

  // Capture and log response
  const oldSend = res.send;
  res.send = function (data) {
    console.log(`✅ Response for ${req.method} ${req.originalUrl}:`, data);
    oldSend.apply(res, arguments);
  };

  next();
});

// ---------------------------
// 🔹 4️⃣ Import & use routes
// ---------------------------
import userRoutes from "./routes/user.js";
import productRoutes from "./routes/product.js";
import cartRoutes from "./routes/cart.js";
import addressRoutes from "./routes/address.js";
import orderRoutes from "./routes/order.js";
import catalogueRoutes from "./routes/catalogue.js";

app.use("/api", userRoutes);
app.use("/api", productRoutes);
app.use("/api", cartRoutes);
app.use("/api", addressRoutes);
app.use("/api", orderRoutes);
app.use("/api", catalogueRoutes);

// ---------------------------
// 🔹 5️⃣ Error handling middleware (must be last)
// ---------------------------
app.use((err, req, res, next) => {
  console.error(
    `❌ [${new Date().toLocaleString()}] Error on ${req.method} ${req.originalUrl}:`,
    err.message
  );
  res.status(500).json({ error: err.message });
});

// ---------------------------
// 🔹 6️⃣ Start the server
// ---------------------------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  connectDb();
});
