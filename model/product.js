import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  title: {
    en: { type: String, required: true },
    bn: { type: String, required: true },
  },
  description: {
    en: { type: String, required: true },
    bn: { type: String, required: true },
  },
  stock: {
    type: Number,
    required: true,
  },
  price: {                       // 👈 Current / New Price
    type: Number,
    required: true,
  },
  oldPrice: {                    // 👈 Old Price (optional, strikethrough)
    type: Number,
    required: false,
  },
  images: [
    {
      id: String,
      url: String,
    },
  ],
  sold: {
    type: Number,
    default: 0,
  },
  category: {
    en: { type: String, required: true },
    bn: { type: String, required: true },
  },
  author: {
    en: { type: String, required: false },
    bn: { type: String, required: false },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Product = mongoose.model("Product", productSchema);
