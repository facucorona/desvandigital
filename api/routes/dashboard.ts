import express from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest, asyncHandler, sendSuccess, sendPaginatedResponse } from '../middleware/errorHandler.js';
import { query as dbQuery } from '../config/database.js';
import { DashboardItem } from '../types.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'));
    }
  },
});

// Get user dashboard items
router.get('/',
  authenticateToken,
  [
    query('type')
      .optional()
      .isIn(['image', 'video', 'audio', 'document', 'note', 'link', 'other'])
      .withMessage('Invalid item type'),
    query('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters'),
    query('search')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('sort')
      .optional()
      .isIn(['newest', 'oldest', 'name_asc', 'name_desc', 'type'])
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
    const userId = req.user!.id;
    const {
      type,
      category,
      search,
      sort = 'newest',
      page = 1,
      limit = 20
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build WHERE clause
    let whereConditions = ['user_id = $1'];
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (type) {
      whereConditions.push(`type = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    if (category) {
      whereConditions.push(`category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        title ILIKE $${paramIndex} OR 
        description ILIKE $${paramIndex} OR 
        tags::text ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Build ORDER BY clause
    let orderBy = 'created_at DESC';
    switch (sort) {
      case 'oldest':
        orderBy = 'created_at ASC';
        break;
      case 'name_asc':
        orderBy = 'title ASC';
        break;
      case 'name_desc':
        orderBy = 'title DESC';
        break;
      case 'type':
        orderBy = 'type ASC, created_at DESC';
        break;
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM dashboard_items WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get dashboard items
    const result = await dbQuery(
      `SELECT id, title, description, type, category, file_url, thumbnail_url,
              file_size, mime_type, tags, metadata, is_favorite, created_at, updated_at
       FROM dashboard_items
       WHERE ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );

    const items = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      category: row.category,
      file_url: row.file_url,
      thumbnail_url: row.thumbnail_url,
      file_size: row.file_size,
      mime_type: row.mime_type,
      tags: row.tags,
      metadata: row.metadata,
      is_favorite: row.is_favorite,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    sendPaginatedResponse(res, items, total, Number(page), Number(limit), 'Dashboard items retrieved successfully');
  })
);

// Get single dashboard item
router.get('/:id',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid item ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    const result = await dbQuery(
      `SELECT id, title, description, type, category, file_url, thumbnail_url,
              file_size, mime_type, tags, metadata, is_favorite, created_at, updated_at
       FROM dashboard_items
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard item not found' });
    }

    const item = result.rows[0];

    sendSuccess(res, {
      id: item.id,
      title: item.title,
      description: item.description,
      type: item.type,
      category: item.category,
      file_url: item.file_url,
      thumbnail_url: item.thumbnail_url,
      file_size: item.file_size,
      mime_type: item.mime_type,
      tags: item.tags,
      metadata: item.metadata,
      is_favorite: item.is_favorite,
      created_at: item.created_at,
      updated_at: item.updated_at
    }, 'Dashboard item retrieved successfully');
  })
);

// Upload dashboard item
router.post('/upload',
  authenticateToken,
  upload.single('file'),
  [
    body('title')
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('type')
      .isIn(['image', 'video', 'audio', 'document', 'note', 'link', 'other'])
      .withMessage('Invalid item type'),
    body('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      type,
      category,
      tags,
      metadata
    } = req.body;
    const userId = req.user!.id;
    const file = req.file;

    let fileUrl = null;
    let thumbnailUrl = null;
    let fileSize = null;
    let mimeType = null;

    if (file) {
      // In a real application, you would upload to a cloud storage service
      fileUrl = `https://api.desvandigital.com/uploads/dashboard/${userId}_${Date.now()}_${file.originalname}`;
      fileSize = file.size;
      mimeType = file.mimetype;

      // Generate thumbnail for images and videos
      if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        thumbnailUrl = `https://api.desvandigital.com/uploads/thumbnails/${userId}_${Date.now()}_thumb.jpg`;
      }
    }

    const result = await dbQuery(
      `INSERT INTO dashboard_items (
        user_id, title, description, type, category, file_url, thumbnail_url,
        file_size, mime_type, tags, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title, type, file_url, created_at`,
      [
        userId, title, description || null, type, category || null,
        fileUrl, thumbnailUrl, fileSize, mimeType,
        JSON.stringify(tags || []), JSON.stringify(metadata || {})
      ]
    );

    const item = result.rows[0];

    sendSuccess(res, {
      id: item.id,
      title: item.title,
      type: item.type,
      file_url: item.file_url,
      created_at: item.created_at
    }, 'Dashboard item uploaded successfully', 201);
  })
);

// Create dashboard item (without file)
router.post('/',
  authenticateToken,
  [
    body('title')
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('type')
      .isIn(['image', 'video', 'audio', 'document', 'note', 'link', 'other'])
      .withMessage('Invalid item type'),
    body('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters'),
    body('file_url')
      .optional()
      .isURL()
      .withMessage('Invalid file URL'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      type,
      category,
      file_url,
      tags,
      metadata
    } = req.body;
    const userId = req.user!.id;

    const result = await dbQuery(
      `INSERT INTO dashboard_items (
        user_id, title, description, type, category, file_url,
        tags, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, title, description, type, category, file_url, created_at`,
      [
        userId, title, description || null, type, category || null,
        file_url || null, JSON.stringify(tags || []), JSON.stringify(metadata || {})
      ]
    );

    const item = result.rows[0];

    sendSuccess(res, item, 'Dashboard item created successfully', 201);
  })
);

// Update dashboard item
router.put('/:id',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid item ID'),
    body('title')
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object'),
    body('is_favorite')
      .optional()
      .isBoolean()
      .withMessage('is_favorite must be a boolean'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if item exists and belongs to user
    const existingResult = await dbQuery(
      'SELECT id FROM dashboard_items WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard item not found' });
    }

    // Build update query
    const updateFields = [];
    const queryParams = [];
    let paramIndex = 1;

    const allowedFields = ['title', 'description', 'category', 'tags', 'metadata', 'is_favorite'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        
        if (['tags', 'metadata'].includes(field)) {
          queryParams.push(JSON.stringify(req.body[field]));
        } else {
          queryParams.push(req.body[field]);
        }
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    queryParams.push(id);

    const result = await dbQuery(
      `UPDATE dashboard_items 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, title, description, type, category, file_url, 
                 tags, metadata, is_favorite, updated_at`,
      queryParams
    );

    const item = result.rows[0];

    sendSuccess(res, item, 'Dashboard item updated successfully');
  })
);

// Delete dashboard item
router.delete('/:id',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid item ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if item exists and belongs to user
    const existingResult = await dbQuery(
      'SELECT id FROM dashboard_items WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard item not found' });
    }

    await dbQuery(
      'DELETE FROM dashboard_items WHERE id = $1',
      [id]
    );

    sendSuccess(res, null, 'Dashboard item deleted successfully');
  })
);

// Toggle favorite status
router.patch('/:id/favorite',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid item ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if item exists and belongs to user
    const existingResult = await dbQuery(
      'SELECT id, is_favorite FROM dashboard_items WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard item not found' });
    }

    const currentFavorite = existingResult.rows[0].is_favorite;
    const newFavorite = !currentFavorite;

    const result = await dbQuery(
      `UPDATE dashboard_items 
       SET is_favorite = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, is_favorite`,
      [newFavorite, id]
    );

    const item = result.rows[0];

    sendSuccess(res, item, `Item ${newFavorite ? 'added to' : 'removed from'} favorites`);
  })
);

// Get dashboard statistics
router.get('/stats/summary',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    // Get item counts by type
    const typeStatsResult = await dbQuery(
      `SELECT type, COUNT(*) as count
       FROM dashboard_items
       WHERE user_id = $1
       GROUP BY type
       ORDER BY count DESC`,
      [userId]
    );

    // Get total storage used
    const storageResult = await dbQuery(
      `SELECT COALESCE(SUM(file_size), 0) as total_storage
       FROM dashboard_items
       WHERE user_id = $1 AND file_size IS NOT NULL`,
      [userId]
    );

    // Get recent activity
    const recentResult = await dbQuery(
      `SELECT COUNT(*) as recent_uploads
       FROM dashboard_items
       WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    // Get favorites count
    const favoritesResult = await dbQuery(
      `SELECT COUNT(*) as favorites_count
       FROM dashboard_items
       WHERE user_id = $1 AND is_favorite = true`,
      [userId]
    );

    const typeStats = typeStatsResult.rows.reduce((acc, row) => {
      acc[row.type] = parseInt(row.count);
      return acc;
    }, {});

    const totalItems = Object.values(typeStats).reduce((sum: number, count: any) => sum + count, 0);

    sendSuccess(res, {
      total_items: totalItems,
      type_breakdown: typeStats,
      total_storage_bytes: parseInt(storageResult.rows[0].total_storage),
      recent_uploads: parseInt(recentResult.rows[0].recent_uploads),
      favorites_count: parseInt(favoritesResult.rows[0].favorites_count)
    }, 'Dashboard statistics retrieved successfully');
  })
);

// Get categories
router.get('/categories/list',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const result = await dbQuery(
      `SELECT category, COUNT(*) as count
       FROM dashboard_items
       WHERE user_id = $1 AND category IS NOT NULL
       GROUP BY category
       ORDER BY count DESC, category ASC`,
      [userId]
    );

    const categories = result.rows.map(row => ({
      name: row.category,
      count: parseInt(row.count)
    }));

    sendSuccess(res, categories, 'Categories retrieved successfully');
  })
);

// Search dashboard items
router.get('/search/advanced',
  authenticateToken,
  [
    query('q')
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('type')
      .optional()
      .isIn(['image', 'video', 'audio', 'document', 'note', 'link', 'other'])
      .withMessage('Invalid item type'),
    query('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters'),
    query('favorites_only')
      .optional()
      .isBoolean()
      .withMessage('favorites_only must be a boolean'),
    query('date_from')
      .optional()
      .isISO8601()
      .withMessage('Invalid date_from'),
    query('date_to')
      .optional()
      .isISO8601()
      .withMessage('Invalid date_to'),
    query('sort')
      .optional()
      .isIn(['relevance', 'newest', 'oldest', 'name_asc', 'name_desc'])
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
    const userId = req.user!.id;
    const {
      q,
      type,
      category,
      favorites_only,
      date_from,
      date_to,
      sort = 'relevance',
      page = 1,
      limit = 20
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build WHERE clause
    let whereConditions = ['user_id = $1'];
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    // Search query
    whereConditions.push(`(
      title ILIKE $${paramIndex} OR 
      description ILIKE $${paramIndex} OR 
      tags::text ILIKE $${paramIndex}
    )`);
    queryParams.push(`%${q}%`);
    paramIndex++;

    if (type) {
      whereConditions.push(`type = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    if (category) {
      whereConditions.push(`category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    if (favorites_only === 'true') {
      whereConditions.push('is_favorite = true');
    }

    if (date_from) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      queryParams.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      queryParams.push(date_to);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Build ORDER BY clause
    let orderBy = 'created_at DESC'; // Default for relevance
    switch (sort) {
      case 'newest':
        orderBy = 'created_at DESC';
        break;
      case 'oldest':
        orderBy = 'created_at ASC';
        break;
      case 'name_asc':
        orderBy = 'title ASC';
        break;
      case 'name_desc':
        orderBy = 'title DESC';
        break;
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM dashboard_items WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get items
    const result = await dbQuery(
      `SELECT id, title, description, type, category, file_url, thumbnail_url,
              file_size, mime_type, tags, metadata, is_favorite, created_at, updated_at
       FROM dashboard_items
       WHERE ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );

    const items = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      category: row.category,
      file_url: row.file_url,
      thumbnail_url: row.thumbnail_url,
      file_size: row.file_size,
      mime_type: row.mime_type,
      tags: row.tags,
      metadata: row.metadata,
      is_favorite: row.is_favorite,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    sendPaginatedResponse(res, items, total, Number(page), Number(limit), `Found ${total} items matching "${q}"`);
  })
);

export default router;