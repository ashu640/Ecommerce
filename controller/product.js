import { Product } from "../model/product.js";
import bufferGenerator from "../utils/bufferGenerator.js";
import TryCatch from "../utils/trycatch.js";
import cloudinary from 'cloudinary';

// Create a new product (Admin only)
export const createProduct = TryCatch(async (req, res) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin only can create products" });
    }

    const { title, description, category, price, stock } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files to upload" });
    }

    const imageUploadPromises = files.map(async (file) => {
        const fileBuffer = bufferGenerator(file);
        const result = await cloudinary.v2.uploader.upload(fileBuffer.content);
        return {
            id: result.public_id,
            url: result.secure_url,
        };
    });

    const uploadedImages = await Promise.all(imageUploadPromises);

    const product = await Product.create({
        title,
        description,
        category,
        price,
        stock,
        images: uploadedImages,
    });

    res.status(201).json({
        message: "Product created",
        product,
    });
});

// Get all products with filters
export const getAllProducts = TryCatch(async (req, res) => {
    const { search, category, page, sortByPrice } = req.query;
    const filter = {};

    if (search) {
        filter.title = { $regex: search, $options: "i" };
    }

    if (category) {
        filter.category = category;
    }

    const limit = 8;
    const pageNumber = parseInt(page) || 1;
    const skip = (pageNumber - 1) * limit;

    let sortOption = { createdAt: -1 };
    if (sortByPrice === "lowToHigh") {
        sortOption = { price: 1 };
    } else if (sortByPrice === "highToLow") {
        sortOption = { price: -1 };
    }

    const products = await Product.find(filter)
        .sort(sortOption)
        .limit(limit)
        .skip(skip);

    const categories = await Product.distinct("category");
    const newProduct = await Product.find().sort("-createdAt").limit(4);
    const countProduct = await Product.countDocuments(filter);
    const totalPages = Math.ceil(countProduct / limit);

    res.json({
        products,
        categories,
        totalPages,
        newProduct,
    });
});

// Get a single product and related products
export const getSingleProduct = TryCatch(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const relatedProduct = await Product.find({
        category: product.category,
        _id: { $ne: product._id },//exclude current one 
    }).limit(4);

    res.json({ product, relatedProduct });
});

// Update product fields (Admin only)
export const updateProduct = TryCatch(async (req, res) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin only can edit products" });
    }

    const { title, description, stock, category, price } = req.body;
    const updateFields = {};

    if (title) updateFields.title = title;
    if (description) updateFields.description = description;
    if (stock) updateFields.stock = stock;
    if (price) updateFields.price = price;
    if (category) updateFields.category = category;

    const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        updateFields,
        { new: true, runValidators: true }
    );

    if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" });
    }

    res.json({
        message: "Product updated",
        updatedProduct,
    });
});

// Update product images (Admin only)
export const updateProductImage = TryCatch(async (req, res) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin only can update product images" });
    }

    const { id } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files to upload" });
    }

    const product = await Product.findById(id);
    if (!product) {
        return res.status(404).json({ message: "Product not found" });
    }

    const oldImages = product.images || [];

    // Delete old images from Cloudinary
    await Promise.allSettled(
        oldImages.map(async (img) => {
            if (img.id) {
                await cloudinary.v2.uploader.destroy(img.id);
            }
        })
    );

    // Upload new images
    const imageUploadPromises = files.map(async (file) => {
        const fileBuffer = bufferGenerator(file);
        const result = await cloudinary.v2.uploader.upload(fileBuffer.content);
        return {
            id: result.public_id,
            url: result.secure_url,
        };
    });

    const uploadedImages = await Promise.all(imageUploadPromises);
    product.images = uploadedImages;
    await product.save();

    res.status(200).json({
        message: "Images updated successfully",
        product,
    });
});
