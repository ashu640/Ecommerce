import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String, // keep as string because some countries use leading zeros
      required: true,
    },
    alternatePhone: {
      type: String,
    },
    addressLine1: {
      type: String, // House / Flat / Building
      required: true,
    },
    addressLine2: {
      type: String, // Street / Locality / Landmark
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    postalCode: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
      default: "India", // you can set default country if your app is region-specific
    },
    isDefault: {
      type: Boolean,
      default: false, // user can set one address as default for checkout
    },
  },
  { timestamps: true }
);

export const Address = mongoose.model("Address", addressSchema);
