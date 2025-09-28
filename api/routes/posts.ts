import express from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import { authenticateToken, requireRole, optionalAuth } from '../middleware/auth';
import { validateRequest, asyncHandler, sendSuccess, sendPaginatedResponse } from '../middleware/errorHandler';
import { query as dbQuery } from '../config/database';
import { Post } from '../../shared/types';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  },
});

// Get posts feed
router.get('/',
  optionalAuth,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('type')
      .optional()
      .isIn(['all', 'following', 'trending'])
      .withMessage('Invalid feed type'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, type = 'all' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const currentUserId = req.user?.id;

    let whereClause = 'WHERE p.is_active = true';
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Filter by feed type
    if (type === 'following' && currentUserId) {
      whereClause += ` AND (p.author_id = $${paramIndex} OR p.author_id IN (
        SELECT following_id FROM follows WHERE follower_id = $${paramIndex}
      ))`;
      queryParams.push(currentUserId);
      paramIndex++;
    } else if (type === 'trending') {
      // Trending posts: high engagement in last 24 hours
      whereClause += ` AND p.created_at >= NOW() - INTERVAL '24 hours'
                       AND (p.likes_count + p.comments_count) > 0`;
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total 
       FROM posts p
       JOIN users u ON p.author_id = u.id
       ${whereClause} AND u.is_active = true`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get posts with author info
    let orderBy = 'ORDER BY p.created_at DESC';
    if (type === 'trending') {
      orderBy = 'ORDER BY (p.likes_count + p.comments_count) DESC, p.created_at DESC';
    }

    const result = await dbQuery(
      `SELECT p.id, p.content, p.image_urls, p.video_url, p.likes_count, 
              p.comments_count, p.shares_count, p.is_active, p.created_at, p.updated_at,
              u.id as author_id, u.username, u.full_name, u.avatar_url, u.is_verified
       FROM posts p
       JOIN users u ON p.author_id = u.id
       ${whereClause} AND u.is_active = true
       ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );

    const posts = result.rows.map(row => ({
      id: row.id,
      content: row.content,
      image_urls: row.image_urls,
      video_url: row.video_url,
      likes_count: row.likes_count,
      comments_count: row.comments_count,
      shares_count: row.shares_count,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      author: {
        id: row.author_id,
        username: row.username,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        is_verified: row.is_verified
      }
    }));

    // Check if current user liked each post
    if (currentUserId && posts.length > 0) {
      const postIds = posts.map(post => post.id);
      const likesResult = await dbQuery(
        'SELECT post_id FROM likes WHERE user_id = $1 AND post_id = ANY($2)',
        [currentUserId, postIds]
      );
      
      const likedPostIds = new Set(likesResult.rows.map(row => row.post_id));
      posts.forEach(post => {
        (post as any).is_liked = likedPostIds.has(post.id);
      });
    }

    sendPaginatedResponse(res, posts, total, Number(page), Number(limit), 'Posts retrieved successfully');
  })
);

// Get single post
router.get('/:postId',
  optionalAuth,
  [
    param('postId')
      .isUUID()
      .withMessage('Invalid post ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const currentUserId = req.user?.id;

    const result = await dbQuery(
      `SELECT p.id, p.content, p.image_urls, p.video_url, p.likes_count, 
              p.comments_count, p.shares_count, p.is_active, p.created_at, p.updated_at,
              u.id as author_id, u.username, u.full_name, u.avatar_url, u.is_verified
       FROM posts p
       JOIN users u ON p.author_id = u.id
       WHERE p.id = $1 AND p.is_active = true AND u.is_active = true`,
      [postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const row = result.rows[0];
    const post = {
      id: row.id,
      content: row.content,
      image_urls: row.image_urls,
      video_url: row.video_url,
      likes_count: row.likes_count,
      comments_count: row.comments_count,
      shares_count: row.shares_count,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      author: {
        id: row.author_id,
        username: row.username,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        is_verified: row.is_verified
      }
    };

    // Check if current user liked this post
    if (currentUserId) {
      const likeResult = await dbQuery(
        'SELECT id FROM likes WHERE user_id = $1 AND post_id = $2',
        [currentUserId, postId]
      );
      (post as any).is_liked = likeResult.rows.length > 0;
    }

    sendSuccess(res, post, 'Post retrieved successfully');
  })
);

// Create new post
router.post('/',
  authenticateToken,
  upload.array('media', 5), // Allow up to 5 media files
  [
    body('content')
      .isLength({ min: 1, max: 2000 })
      .withMessage('Content must be between 1 and 2000 characters'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { content } = req.body;
    const authorId = req.user!.id;
    const files = req.files as Express.Multer.File[];

    let imageUrls: string[] = [];
    let videoUrl: string | null = null;

    // Process uploaded files
    if (files && files.length > 0) {
      for (const file of files) {
        // In a real application, you would upload to a cloud storage service
        const fileUrl = `https://api.desvandigital.com/uploads/posts/${authorId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${file.mimetype.split('/')[1]}`;
        
        if (file.mimetype.startsWith('image/')) {
          imageUrls.push(fileUrl);
        } else if (file.mimetype.startsWith('video/')) {
          if (!videoUrl) { // Only one video per post
            videoUrl = fileUrl;
          }
        }
      }
    }

    // Create post
    const result = await dbQuery(
      `INSERT INTO posts (author_id, content, image_urls, video_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, author_id, content, image_urls, video_url, likes_count, 
                 comments_count, shares_count, is_active, created_at, updated_at`,
      [authorId, content, imageUrls.length > 0 ? imageUrls : null, videoUrl]
    );

    const post = result.rows[0];

    // Get author info
    const authorResult = await dbQuery(
      'SELECT id, username, full_name, avatar_url, is_verified FROM users WHERE id = $1',
      [authorId]
    );

    post.author = authorResult.rows[0];
    post.is_liked = false;

    sendSuccess(res, post, 'Post created successfully', 201);
  })
);

// Update post
router.put('/:postId',
  authenticateToken,
  [
    param('postId')
      .isUUID()
      .withMessage('Invalid post ID'),
    body('content')
      .isLength({ min: 1, max: 2000 })
      .withMessage('Content must be between 1 and 2000 characters'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    // Check if post exists and user owns it
    const postResult = await dbQuery(
      'SELECT author_id FROM posts WHERE id = $1 AND is_active = true',
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (postResult.rows[0].author_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this post' });
    }

    // Update post
    const result = await dbQuery(
      `UPDATE posts 
       SET content = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, author_id, content, image_urls, video_url, likes_count, 
                 comments_count, shares_count, is_active, created_at, updated_at`,
      [content, postId]
    );

    const post = result.rows[0];

    // Get author info
    const authorResult = await dbQuery(
      'SELECT id, username, full_name, avatar_url, is_verified FROM users WHERE id = $1',
      [post.author_id]
    );

    post.author = authorResult.rows[0];

    sendSuccess(res, post, 'Post updated successfully');
  })
);

// Delete post
router.delete('/:postId',
  authenticateToken,
  [
    param('postId')
      .isUUID()
      .withMessage('Invalid post ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check if post exists
    const postResult = await dbQuery(
      'SELECT author_id FROM posts WHERE id = $1 AND is_active = true',
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check authorization (owner or admin)
    if (postResult.rows[0].author_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    // Soft delete post
    await dbQuery(
      'UPDATE posts SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [postId]
    );

    sendSuccess(res, null, 'Post deleted successfully');
  })
);

// Like post
router.post('/:postId/like',
  authenticateToken,
  [
    param('postId')
      .isUUID()
      .withMessage('Invalid post ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const userId = req.user!.id;

    // Check if post exists
    const postResult = await dbQuery(
      'SELECT id FROM posts WHERE id = $1 AND is_active = true',
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if already liked
    const existingLike = await dbQuery(
      'SELECT id FROM likes WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );

    if (existingLike.rows.length > 0) {
      return res.status(400).json({ error: 'Post already liked' });
    }

    // Add like and update count
    await dbQuery('BEGIN');
    
    try {
      await dbQuery(
        'INSERT INTO likes (user_id, post_id) VALUES ($1, $2)',
        [userId, postId]
      );

      const result = await dbQuery(
        'UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count',
        [postId]
      );

      await dbQuery('COMMIT');

      sendSuccess(res, { 
        liked: true, 
        likes_count: result.rows[0].likes_count 
      }, 'Post liked successfully');
    } catch (error) {
      await dbQuery('ROLLBACK');
      throw error;
    }
  })
);

// Unlike post
router.delete('/:postId/like',
  authenticateToken,
  [
    param('postId')
      .isUUID()
      .withMessage('Invalid post ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const userId = req.user!.id;

    // Remove like and update count
    await dbQuery('BEGIN');
    
    try {
      const deleteResult = await dbQuery(
        'DELETE FROM likes WHERE user_id = $1 AND post_id = $2',
        [userId, postId]
      );

      if (deleteResult.rowCount === 0) {
        await dbQuery('ROLLBACK');
        return res.status(404).json({ error: 'Like not found' });
      }

      const result = await dbQuery(
        'UPDATE posts SET likes_count = likes_count - 1 WHERE id = $1 RETURNING likes_count',
        [postId]
      );

      await dbQuery('COMMIT');

      sendSuccess(res, { 
        liked: false, 
        likes_count: result.rows[0].likes_count 
      }, 'Post unliked successfully');
    } catch (error) {
      await dbQuery('ROLLBACK');
      throw error;
    }
  })
);

// Get post likes
router.get('/:postId/likes',
  optionalAuth,
  [
    param('postId')
      .isUUID()
      .withMessage('Invalid post ID'),
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
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Check if post exists
    const postResult = await dbQuery(
      'SELECT id FROM posts WHERE id = $1 AND is_active = true',
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Get total count
    const countResult = await dbQuery(
      'SELECT COUNT(*) as total FROM likes WHERE post_id = $1',
      [postId]
    );
    const total = parseInt(countResult.rows[0].total);

    // Get likes with user info
    const result = await dbQuery(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
              l.created_at as liked_at
       FROM likes l
       JOIN users u ON l.user_id = u.id
       WHERE l.post_id = $1 AND u.is_active = true
       ORDER BY l.created_at DESC
       LIMIT $2 OFFSET $3`,
      [postId, Number(limit), offset]
    );

    sendPaginatedResponse(res, result.rows, total, Number(page), Number(limit), 'Post likes retrieved successfully');
  })
);

// Get user posts
router.get('/user/:userId',
  optionalAuth,
  [
    param('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
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
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const currentUserId = req.user?.id;

    // Check if user exists
    const userResult = await dbQuery(
      'SELECT id, username, full_name, avatar_url, is_verified FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get total count
    const countResult = await dbQuery(
      'SELECT COUNT(*) as total FROM posts WHERE author_id = $1 AND is_active = true',
      [userId]
    );
    const total = parseInt(countResult.rows[0].total);

    // Get posts
    const result = await dbQuery(
      `SELECT id, content, image_urls, video_url, likes_count, 
              comments_count, shares_count, is_active, created_at, updated_at
       FROM posts
       WHERE author_id = $1 AND is_active = true
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, Number(limit), offset]
    );

    const posts = result.rows.map(post => ({
      ...post,
      author: user
    }));

    // Check if current user liked each post
    if (currentUserId && posts.length > 0) {
      const postIds = posts.map(post => post.id);
      const likesResult = await dbQuery(
        'SELECT post_id FROM likes WHERE user_id = $1 AND post_id = ANY($2)',
        [currentUserId, postIds]
      );
      
      const likedPostIds = new Set(likesResult.rows.map(row => row.post_id));
      posts.forEach(post => {
        (post as any).is_liked = likedPostIds.has(post.id);
      });
    }

    sendPaginatedResponse(res, posts, total, Number(page), Number(limit), 'User posts retrieved successfully');
  })
);

// Admin: Get all posts
router.get('/admin/all',
  authenticateToken,
  requireRole(['admin']),
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('Invalid status'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND p.is_active = $${paramIndex}`;
      queryParams.push(status === 'active');
      paramIndex++;
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total 
       FROM posts p
       JOIN users u ON p.author_id = u.id
       ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get posts
    const result = await dbQuery(
      `SELECT p.id, p.content, p.image_urls, p.video_url, p.likes_count, 
              p.comments_count, p.shares_count, p.is_active, p.created_at, p.updated_at,
              u.id as author_id, u.username, u.full_name, u.avatar_url, u.is_verified
       FROM posts p
       JOIN users u ON p.author_id = u.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );

    const posts = result.rows.map(row => ({
      id: row.id,
      content: row.content,
      image_urls: row.image_urls,
      video_url: row.video_url,
      likes_count: row.likes_count,
      comments_count: row.comments_count,
      shares_count: row.shares_count,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      author: {
        id: row.author_id,
        username: row.username,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        is_verified: row.is_verified
      }
    }));

    sendPaginatedResponse(res, posts, total, Number(page), Number(limit), 'Posts retrieved successfully');
  })
);

export default router;