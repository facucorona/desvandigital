import express from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest, asyncHandler, sendSuccess, sendPaginatedResponse } from '../middleware/errorHandler.js';
import { query as dbQuery } from '../config/database.js';
import { Message } from '../types.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'text/'];
    const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type));
    
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

// Get conversations list
router.get('/conversations',
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
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const userId = req.user!.id;

    // Get conversations with last message and unread count
    const result = await dbQuery(
      `WITH conversation_users AS (
        SELECT DISTINCT
          CASE 
            WHEN sender_id = $1 THEN receiver_id
            ELSE sender_id
          END as other_user_id,
          MAX(created_at) as last_message_time
        FROM messages
        WHERE sender_id = $1 OR receiver_id = $1
        GROUP BY other_user_id
      ),
      last_messages AS (
        SELECT DISTINCT ON (cu.other_user_id)
          cu.other_user_id,
          m.id,
          m.content,
          m.message_type,
          m.file_url,
          m.sender_id,
          m.is_read,
          m.created_at
        FROM conversation_users cu
        JOIN messages m ON (
          (m.sender_id = $1 AND m.receiver_id = cu.other_user_id) OR
          (m.sender_id = cu.other_user_id AND m.receiver_id = $1)
        )
        WHERE m.created_at = cu.last_message_time
        ORDER BY cu.other_user_id, m.created_at DESC
      )
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.avatar_url,
        u.is_verified,
        lm.id as last_message_id,
        lm.content as last_message_content,
        lm.message_type as last_message_type,
        lm.file_url as last_message_file_url,
        lm.sender_id as last_message_sender_id,
        lm.is_read as last_message_is_read,
        lm.created_at as last_message_time,
        (
          SELECT COUNT(*)
          FROM messages
          WHERE sender_id = u.id AND receiver_id = $1 AND is_read = false
        ) as unread_count
      FROM last_messages lm
      JOIN users u ON u.id = lm.other_user_id
      WHERE u.is_active = true
      ORDER BY lm.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, Number(limit), offset]
    );

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(DISTINCT
        CASE 
          WHEN sender_id = $1 THEN receiver_id
          ELSE sender_id
        END
      ) as total
      FROM messages m
      JOIN users u ON (
        (u.id = m.sender_id AND m.receiver_id = $1) OR
        (u.id = m.receiver_id AND m.sender_id = $1)
      )
      WHERE u.is_active = true`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].total);

    const conversations = result.rows.map(row => ({
      user: {
        id: row.id,
        username: row.username,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        is_verified: row.is_verified
      },
      last_message: row.last_message_id ? {
        id: row.last_message_id,
        content: row.last_message_content,
        message_type: row.last_message_type,
        file_url: row.last_message_file_url,
        sender_id: row.last_message_sender_id,
        is_read: row.last_message_is_read,
        created_at: row.last_message_time,
        is_own: row.last_message_sender_id === userId
      } : null,
      unread_count: parseInt(row.unread_count)
    }));

    sendPaginatedResponse(res, conversations, total, Number(page), Number(limit), 'Conversations retrieved successfully');
  })
);

// Get messages in a conversation
router.get('/conversation/:userId',
  authenticateToken,
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
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('before')
      .optional()
      .isISO8601()
      .withMessage('Before must be a valid ISO date'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { userId: otherUserId } = req.params;
    const { page = 1, limit = 50, before } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const currentUserId = req.user!.id;

    // Check if other user exists
    const userResult = await dbQuery(
      'SELECT id, username, full_name, avatar_url, is_verified FROM users WHERE id = $1 AND is_active = true',
      [otherUserId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const otherUser = userResult.rows[0];

    // Build query conditions
    let whereClause = `WHERE (
      (sender_id = $1 AND receiver_id = $2) OR
      (sender_id = $2 AND receiver_id = $1)
    )`;
    const queryParams = [currentUserId, otherUserId];
    let paramIndex = 3;

    if (before) {
      whereClause += ` AND created_at < $${paramIndex}`;
      queryParams.push(before as string);
      paramIndex++;
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM messages ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get messages
    const result = await dbQuery(
      `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.message_type, 
              m.file_url, m.is_read, m.created_at, m.updated_at,
              s.username as sender_username, s.full_name as sender_full_name, 
              s.avatar_url as sender_avatar_url,
              r.username as receiver_username, r.full_name as receiver_full_name, 
              r.avatar_url as receiver_avatar_url
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       JOIN users r ON m.receiver_id = r.id
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );

    const messages = result.rows.map(row => ({
      id: row.id,
      content: row.content,
      message_type: row.message_type,
      file_url: row.file_url,
      is_read: row.is_read,
      created_at: row.created_at,
      updated_at: row.updated_at,
      sender: {
        id: row.sender_id,
        username: row.sender_username,
        full_name: row.sender_full_name,
        avatar_url: row.sender_avatar_url
      },
      receiver: {
        id: row.receiver_id,
        username: row.receiver_username,
        full_name: row.receiver_full_name,
        avatar_url: row.receiver_avatar_url
      },
      is_own: row.sender_id === currentUserId
    }));

    // Mark messages as read if they were sent to current user
    if (messages.length > 0) {
      const unreadMessageIds = messages
        .filter(msg => msg.receiver.id === currentUserId && !msg.is_read)
        .map(msg => msg.id);

      if (unreadMessageIds.length > 0) {
        await dbQuery(
          'UPDATE messages SET is_read = true WHERE id = ANY($1)',
          [unreadMessageIds]
        );
        
        // Update the messages in response
        messages.forEach(msg => {
          if (unreadMessageIds.includes(msg.id)) {
            msg.is_read = true;
          }
        });
      }
    }

    sendPaginatedResponse(res, messages.reverse(), total, Number(page), Number(limit), 'Messages retrieved successfully');
  })
);

// Send message
router.post('/send',
  authenticateToken,
  upload.single('file'),
  [
    body('receiver_id')
      .isUUID()
      .withMessage('Invalid receiver ID'),
    body('content')
      .optional()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Content must be between 1 and 2000 characters'),
    body('message_type')
      .optional()
      .isIn(['text', 'image', 'video', 'audio', 'file'])
      .withMessage('Invalid message type'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { receiver_id, content, message_type = 'text' } = req.body;
    const senderId = req.user!.id;
    const file = req.file;

    if (senderId === receiver_id) {
      return res.status(400).json({ error: 'Cannot send message to yourself' });
    }

    // Check if receiver exists
    const receiverResult = await dbQuery(
      'SELECT id, username, full_name, avatar_url FROM users WHERE id = $1 AND is_active = true',
      [receiver_id]
    );

    if (receiverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    const receiver = receiverResult.rows[0];

    // Validate content or file
    if (!content && !file) {
      return res.status(400).json({ error: 'Message must have content or file' });
    }

    let fileUrl: string | null = null;
    let finalMessageType = message_type;

    // Process file if uploaded
    if (file) {
      // In a real application, you would upload to a cloud storage service
      fileUrl = `https://api.desvandigital.com/uploads/messages/${senderId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${file.originalname.split('.').pop()}`;
      
      // Determine message type based on file
      if (file.mimetype.startsWith('image/')) {
        finalMessageType = 'image';
      } else if (file.mimetype.startsWith('video/')) {
        finalMessageType = 'video';
      } else if (file.mimetype.startsWith('audio/')) {
        finalMessageType = 'audio';
      } else {
        finalMessageType = 'file';
      }
    }

    // Create message
    const result = await dbQuery(
      `INSERT INTO messages (sender_id, receiver_id, content, message_type, file_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, sender_id, receiver_id, content, message_type, file_url, 
                 is_read, created_at, updated_at`,
      [senderId, receiver_id, content || null, finalMessageType, fileUrl]
    );

    const message = result.rows[0];

    // Get sender info
    const senderResult = await dbQuery(
      'SELECT id, username, full_name, avatar_url FROM users WHERE id = $1',
      [senderId]
    );

    const sender = senderResult.rows[0];

    const responseMessage = {
      ...message,
      sender,
      receiver,
      is_own: true
    };

    sendSuccess(res, responseMessage, 'Message sent successfully', 201);
  })
);

// Mark message as read
router.patch('/:messageId/read',
  authenticateToken,
  [
    param('messageId')
      .isUUID()
      .withMessage('Invalid message ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user!.id;

    // Update message read status
    const result = await dbQuery(
      `UPDATE messages 
       SET is_read = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND receiver_id = $2 AND is_read = false
       RETURNING id, sender_id, is_read`,
      [messageId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or already read' });
    }

    sendSuccess(res, {
      message_id: messageId,
      is_read: true
    }, 'Message marked as read');
  })
);

// Mark all messages in conversation as read
router.patch('/conversation/:userId/read',
  authenticateToken,
  [
    param('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { userId: otherUserId } = req.params;
    const currentUserId = req.user!.id;

    // Check if other user exists
    const userResult = await dbQuery(
      'SELECT id FROM users WHERE id = $1 AND is_active = true',
      [otherUserId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Mark all unread messages from other user as read
    const result = await dbQuery(
      `UPDATE messages 
       SET is_read = true, updated_at = CURRENT_TIMESTAMP
       WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false
       RETURNING id`,
      [otherUserId, currentUserId]
    );

    sendSuccess(res, {
      marked_count: result.rows.length
    }, `${result.rows.length} messages marked as read`);
  })
);

// Delete message
router.delete('/:messageId',
  authenticateToken,
  [
    param('messageId')
      .isUUID()
      .withMessage('Invalid message ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user!.id;

    // Check if message exists and user is the sender
    const messageResult = await dbQuery(
      'SELECT sender_id FROM messages WHERE id = $1',
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (messageResult.rows[0].sender_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    // Delete message
    await dbQuery(
      'DELETE FROM messages WHERE id = $1',
      [messageId]
    );

    sendSuccess(res, null, 'Message deleted successfully');
  })
);

// Search messages
router.get('/search',
  authenticateToken,
  [
    query('q')
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('user_id')
      .optional()
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
    const { q, user_id, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const currentUserId = req.user!.id;

    let whereClause = `WHERE (
      (m.sender_id = $1 OR m.receiver_id = $1)
      AND m.content ILIKE $2
    )`;
    const queryParams = [currentUserId, `%${q}%`];
    let paramIndex = 3;

    // Filter by specific user if provided
    if (user_id) {
      whereClause += ` AND (
        (m.sender_id = $${paramIndex} AND m.receiver_id = $1) OR
        (m.sender_id = $1 AND m.receiver_id = $${paramIndex})
      )`;
      queryParams.push(user_id as string);
      paramIndex++;
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total 
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       JOIN users r ON m.receiver_id = r.id
       ${whereClause} AND s.is_active = true AND r.is_active = true`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get messages
    const result = await dbQuery(
      `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.message_type, 
              m.file_url, m.is_read, m.created_at,
              s.username as sender_username, s.full_name as sender_full_name, 
              s.avatar_url as sender_avatar_url,
              r.username as receiver_username, r.full_name as receiver_full_name, 
              r.avatar_url as receiver_avatar_url
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       JOIN users r ON m.receiver_id = r.id
       ${whereClause} AND s.is_active = true AND r.is_active = true
       ORDER BY m.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );

    const messages = result.rows.map(row => ({
      id: row.id,
      content: row.content,
      message_type: row.message_type,
      file_url: row.file_url,
      is_read: row.is_read,
      created_at: row.created_at,
      sender: {
        id: row.sender_id,
        username: row.sender_username,
        full_name: row.sender_full_name,
        avatar_url: row.sender_avatar_url
      },
      receiver: {
        id: row.receiver_id,
        username: row.receiver_username,
        full_name: row.receiver_full_name,
        avatar_url: row.receiver_avatar_url
      },
      is_own: row.sender_id === currentUserId
    }));

    sendPaginatedResponse(res, messages, total, Number(page), Number(limit), 'Messages found successfully');
  })
);

// Get unread messages count
router.get('/unread/count',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const result = await dbQuery(
      'SELECT COUNT(*) as total FROM messages WHERE receiver_id = $1 AND is_read = false',
      [userId]
    );

    const unreadCount = parseInt(result.rows[0].total);

    sendSuccess(res, { unread_count: unreadCount }, 'Unread count retrieved successfully');
  })
);

export default router;