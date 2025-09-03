// models/Catalogue.js
import mongoose from "mongoose";

const catalogueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    fileUrl: { type: String, required: true },
    filePublicId: { type: String, required: true },
    fileType: { type: String, enum: ["pdf", "image"], default: "pdf" },
    sizeBytes: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Catalogue", catalogueSchema);
