import express from 'express';
import { auth } from '../middleware/auth.js';
import Product from '../models/Product.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Middleware to ensure vendor access
const requireVendor = async (req, res, next) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ message: 'Access denied. Vendor privileges required.' });
  }
  next();
};

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: './uploads/products',
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}-${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5000000 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
}).array('images', 5); // Allow up to 5 images

// Middleware to handle file upload
router.use(auth);
router.use(requireVendor);

// Create a new product
router.post('/products', async (req, res) => {
  try {
    upload(req, res, async function(err) {
      if (err) {
        return res.status(400).json({ message: err.message });
      }

      const {
        name,
        description,
        price,
        category,
        stock,
        specifications,
        dimensions,
        tags
      } = req.body;

      // Process uploaded images
      const images = req.files ? req.files.map(file => ({
        url: `/uploads/products/${file.filename}`,
        alt: name
      })) : [];

      const product = new Product({
        name,
        description,
        price: parseFloat(price),
        images,
        category,
        vendor: req.user.id,
        stock: parseInt(stock),
        specifications: JSON.parse(specifications || '[]'),
        dimensions: JSON.parse(dimensions || '{}'),
        tags: JSON.parse(tags || '[]'),
        status: 'draft'
      });

      await product.save();
      res.status(201).json(product);
    });
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({ message: 'Error creating product' });
  }
});

// Get vendor's products
router.get('/products', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { vendor: req.user.id };
    
    if (status) {
      query.status = status;
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    res.json({
      products,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
});

// Update product
router.put('/products/:productId', async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.productId,
      vendor: req.user.id
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    upload(req, res, async function(err) {
      if (err) {
        return res.status(400).json({ message: err.message });
      }

      const updates = { ...req.body };
      
      // Process new images if uploaded
      if (req.files?.length) {
        const newImages = req.files.map(file => ({
          url: `/uploads/products/${file.filename}`,
          alt: updates.name || product.name
        }));
        updates.images = [...product.images, ...newImages];
      }

      // Parse JSON fields
      if (updates.specifications) {
        updates.specifications = JSON.parse(updates.specifications);
      }
      if (updates.dimensions) {
        updates.dimensions = JSON.parse(updates.dimensions);
      }
      if (updates.tags) {
        updates.tags = JSON.parse(updates.tags);
      }
      if (updates.price) {
        updates.price = parseFloat(updates.price);
      }
      if (updates.stock) {
        updates.stock = parseInt(updates.stock);
      }

      Object.assign(product, updates);
      await product.save();
      res.json(product);
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Error updating product' });
  }
});

// Delete product
router.delete('/products/:productId', async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.productId,
      vendor: req.user.id
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Error deleting product' });
  }
});

// Get vendor dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await Product.aggregate([
      { $match: { vendor: req.user._id } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          publishedProducts: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
          },
          draftProducts: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          outOfStockProducts: {
            $sum: { $cond: [{ $eq: ['$status', 'outOfStock'] }, 1, 0] }
          },
          averageRating: { $avg: '$ratings.average' }
        }
      }
    ]);

    res.json(stats[0] || {
      totalProducts: 0,
      publishedProducts: 0,
      draftProducts: 0,
      outOfStockProducts: 0,
      averageRating: 0
    });
  } catch (error) {
    console.error('Error fetching vendor stats:', error);
    res.status(500).json({ message: 'Error fetching vendor statistics' });
  }
});

export default router;
