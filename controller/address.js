import { Address } from "../model/address.js";
import TryCatch from "../utils/trycatch.js";

// ✅ Add new address
export const addAddress = TryCatch(async (req, res) => {
  const {
    fullName,
    phone,
    alternatePhone,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
    isDefault,
  } = req.body;

  // If user marks this as default, unset other default addresses
  if (isDefault) {
    await Address.updateMany(
      { user: req.user._id, isDefault: true },
      { $set: { isDefault: false } }
    );
  }

  const newAddress = await Address.create({
    user: req.user._id,
    fullName,
    phone,
    alternatePhone,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
    isDefault,
  });

  res.status(201).json({
    message: "Address created successfully",
    address: newAddress,
  });
});

// ✅ Get all addresses of logged-in user
export const getAllAddress = TryCatch(async (req, res) => {
  const allAddress = await Address.find({ user: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(allAddress);
});

// ✅ Get a single address
export const getSingleAddress = TryCatch(async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!address)
    return res.status(404).json({ message: "Address not found" });

  res.json(address);
});

// ✅ Delete address
export const deleteAddress = TryCatch(async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!address)
    return res.status(404).json({ message: "Address not found" });

  await address.deleteOne();
  res.json({ message: "Address deleted successfully" });
});
