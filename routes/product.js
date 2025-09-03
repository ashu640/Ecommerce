import express from "express";
import { 
  createProduct, 
  getAllProducts, 
  getSingleProduct, 
  updateProduct, 
  updateProductImage, 
  autocompleteProducts, 
  autocompleteAuthors   // 👈 import
} from "../controller/product.js";
import { isAuth } from "../middleware/isAuth.js";
import uploadFiles from "../middleware/multer.js";

const router = express.Router();

// CREATE PRODUCT
router.post("/product/new", isAuth, uploadFiles, createProduct);

// GET ALL PRODUCTS
router.get("/product/all", getAllProducts);

// AUTOCOMPLETE (⚡ put BEFORE :id route)
router.get("/product/autocomplete", autocompleteProducts);  // title + author
router.get("/product/author/autocomplete", autocompleteAuthors); // 👈 author-only

// GET SINGLE PRODUCT
router.get("/product/:id", getSingleProduct);

// UPDATE PRODUCT
router.put("/product/:id", isAuth, updateProduct);

// UPDATE PRODUCT IMAGES
router.put("/product/:id/images", isAuth, uploadFiles, updateProductImage);

export default router;
