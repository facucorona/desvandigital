import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken, requireRole, requireSubscription } from '../middleware/auth';
import { validateRequest, asyncHandler, sendSuccess, sendPaginatedResponse } from '../middleware/errorHandler';
import { query as dbQuery } from '../config/database';
import { StudyRoute } from '../../shared/types';

const router = express.Router();

// Get all study routes (public)
router.get('/',
  [
    query('category')
      .optional()
      .isIn(['programming', 'design', 'business', 'marketing', 'other'])
      .withMessage('Invalid category'),
    query('difficulty')
      .optional()
      .isIn(['beginner', 'intermediate', 'advanced'])
      .withMessage('Invalid difficulty level'),
    query('is_premium')
      .optional()
      .isBoolean()
      .withMessage('is_premium must be a boolean'),
    query('search')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('sort')
      .optional()
      .isIn(['newest', 'oldest', 'popular', 'rating', 'duration'])
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
      difficulty,
      is_premium,
      search,
      sort = 'newest',
      page = 1,
      limit = 12
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build WHERE clause
    let whereConditions = ['sr.is_active = true'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (category) {
      whereConditions.push(`sr.category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    if (difficulty) {
      whereConditions.push(`sr.difficulty = $${paramIndex}`);
      queryParams.push(difficulty);
      paramIndex++;
    }

    if (is_premium !== undefined) {
      whereConditions.push(`sr.is_premium = $${paramIndex}`);
      queryParams.push(is_premium === 'true');
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        sr.title ILIKE $${paramIndex} OR 
        sr.description ILIKE $${paramIndex} OR 
        sr.tags::text ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Build ORDER BY clause
    let orderBy = 'sr.created_at DESC';
    switch (sort) {
      case 'oldest':
        orderBy = 'sr.created_at ASC';
        break;
      case 'popular':
        orderBy = 'sr.enrollment_count DESC, sr.created_at DESC';
        break;
      case 'rating':
        orderBy = 'sr.rating DESC, sr.created_at DESC';
        break;
      case 'duration':
        orderBy = 'sr.estimated_duration ASC, sr.created_at DESC';
        break;
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total 
       FROM study_routes sr
       JOIN users u ON sr.instructor_id = u.id
       ${whereClause} AND u.is_active = true`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get study routes
    const result = await dbQuery(
      `SELECT sr.id, sr.title, sr.description, sr.category, sr.difficulty, 
              sr.is_premium, sr.price, sr.estimated_duration, sr.rating, 
              sr.enrollment_count, sr.thumbnail_url, sr.tags, sr.created_at,
              u.id as instructor_id, u.username as instructor_username, 
              u.full_name as instructor_name, u.avatar_url as instructor_avatar,
              u.is_verified as instructor_verified
       FROM study_routes sr
       JOIN users u ON sr.instructor_id = u.id
       ${whereClause} AND u.is_active = true
       ORDER BY ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );

    const studyRoutes = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      difficulty: row.difficulty,
      is_premium: row.is_premium,
      price: row.price,
      estimated_duration: row.estimated_duration,
      rating: parseFloat(row.rating) || 0,
      enrollment_count: row.enrollment_count,
      thumbnail_url: row.thumbnail_url,
      tags: row.tags,
      created_at: row.created_at,
      instructor: {
        id: row.instructor_id,
        username: row.instructor_username,
        full_name: row.instructor_name,
        avatar_url: row.instructor_avatar,
        is_verified: row.instructor_verified
      }
    }));

    sendPaginatedResponse(res, studyRoutes, total, Number(page), Number(limit), 'Study routes retrieved successfully');
  })
);

// Get single study route
router.get('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid study route ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await dbQuery(
      `SELECT sr.id, sr.title, sr.description, sr.content, sr.category, 
              sr.difficulty, sr.is_premium, sr.price, sr.estimated_duration, 
              sr.rating, sr.enrollment_count, sr.thumbnail_url, sr.tags, 
              sr.requirements, sr.what_you_learn, sr.created_at, sr.updated_at,
              u.id as instructor_id, u.username as instructor_username, 
              u.full_name as instructor_name, u.avatar_url as instructor_avatar,
              u.is_verified as instructor_verified, u.bio as instructor_bio
       FROM study_routes sr
       JOIN users u ON sr.instructor_id = u.id
       WHERE sr.id = $1 AND sr.is_active = true AND u.is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Study route not found' });
    }

    const row = result.rows[0];
    const studyRoute = {
      id: row.id,
      title: row.title,
      description: row.description,
      content: row.content,
      category: row.category,
      difficulty: row.difficulty,
      is_premium: row.is_premium,
      price: row.price,
      estimated_duration: row.estimated_duration,
      rating: parseFloat(row.rating) || 0,
      enrollment_count: row.enrollment_count,
      thumbnail_url: row.thumbnail_url,
      tags: row.tags,
      requirements: row.requirements,
      what_you_learn: row.what_you_learn,
      created_at: row.created_at,
      updated_at: row.updated_at,
      instructor: {
        id: row.instructor_id,
        username: row.instructor_username,
        full_name: row.instructor_name,
        avatar_url: row.instructor_avatar,
        is_verified: row.instructor_verified,
        bio: row.instructor_bio
      }
    };

    sendSuccess(res, studyRoute, 'Study route retrieved successfully');
  })
);

// Create study route (instructors only)
router.post('/',
  authenticateToken,
  requireRole(['instructor', 'admin']),
  [
    body('title')
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be between 5 and 200 characters'),
    body('description')
      .isLength({ min: 20, max: 1000 })
      .withMessage('Description must be between 20 and 1000 characters'),
    body('content')
      .isLength({ min: 100 })
      .withMessage('Content must be at least 100 characters'),
    body('category')
      .isIn(['programming', 'design', 'business', 'marketing', 'other'])
      .withMessage('Invalid category'),
    body('difficulty')
      .isIn(['beginner', 'intermediate', 'advanced'])
      .withMessage('Invalid difficulty level'),
    body('is_premium')
      .isBoolean()
      .withMessage('is_premium must be a boolean'),
    body('price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('estimated_duration')
      .isInt({ min: 1 })
      .withMessage('Estimated duration must be a positive integer (minutes)'),
    body('thumbnail_url')
      .optional()
      .isURL()
      .withMessage('Invalid thumbnail URL'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('requirements')
      .optional()
      .isArray()
      .withMessage('Requirements must be an array'),
    body('what_you_learn')
      .optional()
      .isArray()
      .withMessage('What you learn must be an array'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      content,
      category,
      difficulty,
      is_premium,
      price,
      estimated_duration,
      thumbnail_url,
      tags,
      requirements,
      what_you_learn
    } = req.body;
    const instructorId = req.user!.id;

    // Validate price for premium routes
    if (is_premium && (!price || price <= 0)) {
      return res.status(400).json({ error: 'Premium routes must have a valid price' });
    }

    const result = await dbQuery(
      `INSERT INTO study_routes (
        instructor_id, title, description, content, category, difficulty,
        is_premium, price, estimated_duration, thumbnail_url, tags,
        requirements, what_you_learn
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, title, description, category, difficulty, is_premium, 
                price, estimated_duration, thumbnail_url, created_at`,
      [
        instructorId, title, description, content, category, difficulty,
        is_premium, price || null, estimated_duration, thumbnail_url || null,
        JSON.stringify(tags || []), JSON.stringify(requirements || []),
        JSON.stringify(what_you_learn || [])
      ]
    );

    const studyRoute = result.rows[0];

    sendSuccess(res, studyRoute, 'Study route created successfully', 201);
  })
);

// Update study route (instructor or admin only)
router.put('/:id',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid study route ID'),
    body('title')
      .optional()
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be between 5 and 200 characters'),
    body('description')
      .optional()
      .isLength({ min: 20, max: 1000 })
      .withMessage('Description must be between 20 and 1000 characters'),
    body('content')
      .optional()
      .isLength({ min: 100 })
      .withMessage('Content must be at least 100 characters'),
    body('category')
      .optional()
      .isIn(['programming', 'design', 'business', 'marketing', 'other'])
      .withMessage('Invalid category'),
    body('difficulty')
      .optional()
      .isIn(['beginner', 'intermediate', 'advanced'])
      .withMessage('Invalid difficulty level'),
    body('is_premium')
      .optional()
      .isBoolean()
      .withMessage('is_premium must be a boolean'),
    body('price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('estimated_duration')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Estimated duration must be a positive integer (minutes)'),
    body('thumbnail_url')
      .optional()
      .isURL()
      .withMessage('Invalid thumbnail URL'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('requirements')
      .optional()
      .isArray()
      .withMessage('Requirements must be an array'),
    body('what_you_learn')
      .optional()
      .isArray()
      .withMessage('What you learn must be an array'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check if study route exists and user has permission
    const existingResult = await dbQuery(
      'SELECT instructor_id FROM study_routes WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Study route not found' });
    }

    const instructorId = existingResult.rows[0].instructor_id;
    if (userRole !== 'admin' && userId !== instructorId) {
      return res.status(403).json({ error: 'Not authorized to update this study route' });
    }

    // Build update query
    const updateFields = [];
    const queryParams = [];
    let paramIndex = 1;

    const allowedFields = [
      'title', 'description', 'content', 'category', 'difficulty',
      'is_premium', 'price', 'estimated_duration', 'thumbnail_url',
      'tags', 'requirements', 'what_you_learn'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        
        if (['tags', 'requirements', 'what_you_learn'].includes(field)) {
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
      `UPDATE study_routes 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, title, description, category, difficulty, is_premium, 
                 price, estimated_duration, thumbnail_url, updated_at`,
      queryParams
    );

    const studyRoute = result.rows[0];

    sendSuccess(res, studyRoute, 'Study route updated successfully');
  })
);

// Delete study route (instructor or admin only)
router.delete('/:id',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid study route ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check if study route exists and user has permission
    const existingResult = await dbQuery(
      'SELECT instructor_id FROM study_routes WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Study route not found' });
    }

    const instructorId = existingResult.rows[0].instructor_id;
    if (userRole !== 'admin' && userId !== instructorId) {
      return res.status(403).json({ error: 'Not authorized to delete this study route' });
    }

    // Soft delete
    await dbQuery(
      'UPDATE study_routes SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    sendSuccess(res, null, 'Study route deleted successfully');
  })
);

// Enroll in study route
router.post('/:id/enroll',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid study route ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if study route exists
    const routeResult = await dbQuery(
      'SELECT id, title, is_premium, price, instructor_id FROM study_routes WHERE id = $1 AND is_active = true',
      [id]
    );

    if (routeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Study route not found' });
    }

    const studyRoute = routeResult.rows[0];

    // Check if user is the instructor
    if (studyRoute.instructor_id === userId) {
      return res.status(400).json({ error: 'Cannot enroll in your own study route' });
    }

    // Check if already enrolled
    const enrollmentResult = await dbQuery(
      'SELECT id FROM user_enrollments WHERE user_id = $1 AND study_route_id = $2',
      [userId, id]
    );

    if (enrollmentResult.rows.length > 0) {
      return res.status(400).json({ error: 'Already enrolled in this study route' });
    }

    // Check if premium route and user has subscription
    if (studyRoute.is_premium) {
      const userResult = await dbQuery(
        'SELECT subscription_type, subscription_expires_at FROM users WHERE id = $1',
        [userId]
      );

      const user = userResult.rows[0];
      const now = new Date();
      const hasValidSubscription = user.subscription_type === 'premium' && 
                                  new Date(user.subscription_expires_at) > now;

      if (!hasValidSubscription) {
        return res.status(403).json({ 
          error: 'Premium subscription required for this study route',
          requires_subscription: true
        });
      }
    }

    // Create enrollment
    await dbQuery(
      'INSERT INTO user_enrollments (user_id, study_route_id) VALUES ($1, $2)',
      [userId, id]
    );

    // Update enrollment count
    await dbQuery(
      'UPDATE study_routes SET enrollment_count = enrollment_count + 1 WHERE id = $1',
      [id]
    );

    sendSuccess(res, {
      study_route_id: id,
      enrolled_at: new Date().toISOString()
    }, 'Successfully enrolled in study route', 201);
  })
);

// Unenroll from study route
router.delete('/:id/enroll',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid study route ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if enrolled
    const enrollmentResult = await dbQuery(
      'SELECT id FROM user_enrollments WHERE user_id = $1 AND study_route_id = $2',
      [userId, id]
    );

    if (enrollmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not enrolled in this study route' });
    }

    // Remove enrollment
    await dbQuery(
      'DELETE FROM user_enrollments WHERE user_id = $1 AND study_route_id = $2',
      [userId, id]
    );

    // Update enrollment count
    await dbQuery(
      'UPDATE study_routes SET enrollment_count = GREATEST(enrollment_count - 1, 0) WHERE id = $1',
      [id]
    );

    sendSuccess(res, null, 'Successfully unenrolled from study route');
  })
);

// Get user's enrolled study routes
router.get('/user/enrolled',
  authenticateToken,
  [
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
    const { page = 1, limit = 12 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const userId = req.user!.id;

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total 
       FROM user_enrollments ue
       JOIN study_routes sr ON ue.study_route_id = sr.id
       WHERE ue.user_id = $1 AND sr.is_active = true`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].total);

    // Get enrolled study routes
    const result = await dbQuery(
      `SELECT sr.id, sr.title, sr.description, sr.category, sr.difficulty, 
              sr.is_premium, sr.price, sr.estimated_duration, sr.rating, 
              sr.enrollment_count, sr.thumbnail_url, sr.tags,
              ue.enrolled_at, ue.progress, ue.completed_at,
              u.id as instructor_id, u.username as instructor_username, 
              u.full_name as instructor_name, u.avatar_url as instructor_avatar,
              u.is_verified as instructor_verified
       FROM user_enrollments ue
       JOIN study_routes sr ON ue.study_route_id = sr.id
       JOIN users u ON sr.instructor_id = u.id
       WHERE ue.user_id = $1 AND sr.is_active = true AND u.is_active = true
       ORDER BY ue.enrolled_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, Number(limit), offset]
    );

    const enrolledRoutes = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      difficulty: row.difficulty,
      is_premium: row.is_premium,
      price: row.price,
      estimated_duration: row.estimated_duration,
      rating: parseFloat(row.rating) || 0,
      enrollment_count: row.enrollment_count,
      thumbnail_url: row.thumbnail_url,
      tags: row.tags,
      enrollment: {
        enrolled_at: row.enrolled_at,
        progress: row.progress,
        completed_at: row.completed_at,
        is_completed: !!row.completed_at
      },
      instructor: {
        id: row.instructor_id,
        username: row.instructor_username,
        full_name: row.instructor_name,
        avatar_url: row.instructor_avatar,
        is_verified: row.instructor_verified
      }
    }));

    sendPaginatedResponse(res, enrolledRoutes, total, Number(page), Number(limit), 'Enrolled study routes retrieved successfully');
  })
);

// Update progress in study route
router.patch('/:id/progress',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid study route ID'),
    body('progress')
      .isFloat({ min: 0, max: 100 })
      .withMessage('Progress must be between 0 and 100'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { progress } = req.body;
    const userId = req.user!.id;

    // Check if enrolled
    const enrollmentResult = await dbQuery(
      'SELECT id, progress FROM user_enrollments WHERE user_id = $1 AND study_route_id = $2',
      [userId, id]
    );

    if (enrollmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not enrolled in this study route' });
    }

    const currentProgress = enrollmentResult.rows[0].progress;

    // Update progress
    const updateFields = ['progress = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const queryParams = [progress, userId, id];

    // Mark as completed if progress is 100%
    if (progress >= 100 && currentProgress < 100) {
      updateFields.push('completed_at = CURRENT_TIMESTAMP');
    } else if (progress < 100) {
      updateFields.push('completed_at = NULL');
    }

    await dbQuery(
      `UPDATE user_enrollments 
       SET ${updateFields.join(', ')}
       WHERE user_id = $2 AND study_route_id = $3`,
      queryParams
    );

    sendSuccess(res, {
      study_route_id: id,
      progress,
      is_completed: progress >= 100
    }, 'Progress updated successfully');
  })
);

// Rate study route
router.post('/:id/rate',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid study route ID'),
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

    // Check if enrolled
    const enrollmentResult = await dbQuery(
      'SELECT id FROM user_enrollments WHERE user_id = $1 AND study_route_id = $2',
      [userId, id]
    );

    if (enrollmentResult.rows.length === 0) {
      return res.status(403).json({ error: 'Must be enrolled to rate this study route' });
    }

    // Check if already rated
    const existingRating = await dbQuery(
      'SELECT id FROM study_route_ratings WHERE user_id = $1 AND study_route_id = $2',
      [userId, id]
    );

    if (existingRating.rows.length > 0) {
      // Update existing rating
      await dbQuery(
        'UPDATE study_route_ratings SET rating = $1, review = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3 AND study_route_id = $4',
        [rating, review || null, userId, id]
      );
    } else {
      // Create new rating
      await dbQuery(
        'INSERT INTO study_route_ratings (user_id, study_route_id, rating, review) VALUES ($1, $2, $3, $4)',
        [userId, id, rating, review || null]
      );
    }

    // Update average rating
    const avgResult = await dbQuery(
      'SELECT AVG(rating) as avg_rating FROM study_route_ratings WHERE study_route_id = $1',
      [id]
    );

    const avgRating = parseFloat(avgResult.rows[0].avg_rating) || 0;

    await dbQuery(
      'UPDATE study_routes SET rating = $1 WHERE id = $2',
      [avgRating, id]
    );

    sendSuccess(res, {
      study_route_id: id,
      user_rating: rating,
      average_rating: avgRating
    }, 'Rating submitted successfully', 201);
  })
);

export default router;