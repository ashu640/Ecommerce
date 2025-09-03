// controller/catalogue.js
import Catalogue from "../model/catalogue.js";
import cloudinary from "cloudinary";
import bufferGenerator from "../utils/bufferGenerator.js";
import TryCatch from "../utils/trycatch.js";

// ================= GET ALL CATALOGUES (public) =================
export const getCatalogues = TryCatch(async (req, res) => {
  const catalogues = await Catalogue.find().sort({ createdAt: -1 });
  res.json(catalogues);
});

// ================= UPLOAD CATALOGUE (Admin Only) =================
export const uploadCatalogue = TryCatch(async (req, res) => {
  // admin check
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only can upload catalogues" });
  }

  const { title, description } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ message: "No file provided" });
  if (!title) return res.status(400).json({ message: "Title required" });

  let result;

  // ✅ If PDF → upload as raw and force format pdf
  if (file.mimetype === "application/pdf") {
    result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        { resource_type: "raw", folder: "catalogues", format: "pdf" },
        (error, response) => {
          if (error) return reject(error);
          resolve(response);
        }
      );
      uploadStream.end(file.buffer);
    });
  } else {
    // ✅ For images keep using your bufferGenerator
    const fileBuffer = bufferGenerator(file);
    result = await cloudinary.v2.uploader.upload(fileBuffer.content, {
      folder: "catalogues",
    });
  }

  // create catalogue record
  const catalogue = await Catalogue.create({
    title,
    description,
    fileUrl: result.secure_url,
    filePublicId: result.public_id,
    fileType: file.mimetype === "application/pdf" ? "pdf" : "image",
    sizeBytes: file.size,
    createdBy: req.user._id,
  });

  res.status(201).json({
    message: "Catalogue uploaded successfully",
    catalogue,
  });
});

// ================= DELETE CATALOGUE (Admin Only) =================
export const deleteCatalogue = TryCatch(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only can delete catalogues" });
  }

  const catalogue = await Catalogue.findById(req.params.id);
  if (!catalogue) return res.status(404).json({ message: "Catalogue not found" });

  const resourceType = catalogue.fileType === "pdf" ? "raw" : "image";

  await cloudinary.v2.uploader.destroy(catalogue.filePublicId, {
    resource_type: resourceType,
  });

  await catalogue.deleteOne();

  res.json({ message: "Catalogue deleted successfully" });
});
