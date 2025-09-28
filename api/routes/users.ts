import express from 'express';
import { body, param, query } from 'express-validator';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { authenticateToken, requireRole, optionalAuth } from '../middleware/auth';
import { validateRequest, asyncHandler, sendSuccess, sendPaginatedResponse } from '../middleware/errorHandler';
import { query as dbQuery } from '../config/database';
import { User } from '../../shared/types';

const router = express.Router();

// Configure multer for file uploads
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

// Get user profile
router.get('/profile',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const result = await dbQuery(
      `SELECT id, username, email, full_name, avatar_url, bio, location, 
              website, role, subscription_type, subscription_expires_at,
              is_verified, is_active, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0] as User;
    sendSuccess(res, user, 'Profile retrieved successfully');
  })
);

// Update user profile
router.put('/profile',
  authenticateToken,
  [
    body('full_name')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters'),
    body('bio')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Bio must not exceed 500 characters'),
    body('location')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Location must not exceed 100 characters'),
    body('website')
      .optional()
      .isURL()
      .withMessage('Website must be a valid URL'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { full_name, bio, location, website } = req.body;

    const result = await dbQuery(
      `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           bio = COALESCE($2, bio),
           location = COALESCE($3, location),
           website = COALESCE($4, website),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, username, email, full_name, avatar_url, bio, location, 
                 website, role, subscription_type, is_verified, created_at, updated_at`,
      [full_name, bio, location, website, userId]
    );

    const user = result.rows[0] as User;
    sendSuccess(res, user, 'Profile updated successfully');
  })
);

// Upload avatar
router.post('/avatar',
  authenticateToken,
  upload.single('avatar'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user!.id;
    
    // In a real application, you would upload to a cloud storage service
    // For now, we'll simulate saving the file and return a mock URL
    const avatarUrl = `https://api.desvandigital.com/uploads/avatars/${userId}_${Date.now()}.${req.file.mimetype.split('/')[1]}`;

    const result = await dbQuery(
      `UPDATE users 
       SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING avatar_url`,
      [avatarUrl, userId]
    );

    sendSuccess(res, { avatar_url: result.rows[0].avatar_url }, 'Avatar updated successfully');
  })
);

// Get user by ID or username
router.get('/:identifier',
  optionalAuth,
  [
    param('identifier')
      .notEmpty()
      .withMessage('User identifier is required'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { identifier } = req.params;
    const currentUserId = req.user?.id;

    // Check if identifier is UUID (user ID) or username
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
    
    const result = await dbQuery(
      `SELECT id, username, full_name, avatar_url, bio, location, website,
              role, is_verified, created_at,
              (SELECT COUNT(*) FROM posts WHERE author_id = users.id) as posts_count,
              (SELECT COUNT(*) FROM follows WHERE following_id = users.id) as followers_count,
              (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) as following_count
       FROM users 
       WHERE ${isUUID ? 'id' : 'username'} = $1 AND is_active = true`,
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Check if current user follows this user
    if (currentUserId && currentUserId !== user.id) {
      const followResult = await dbQuery(
        'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
        [currentUserId, user.id]
      );
      user.is_following = followResult.rows.length > 0;
    }

    sendSuccess(res, user, 'User retrieved successfully');
  })
);

// Search users
router.get('/',
  optionalAuth,
  [
    query('q')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
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
    const { q = '', page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const currentUserId = req.user?.id;

    let whereClause = 'WHERE is_active = true';
    const queryParams: any[] = [];

    if (q) {
      whereClause += ' AND (username ILIKE $1 OR full_name ILIKE $1)';
      queryParams.push(`%${q}%`);
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get users
    const result = await dbQuery(
      `SELECT id, username, full_name, avatar_url, bio, is_verified, created_at,
              (SELECT COUNT(*) FROM posts WHERE author_id = users.id) as posts_count,
              (SELECT COUNT(*) FROM follows WHERE following_id = users.id) as followers_count
       FROM users ${whereClause}
       ORDER BY 
         CASE WHEN $${queryParams.length + 1} != '' THEN
           CASE 
             WHEN username ILIKE $${queryParams.length + 1} THEN 1
             WHEN full_name ILIKE $${queryParams.length + 1} THEN 2
             ELSE 3
           END
         ELSE created_at DESC
         END,
         followers_count DESC
       LIMIT $${queryParams.length + 2} OFFSET $${queryParams.length + 3}`,
      [...queryParams, q || '', Number(limit), offset]
    );

    const users = result.rows;

    // Check follow status for each user if current user is authenticated
    if (currentUserId) {
      const userIds = users.map(user => user.id);
      if (userIds.length > 0) {
        const followsResult = await dbQuery(
          `SELECT following_id FROM follows 
           WHERE follower_id = $1 AND following_id = ANY($2)`,
          [currentUserId, userIds]
        );
        
        const followingIds = new Set(followsResult.rows.map(row => row.following_id));
        users.forEach(user => {
          user.is_following = followingIds.has(user.id);
        });
      }
    }

    sendPaginatedResponse(res, users, total, Number(page), Number(limit), 'Users retrieved successfully');
  })
);

// Follow user
router.post('/:userId/follow',
  authenticateToken,
  [
    param('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const followerId = req.user!.id;

    if (userId === followerId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if user exists
    const userResult = await dbQuery(
      'SELECT id FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already following
    const existingFollow = await dbQuery(
      'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, userId]
    );

    if (existingFollow.rows.length > 0) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    // Create follow relationship
    await dbQuery(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
      [followerId, userId]
    );

    sendSuccess(res, { following: true }, 'User followed successfully');
  })
);

// Unfollow user
router.delete('/:userId/follow',
  authenticateToken,
  [
    param('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const followerId = req.user!.id;

    const result = await dbQuery(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Follow relationship not found' });
    }

    sendSuccess(res, { following: false }, 'User unfollowed successfully');
  })
);

// Get user followers
router.get('/:userId/followers',
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

    // Get total count
    const countResult = await dbQuery(
      'SELECT COUNT(*) as total FROM follows WHERE following_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].total);

    // Get followers
    const result = await dbQuery(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.bio, u.is_verified,
              f.created_at as followed_at
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = $1 AND u.is_active = true
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, Number(limit), offset]
    );

    const followers = result.rows;

    // Check follow status for each follower if current user is authenticated
    if (currentUserId) {
      const followerIds = followers.map(follower => follower.id);
      if (followerIds.length > 0) {
        const followsResult = await dbQuery(
          `SELECT following_id FROM follows 
           WHERE follower_id = $1 AND following_id = ANY($2)`,
          [currentUserId, followerIds]
        );
        
        const followingIds = new Set(followsResult.rows.map(row => row.following_id));
        followers.forEach(follower => {
          follower.is_following = followingIds.has(follower.id);
        });
      }
    }

    sendPaginatedResponse(res, followers, total, Number(page), Number(limit), 'Followers retrieved successfully');
  })
);

// Get user following
router.get('/:userId/following',
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

    // Get total count
    const countResult = await dbQuery(
      'SELECT COUNT(*) as total FROM follows WHERE follower_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].total);

    // Get following
    const result = await dbQuery(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.bio, u.is_verified,
              f.created_at as followed_at
       FROM follows f
       JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = $1 AND u.is_active = true
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, Number(limit), offset]
    );

    const following = result.rows;

    // Check follow status for each user if current user is authenticated
    if (currentUserId && currentUserId !== userId) {
      const followingIds = following.map(user => user.id);
      if (followingIds.length > 0) {
        const followsResult = await dbQuery(
          `SELECT following_id FROM follows 
           WHERE follower_id = $1 AND following_id = ANY($2)`,
          [currentUserId, followingIds]
        );
        
        const myFollowingIds = new Set(followsResult.rows.map(row => row.following_id));
        following.forEach(user => {
          user.is_following = myFollowingIds.has(user.id);
        });
      }
    }

    sendPaginatedResponse(res, following, total, Number(page), Number(limit), 'Following retrieved successfully');
  })
);

// Admin: Get all users
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
    query('role')
      .optional()
      .isIn(['user', 'premium', 'admin'])
      .withMessage('Invalid role'),
    query('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('Invalid status'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, role, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (role) {
      whereClause += ` AND role = $${paramIndex}`;
      queryParams.push(role);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND is_active = $${paramIndex}`;
      queryParams.push(status === 'active');
      paramIndex++;
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get users
    const result = await dbQuery(
      `SELECT id, username, email, full_name, avatar_url, role, subscription_type,
              subscription_expires_at, is_verified, is_active, created_at, updated_at,
              (SELECT COUNT(*) FROM posts WHERE author_id = users.id) as posts_count,
              (SELECT COUNT(*) FROM follows WHERE following_id = users.id) as followers_count
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );

    sendPaginatedResponse(res, result.rows, total, Number(page), Number(limit), 'Users retrieved successfully');
  })
);

// Admin: Update user status
router.patch('/admin/:userId/status',
  authenticateToken,
  requireRole(['admin']),
  [
    param('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
    body('is_active')
      .isBoolean()
      .withMessage('is_active must be a boolean'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { is_active } = req.body;

    const result = await dbQuery(
      `UPDATE users 
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, username, is_active`,
      [is_active, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    sendSuccess(res, result.rows[0], 'User status updated successfully');
  })
);

export default router;