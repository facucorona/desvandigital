import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { generateToken, generateRefreshToken, verifyRefreshToken, authenticateToken } from '../middleware/auth.js';
import { asyncHandler, successResponse, CustomValidationError, ConflictError, AuthenticationError, NotFoundError } from '../middleware/errorHandler.js';
import { User, AuthResponse } from '../types.js';

const router = express.Router();

// Validation rules
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('full_name')
    .isLength({ min: 2, max: 255 })
    .withMessage('Full name must be between 2 and 255 characters')
    .trim()
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Register new user
router.post('/register', registerValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomValidationError('Validation failed');
  }

  const { username, email, password, full_name } = req.body;

  // Check if user already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );

  if (existingUser.rows.length > 0) {
    throw new ConflictError('User with this email or username already exists');
  }

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const result = await query(
    `INSERT INTO users (username, email, password_hash, full_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, full_name, role, subscription_type, created_at, updated_at`,
    [username, email, passwordHash, full_name]
  );

  const user = result.rows[0] as User;

  // Generate tokens
  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  const refreshToken = generateRefreshToken({
    id: user.id,
    email: user.email
  });

  const authResponse: AuthResponse = {
    user,
    token,
    refreshToken
  };

  successResponse(res, authResponse, 'User registered successfully', 201);
}));

// Login user
router.post('/login', loginValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomValidationError('Validation failed');
  }

  const { email, password } = req.body;

  // Find user
  const result = await query(
    `SELECT id, username, email, password_hash, full_name, avatar_url, role, subscription_type, 
            is_active, created_at, updated_at
     FROM users WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    throw new AuthenticationError('Invalid email or password');
  }

  const user = result.rows[0];

  // Check if user is active
  if (!user.is_active) {
    throw new AuthenticationError('Account is deactivated');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Update last login
  await query(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );

  // Remove password hash from response
  const { password_hash, ...userWithoutPassword } = user;

  // Generate tokens
  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  const refreshToken = generateRefreshToken({
    id: user.id,
    email: user.email
  });

  const authResponse: AuthResponse = {
    user: userWithoutPassword as User,
    token,
    refreshToken
  };

  successResponse(res, authResponse, 'Login successful');
}));

// Refresh token
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AuthenticationError('Refresh token required');
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);

    // Find user
    const result = await query(
      `SELECT id, username, email, full_name, avatar_url, role, subscription_type, 
              is_active, created_at, updated_at
       FROM users WHERE id = $1 AND is_active = true`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found or inactive');
    }

    const user = result.rows[0] as User;

    // Generate new tokens
    const newToken = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    const newRefreshToken = generateRefreshToken({
      id: user.id,
      email: user.email
    });

    const authResponse: AuthResponse = {
      user,
      token: newToken,
      refreshToken: newRefreshToken
    };

    successResponse(res, authResponse, 'Token refreshed successfully');
  } catch (error) {
    throw new AuthenticationError('Invalid refresh token');
  }
}));

// Get current user profile
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  const result = await query(
    `SELECT id, username, email, full_name, avatar_url, bio, location, website, 
            social_links, role, subscription_type, created_at, updated_at
     FROM users WHERE id = $1 AND is_active = true`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const user = result.rows[0] as User;
  successResponse(res, user, 'User profile retrieved successfully');
}));

// Logout (client-side token removal)
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  // In a more sophisticated setup, you might want to blacklist the token
  // For now, we'll just return success and let the client remove the token
  successResponse(res, null, 'Logged out successfully');
}));

// Change password
router.put('/change-password', [
  authenticateToken,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomValidationError('Validation failed');
  }

  const { currentPassword, newPassword } = req.body;
  const userId = req.user?.id;

  // Get current password hash
  const result = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const { password_hash } = result.rows[0];

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, password_hash);
  if (!isValidPassword) {
    throw new AuthenticationError('Current password is incorrect');
  }

  // Hash new password
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [newPasswordHash, userId]
  );

  successResponse(res, null, 'Password changed successfully');
}));

export default router;