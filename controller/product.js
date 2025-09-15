import { Product } from "../model/product.js";
import bufferGenerator from "../utils/bufferGenerator.js";
import TryCatch from "../utils/trycatch.js";
import cloudinary from "cloudinary";

// Create a new product (Admin only)
export const createProduct = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only can create products" });
  }

  const { title, description, category, price, oldPrice, stock, author } = req.body; 
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
    title: { en: title.en, bn: title.bn },
    description: { en: description.en, bn: description.bn },
    category: { en: category.en, bn: category.bn },
    author: { en: author?.en || "", bn: author?.bn || "" },
    price,
    oldPrice, // 👈 added
    stock,
    images: uploadedImages,
  });

  res.status(201).json({
    message: "Product created",
    product,
  });
});

// Get all products with filters and language
export const getAllProducts = TryCatch(async (req, res) => {
  const { search, author, category, page, sortByPrice, lang = "en" } = req.query;

  const limit = 8;
  const pageNumber = parseInt(page) || 1;
  const skip = (pageNumber - 1) * limit;

  let sortOption = { createdAt: -1 };
  if (sortByPrice === "lowToHigh") sortOption = { price: 1 };
  else if (sortByPrice === "highToLow") sortOption = { price: -1 };

  const query = {};

  if (search) {
    query.$or = [
      { "title.en": { $regex: search, $options: "i" } },
      { "title.bn": { $regex: search, $options: "i" } },
      { "author.en": { $regex: search, $options: "i" } },
      { "author.bn": { $regex: search, $options: "i" } },
    ];
  }

  if (author) {
    query.$or = [
      { "author.en": { $regex: `^${author}$`, $options: "i" } },
      { "author.bn": { $regex: `^${author}$`, $options: "i" } },
    ];
  }

  if (category) {
    query.$or = query.$or
      ? [...query.$or, { "category.en": category }, { "category.bn": category }]
      : [{ "category.en": category }, { "category.bn": category }];
  }

  const productsDocs = await Product.find(query)
    .sort(sortOption)
    .skip(skip)
    .limit(limit);

  const products = productsDocs.map((p) => ({
    _id: p._id,
    title: p.title[lang],
    description: p.description[lang],
    category: p.category[lang],
    author: p.author?.[lang] || "",
    stock: p.stock,
    price: p.price,
    oldPrice: p.oldPrice || null, // 👈 added
    images: p.images,
    sold: p.sold,
    createdAt: p.createdAt,
  }));

  const categoriesList = await Product.distinct(`category.${lang}`);
  const authorList = await Product.distinct(`author.${lang}`);
  const countProduct = await Product.countDocuments(query);
  const totalPages = Math.ceil(countProduct / limit);
  console.log(authorList)

  const newProductDocs = await Product.find().sort("-createdAt").limit(4);
  const formattedNew = newProductDocs.map((p) => ({
    _id: p._id,
    title: p.title[lang],
    description: p.description[lang],
    category: p.category[lang],
    author: p.author?.[lang] || "",
    stock: p.stock,
    price: p.price,
    oldPrice: p.oldPrice || null, // 👈 added
    images: p.images,
    sold: p.sold,
    createdAt: p.createdAt,
  }));

  res.json({
    products,
    categories: categoriesList,
    totalPages,
    newProduct: formattedNew,
    authors:authorList
  });
});

// Get a single product and related products
export const getSingleProduct = TryCatch(async (req, res) => {
  const { lang = "en" } = req.query;
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const relatedProduct = await Product.find({
    $or: [
      { [`category.en`]: product.category.en },
      { [`category.bn`]: product.category.bn },
    ],
    _id: { $ne: product._id },
  }).limit(4);

  res.json({
    product: {
      _id: product._id,
      title: product.title[lang],
      description: product.description[lang],
      category: product.category[lang],
      author: product.author?.[lang] || "",
      stock: product.stock,
      price: product.price,
      oldPrice: product.oldPrice || null, // 👈 added
      images: product.images,
      sold: product.sold,
      createdAt: product.createdAt,
    },
    relatedProduct: relatedProduct.map((rp) => ({
      _id: rp._id,
      title: rp.title[lang],
      description: rp.description[lang],
      category: rp.category[lang],
      author: rp.author?.[lang] || "",
      stock: rp.stock,
      price: rp.price,
      oldPrice: rp.oldPrice || null, // 👈 added
      images: rp.images,
    })),
  });
});

// Update product fields (Admin only)
export const updateProduct = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only can edit products" });
  }

  const { title, description, stock, category, price, oldPrice, author } = req.body;
  const updateFields = {};

  if (title) {
    if (title.en) updateFields["title.en"] = title.en;
    if (title.bn) updateFields["title.bn"] = title.bn;
  }
  if (description) {
    if (description.en) updateFields["description.en"] = description.en;
    if (description.bn) updateFields["description.bn"] = description.bn;
  }
  if (category) {
    if (category.en) updateFields["category.en"] = category.en;
    if (category.bn) updateFields["category.bn"] = category.bn;
  }
  if (author) {
    if (author.en) updateFields["author.en"] = author.en;
    if (author.bn) updateFields["author.bn"] = author.bn;
  }
  if (stock !== undefined) updateFields.stock = stock;
  if (price !== undefined) updateFields.price = price;
  if (oldPrice !== undefined) updateFields.oldPrice = oldPrice; // 👈 added

  const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: updateFields },
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
  if (!product) return res.status(404).json({ message: "Product not found" });

  const oldImages = product.images || [];
  await Promise.allSettled(
    oldImages.map(async (img) => {
      if (img.id) await cloudinary.v2.uploader.destroy(img.id);
    })
  );

  const imageUploadPromises = files.map(async (file) => {
    const fileBuffer = bufferGenerator(file);
    const result = await cloudinary.v2.uploader.upload(fileBuffer.content);
    return { id: result.public_id, url: result.secure_url };
  });

  const uploadedImages = await Promise.all(imageUploadPromises);
  product.images = uploadedImages;
  await product.save();

  res.status(200).json({
    message: "Images updated successfully",
    product,
  });
});

// Autocomplete products (title + author)
export const autocompleteProducts = TryCatch(async (req, res) => {
  const { q = "" } = req.query;
  if (!q.trim()) return res.json([]);

  const pipeline = [
    {
      $search: {
        index: "ProductSearch",
        compound: {
          should: [
            { autocomplete: { query: q, path: "title.en", fuzzy: { maxEdits: 1 } } },
            { autocomplete: { query: q, path: "title.bn", fuzzy: { maxEdits: 1 } } },
            { autocomplete: { query: q, path: "author.en", fuzzy: { maxEdits: 1 } } },
            { autocomplete: { query: q, path: "author.bn", fuzzy: { maxEdits: 1 } } },
            {
              text: {
                query: q,
                path: ["title.en", "title.bn", "author.en", "author.bn"],
                fuzzy: { maxEdits: 1 },
              },
            },
          ],
        },
      },
    },
    {
      $project: {
        _id: 1,
        title: 1,
        author: 1,
        score: { $meta: "searchScore" },
      },
    },
    { $sort: { score: -1 } },
    { $limit: 8 },
  ];

  const results = await Product.aggregate(pipeline);
  res.json(results);
});

// Autocomplete authors only
export const autocompleteAuthors = TryCatch(async (req, res) => {
  const { q = "" } = req.query;
  if (!q.trim()) return res.json([]);

  const pipeline = [
    {
      $search: {
        index: "ProductSearch",
        compound: {
          should: [
            { autocomplete: { query: q, path: "author.en", fuzzy: { maxEdits: 1 } } },
            { autocomplete: { query: q, path: "author.bn", fuzzy: { maxEdits: 1 } } },
          ],
        },
      },
    },
    { $project: { _id: 0, author: 1 } },
    { $limit: 8 },
  ];

  const results = await Product.aggregate(pipeline);
  const authors = results.map((r) => r.author).filter(Boolean);

  res.json(authors);
});

// 👉 New: Distinct authors list
export const getDistinctAuthors = TryCatch(async (req, res) => {
  const { lang = "en" } = req.query;
  const authors = await Product.distinct(`author.${lang}`);
  res.json(authors.filter(Boolean));
});
