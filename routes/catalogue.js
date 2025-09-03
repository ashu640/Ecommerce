// routes/catalogue.js
import express from "express";
import multer from "multer";
import { isAuth } from "../middleware/isAuth.js"; // your auth middleware
import {
  getCatalogues,
  uploadCatalogue,
  deleteCatalogue,
} from "../controller/catalogue.js";

const router = express.Router();

// multer setup for file upload (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// ================== Catalogue Routes ==================

// Public: get all catalogues
router.get("/catalogues", getCatalogues);

// Admin-only actions (role checked inside controller)
router.post("/catalogues", isAuth, upload.single("file"), uploadCatalogue);
router.delete("/catalogues/:id", isAuth, deleteCatalogue);

export default router;
