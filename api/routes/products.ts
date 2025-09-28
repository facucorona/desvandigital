import express from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest, asyncHandler, sendSuccess, sendPaginatedResponse } from '../middleware/errorHandler';
import { query as dbQuery } from '../config/database';
import { Product } from '../../shared/types';

const router = express.Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Get all products (public)
router.get('/',
  [
    query('category')
      .optional()
      .isIn(['digital_art', 'templates', 'courses', 'tools', 'other'])
      .withMessage('Invalid category'),
    query('min_price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum price must be a positive number'),
    query('max_price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum price must be a positive number'),
    query('search')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('sort')
      .optional()
      .isIn(['newest', 'oldest', 'price_low', 'price_high', 'popular', 'rating'])
      .withMessage('Invalid sort option'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      category,
      min_price,
      max_price,
      search,
      sort = 'newest',
      page = 1,
      limit = 12
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build WHERE clause
    let whereConditions = ['p.is_active = true'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (category) {
      whereConditions.push(`p.category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    if (min_price !== undefined) {
      whereConditions.push(`p.price >= $${paramIndex}`);
      queryParams.push(Number(min_price));
      paramIndex++;
    }

    if (max_price !== undefined) {
      whereConditions.push(`p.price <= $${paramIndex}`);
      queryParams.push(Number(max_price));
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        p.name ILIKE $${paramIndex} OR 
        p.description ILIKE $${paramIndex} OR 
        p.tags::text ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Build ORDER BY clause
    let orderBy = 'p.created_at DESC';
    switch (sort) {
      case 'oldest':
        orderBy = 'p.created_at ASC';
        break;
      case 'price_low':
        orderBy = 'p.price ASC, p.created_at DESC';
        break;
      case 'price_high':
        orderBy = 'p.price DESC, p.created_at DESC';
        break;
      case 'popular':
        orderBy = 'p.sales_count DESC, p.created_at DESC';
        break;
      case 'rating':
        orderBy = 'p.rating DESC, p.created_at DESC';
        break;
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total 
       FROM products p
       JOIN users u ON p.seller_id = u.id
       ${whereClause} AND u.is_active = true`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get products
    const result = await dbQuery(
      `SELECT p.id, p.name, p.description, p.category, p.price, p.rating, 
              p.sales_count, p.image_urls, p.tags, p.created_at,
              u.id as seller_id, u.username as seller_username, 
              u.full_name as seller_name, u.avatar_url as seller_avatar,
              u.is_verified as seller_verified
       FROM products p
       JOIN users u ON p.seller_id = u.id
       ${whereClause} AND u.is_active = true
       ORDER BY ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );

    const products = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      price: parseFloat(row.price),
      rating: parseFloat(row.rating) || 0,
      sales_count: row.sales_count,
      image_urls: row.image_urls,
      tags: row.tags,
      created_at: row.created_at,
      seller: {
        id: row.seller_id,
        username: row.seller_username,
        full_name: row.seller_name,
        avatar_url: row.seller_avatar,
        is_verified: row.seller_verified
      }
    }));

    sendPaginatedResponse(res, products, total, Number(page), Number(limit), 'Products retrieved successfully');
  })
);

// Get single product
router.get('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid product ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await dbQuery(
      `SELECT p.id, p.name, p.description, p.category, p.price, p.rating, 
              p.sales_count, p.image_urls, p.tags, p.file_urls, p.preview_urls,
              p.requirements, p.features, p.created_at, p.updated_at,
              u.id as seller_id, u.username as seller_username, 
              u.full_name as seller_name, u.avatar_url as seller_avatar,
              u.is_verified as seller_verified, u.bio as seller_bio
       FROM products p
       JOIN users u ON p.seller_id = u.id
       WHERE p.id = $1 AND p.is_active = true AND u.is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const row = result.rows[0];
    const product = {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      price: parseFloat(row.price),
      rating: parseFloat(row.rating) || 0,
      sales_count: row.sales_count,
      image_urls: row.image_urls,
      tags: row.tags,
      file_urls: row.file_urls,
      preview_urls: row.preview_urls,
      requirements: row.requirements,
      features: row.features,
      created_at: row.created_at,
      updated_at: row.updated_at,
      seller: {
        id: row.seller_id,
        username: row.seller_username,
        full_name: row.seller_name,
        avatar_url: row.seller_avatar,
        is_verified: row.seller_verified,
        bio: row.seller_bio
      }
    };

    sendSuccess(res, product, 'Product retrieved successfully');
  })
);

// Create product (authenticated users only)
router.post('/',
  authenticateToken,
  upload.array('images', 5),
  [
    body('name')
      .isLength({ min: 3, max: 200 })
      .withMessage('Product name must be between 3 and 200 characters'),
    body('description')
      .isLength({ min: 20, max: 2000 })
      .withMessage('Description must be between 20 and 2000 characters'),
    body('category')
      .isIn(['digital_art', 'templates', 'courses', 'tools', 'other'])
      .withMessage('Invalid category'),
    body('price')
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('requirements')
      .optional()
      .isArray()
      .withMessage('Requirements must be an array'),
    body('features')
      .optional()
      .isArray()
      .withMessage('Features must be an array'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      name,
      description,
      category,
      price,
      tags,
      requirements,
      features
    } = req.body;
    const sellerId = req.user!.id;
    const images = req.files as Express.Multer.File[];

    // Process uploaded images
    let imageUrls: string[] = [];
    if (images && images.length > 0) {
      // In a real application, you would upload to a cloud storage service
      imageUrls = images.map((file, index) => 
        `https://api.desvandigital.com/uploads/products/${sellerId}_${Date.now()}_${index}.${file.originalname.split('.').pop()}`
      );
    }

    const result = await dbQuery(
      `INSERT INTO products (
        seller_id, name, description, category, price, image_urls, tags,
        requirements, features
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, description, category, price, image_urls, created_at`,
      [
        sellerId, name, description, category, price,
        JSON.stringify(imageUrls), JSON.stringify(tags || []),
        JSON.stringify(requirements || []), JSON.stringify(features || [])
      ]
    );

    const product = result.rows[0];

    sendSuccess(res, product, 'Product created successfully', 201);
  })
);

// Update product (seller or admin only)
router.put('/:id',
  authenticateToken,
  upload.array('images', 5),
  [
    param('id')
      .isUUID()
      .withMessage('Invalid product ID'),
    body('name')
      .optional()
      .isLength({ min: 3, max: 200 })
      .withMessage('Product name must be between 3 and 200 characters'),
    body('description')
      .optional()
      .isLength({ min: 20, max: 2000 })
      .withMessage('Description must be between 20 and 2000 characters'),
    body('category')
      .optional()
      .isIn(['digital_art', 'templates', 'courses', 'tools', 'other'])
      .withMessage('Invalid category'),
    body('price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('requirements')
      .optional()
      .isArray()
      .withMessage('Requirements must be an array'),
    body('features')
      .optional()
      .isArray()
      .withMessage('Features must be an array'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const images = req.files as Express.Multer.File[];

    // Check if product exists and user has permission
    const existingResult = await dbQuery(
      'SELECT seller_id, image_urls FROM products WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const sellerId = existingResult.rows[0].seller_id;
    if (userRole !== 'admin' && userId !== sellerId) {
      return res.status(403).json({ error: 'Not authorized to update this product' });
    }

    // Process new images if uploaded
    let imageUrls = existingResult.rows[0].image_urls;
    if (images && images.length > 0) {
      imageUrls = images.map((file, index) => 
        `https://api.desvandigital.com/uploads/products/${sellerId}_${Date.now()}_${index}.${file.originalname.split('.').pop()}`
      );
    }

    // Build update query
    const updateFields = [];
    const queryParams = [];
    let paramIndex = 1;

    const allowedFields = [
      'name', 'description', 'category', 'price', 'tags', 'requirements', 'features'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        
        if (['tags', 'requirements', 'features'].includes(field)) {
          queryParams.push(JSON.stringify(req.body[field]));
        } else {
          queryParams.push(req.body[field]);
        }
        paramIndex++;
      }
    }

    // Always update image_urls if new images were uploaded
    if (images && images.length > 0) {
      updateFields.push(`image_urls = $${paramIndex}`);
      queryParams.push(JSON.stringify(imageUrls));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    queryParams.push(id);

    const result = await dbQuery(
      `UPDATE products 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, description, category, price, image_urls, updated_at`,
      queryParams
    );

    const product = result.rows[0];

    sendSuccess(res, product, 'Product updated successfully');
  })
);

// Delete product (seller or admin only)
router.delete('/:id',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid product ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check if product exists and user has permission
    const existingResult = await dbQuery(
      'SELECT seller_id FROM products WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const sellerId = existingResult.rows[0].seller_id;
    if (userRole !== 'admin' && userId !== sellerId) {
      return res.status(403).json({ error: 'Not authorized to delete this product' });
    }

    // Soft delete
    await dbQuery(
      'UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    sendSuccess(res, null, 'Product deleted successfully');
  })
);

// Get products by seller
router.get('/seller/:sellerId',
  [
    param('sellerId')
      .isUUID()
      .withMessage('Invalid seller ID'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { sellerId } = req.params;
    const { page = 1, limit = 12 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Check if seller exists
    const sellerResult = await dbQuery(
      'SELECT id, username, full_name, avatar_url, is_verified FROM users WHERE id = $1 AND is_active = true',
      [sellerId]
    );

    if (sellerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const seller = sellerResult.rows[0];

    // Get total count
    const countResult = await dbQuery(
      'SELECT COUNT(*) as total FROM products WHERE seller_id = $1 AND is_active = true',
      [sellerId]
    );
    const total = parseInt(countResult.rows[0].total);

    // Get products
    const result = await dbQuery(
      `SELECT id, name, description, category, price, rating, sales_count, 
              image_urls, tags, created_at
       FROM products
       WHERE seller_id = $1 AND is_active = true
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [sellerId, Number(limit), offset]
    );

    const products = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      price: parseFloat(row.price),
      rating: parseFloat(row.rating) || 0,
      sales_count: row.sales_count,
      image_urls: row.image_urls,
      tags: row.tags,
      created_at: row.created_at,
      seller
    }));

    sendPaginatedResponse(res, {
      products,
      seller
    }, total, Number(page), Number(limit), 'Seller products retrieved successfully');
  })
);

// Rate product
router.post('/:id/rate',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid product ID'),
    body('rating')
      .isFloat({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('review')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Review must be less than 1000 characters'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rating, review } = req.body;
    const userId = req.user!.id;

    // Check if product exists
    const productResult = await dbQuery(
      'SELECT seller_id FROM products WHERE id = $1 AND is_active = true',
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if user is not the seller
    if (productResult.rows[0].seller_id === userId) {
      return res.status(400).json({ error: 'Cannot rate your own product' });
    }

    // Check if already rated
    const existingRating = await dbQuery(
      'SELECT id FROM product_ratings WHERE user_id = $1 AND product_id = $2',
      [userId, id]
    );

    if (existingRating.rows.length > 0) {
      // Update existing rating
      await dbQuery(
        'UPDATE product_ratings SET rating = $1, review = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3 AND product_id = $4',
        [rating, review || null, userId, id]
      );
    } else {
      // Create new rating
      await dbQuery(
        'INSERT INTO product_ratings (user_id, product_id, rating, review) VALUES ($1, $2, $3, $4)',
        [userId, id, rating, review || null]
      );
    }

    // Update average rating
    const avgResult = await dbQuery(
      'SELECT AVG(rating) as avg_rating FROM product_ratings WHERE product_id = $1',
      [id]
    );

    const avgRating = parseFloat(avgResult.rows[0].avg_rating) || 0;

    await dbQuery(
      'UPDATE products SET rating = $1 WHERE id = $2',
      [avgRating, id]
    );

    sendSuccess(res, {
      product_id: id,
      user_rating: rating,
      average_rating: avgRating
    }, 'Rating submitted successfully', 201);
  })
);

// Get product ratings
router.get('/:id/ratings',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid product ID'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Check if product exists
    const productResult = await dbQuery(
      'SELECT id FROM products WHERE id = $1 AND is_active = true',
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get total count
    const countResult = await dbQuery(
      'SELECT COUNT(*) as total FROM product_ratings WHERE product_id = $1',
      [id]
    );
    const total = parseInt(countResult.rows[0].total);

    // Get ratings
    const result = await dbQuery(
      `SELECT pr.rating, pr.review, pr.created_at,
              u.id as user_id, u.username, u.full_name, u.avatar_url
       FROM product_ratings pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.product_id = $1 AND u.is_active = true
       ORDER BY pr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, Number(limit), offset]
    );

    const ratings = result.rows.map(row => ({
      rating: parseFloat(row.rating),
      review: row.review,
      created_at: row.created_at,
      user: {
        id: row.user_id,
        username: row.username,
        full_name: row.full_name,
        avatar_url: row.avatar_url
      }
    }));

    sendPaginatedResponse(res, ratings, total, Number(page), Number(limit), 'Product ratings retrieved successfully');
  })
);

// Search products
router.get('/search/advanced',
  [
    query('q')
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('category')
      .optional()
      .isIn(['digital_art', 'templates', 'courses', 'tools', 'other'])
      .withMessage('Invalid category'),
    query('min_price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum price must be a positive number'),
    query('max_price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum price must be a positive number'),
    query('min_rating')
      .optional()
      .isFloat({ min: 0, max: 5 })
      .withMessage('Minimum rating must be between 0 and 5'),
    query('sort')
      .optional()
      .isIn(['relevance', 'newest', 'oldest', 'price_low', 'price_high', 'popular', 'rating'])
      .withMessage('Invalid sort option'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      q,
      category,
      min_price,
      max_price,
      min_rating,
      sort = 'relevance',
      page = 1,
      limit = 12
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build WHERE clause
    let whereConditions = ['p.is_active = true'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Search query
    whereConditions.push(`(
      p.name ILIKE $${paramIndex} OR 
      p.description ILIKE $${paramIndex} OR 
      p.tags::text ILIKE $${paramIndex}
    )`);
    queryParams.push(`%${q}%`);
    paramIndex++;

    if (category) {
      whereConditions.push(`p.category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    if (min_price !== undefined) {
      whereConditions.push(`p.price >= $${paramIndex}`);
      queryParams.push(Number(min_price));
      paramIndex++;
    }

    if (max_price !== undefined) {
      whereConditions.push(`p.price <= $${paramIndex}`);
      queryParams.push(Number(max_price));
      paramIndex++;
    }

    if (min_rating !== undefined) {
      whereConditions.push(`p.rating >= $${paramIndex}`);
      queryParams.push(Number(min_rating));
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Build ORDER BY clause
    let orderBy = 'p.created_at DESC'; // Default for relevance
    switch (sort) {
      case 'newest':
        orderBy = 'p.created_at DESC';
        break;
      case 'oldest':
        orderBy = 'p.created_at ASC';
        break;
      case 'price_low':
        orderBy = 'p.price ASC, p.created_at DESC';
        break;
      case 'price_high':
        orderBy = 'p.price DESC, p.created_at DESC';
        break;
      case 'popular':
        orderBy = 'p.sales_count DESC, p.created_at DESC';
        break;
      case 'rating':
        orderBy = 'p.rating DESC, p.created_at DESC';
        break;
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total 
       FROM products p
       JOIN users u ON p.seller_id = u.id
       WHERE ${whereClause} AND u.is_active = true`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get products
    const result = await dbQuery(
      `SELECT p.id, p.name, p.description, p.category, p.price, p.rating, 
              p.sales_count, p.image_urls, p.tags, p.created_at,
              u.id as seller_id, u.username as seller_username, 
              u.full_name as seller_name, u.avatar_url as seller_avatar,
              u.is_verified as seller_verified
       FROM products p
       JOIN users u ON p.seller_id = u.id
       WHERE ${whereClause} AND u.is_active = true
       ORDER BY ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );

    const products = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      price: parseFloat(row.price),
      rating: parseFloat(row.rating) || 0,
      sales_count: row.sales_count,
      image_urls: row.image_urls,
      tags: row.tags,
      created_at: row.created_at,
      seller: {
        id: row.seller_id,
        username: row.seller_username,
        full_name: row.seller_name,
        avatar_url: row.seller_avatar,
        is_verified: row.seller_verified
      }
    }));

    sendPaginatedResponse(res, products, total, Number(page), Number(limit), `Found ${total} products matching "${q}"`);
  })
);

export default router;