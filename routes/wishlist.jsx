import express from "express";
import {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
} from "../controllers/wishlistController.js";
import { isAuthenticated } from "../middleware/auth.js";

const router = express.Router();

// Add product to wishlist
router.post("/add", isAuthenticated, addToWishlist);

// Remove product from wishlist
router.post("/remove", isAuthenticated, removeFromWishlist);

// Get wishlist of logged-in user
router.get("/", isAuthenticated, getWishlist);

export default router;
