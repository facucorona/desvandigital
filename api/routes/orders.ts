import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateRequest, asyncHandler, sendSuccess, sendPaginatedResponse } from '../middleware/errorHandler.js';
import { query as dbQuery } from '../config/database.js';
import { Order } from '../types.js';

const router = express.Router();

// Get user orders
router.get('/',
  authenticateToken,
  [
    query('status')
      .optional()
      .isIn(['pending', 'processing', 'completed', 'cancelled', 'refunded'])
      .withMessage('Invalid order status'),
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
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build WHERE clause
    let whereConditions = ['o.user_id = $1'];
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      whereConditions.push(`o.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM orders o WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get orders
    const result = await dbQuery(
      `SELECT o.id, o.total_amount, o.status, o.payment_method, o.payment_status,
              o.shipping_address, o.created_at, o.updated_at,
              COUNT(oi.id) as item_count
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE ${whereClause}
       GROUP BY o.id, o.total_amount, o.status, o.payment_method, o.payment_status,
                o.shipping_address, o.created_at, o.updated_at
       ORDER BY o.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );

    const orders = result.rows.map(row => ({
      id: row.id,
      total_amount: parseFloat(row.total_amount),
      status: row.status,
      payment_method: row.payment_method,
      payment_status: row.payment_status,
      shipping_address: row.shipping_address,
      item_count: parseInt(row.item_count),
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    sendPaginatedResponse(res, orders, total, Number(page), Number(limit), 'Orders retrieved successfully');
  })
);

// Get single order
router.get('/:id',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid order ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Get order with items
    const orderResult = await dbQuery(
      `SELECT o.id, o.user_id, o.total_amount, o.status, o.payment_method, 
              o.payment_status, o.payment_intent_id, o.shipping_address, 
              o.billing_address, o.notes, o.created_at, o.updated_at,
              u.username, u.full_name, u.email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderRow = orderResult.rows[0];

    // Check permission
    if (userRole !== 'admin' && orderRow.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this order' });
    }

    // Get order items
    const itemsResult = await dbQuery(
      `SELECT oi.id, oi.quantity, oi.unit_price, oi.total_price,
              p.id as product_id, p.name as product_name, p.image_urls,
              p.category, p.seller_id,
              u.username as seller_username, u.full_name as seller_name
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN users u ON p.seller_id = u.id
       WHERE oi.order_id = $1
       ORDER BY oi.created_at`,
      [id]
    );

    const items = itemsResult.rows.map(row => ({
      id: row.id,
      quantity: row.quantity,
      unit_price: parseFloat(row.unit_price),
      total_price: parseFloat(row.total_price),
      product: {
        id: row.product_id,
        name: row.product_name,
        image_urls: row.image_urls,
        category: row.category,
        seller: {
          id: row.seller_id,
          username: row.seller_username,
          full_name: row.seller_name
        }
      }
    }));

    const order = {
      id: orderRow.id,
      user_id: orderRow.user_id,
      total_amount: parseFloat(orderRow.total_amount),
      status: orderRow.status,
      payment_method: orderRow.payment_method,
      payment_status: orderRow.payment_status,
      payment_intent_id: orderRow.payment_intent_id,
      shipping_address: orderRow.shipping_address,
      billing_address: orderRow.billing_address,
      notes: orderRow.notes,
      created_at: orderRow.created_at,
      updated_at: orderRow.updated_at,
      items,
      user: {
        username: orderRow.username,
        full_name: orderRow.full_name,
        email: orderRow.email
      }
    };

    sendSuccess(res, order, 'Order retrieved successfully');
  })
);

// Create order
router.post('/',
  authenticateToken,
  [
    body('items')
      .isArray({ min: 1 })
      .withMessage('Order must contain at least one item'),
    body('items.*.product_id')
      .isUUID()
      .withMessage('Invalid product ID'),
    body('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer'),
    body('payment_method')
      .isIn(['stripe', 'paypal', 'bank_transfer'])
      .withMessage('Invalid payment method'),
    body('shipping_address')
      .isObject()
      .withMessage('Shipping address is required'),
    body('shipping_address.street')
      .isLength({ min: 5, max: 200 })
      .withMessage('Street address must be between 5 and 200 characters'),
    body('shipping_address.city')
      .isLength({ min: 2, max: 100 })
      .withMessage('City must be between 2 and 100 characters'),
    body('shipping_address.state')
      .isLength({ min: 2, max: 100 })
      .withMessage('State must be between 2 and 100 characters'),
    body('shipping_address.postal_code')
      .isLength({ min: 3, max: 20 })
      .withMessage('Postal code must be between 3 and 20 characters'),
    body('shipping_address.country')
      .isLength({ min: 2, max: 100 })
      .withMessage('Country must be between 2 and 100 characters'),
    body('billing_address')
      .optional()
      .isObject()
      .withMessage('Billing address must be an object'),
    body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Notes must be less than 500 characters'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      items,
      payment_method,
      shipping_address,
      billing_address,
      notes
    } = req.body;
    const userId = req.user!.id;

    // Validate products and calculate total
    const productIds = items.map((item: any) => item.product_id);
    const productsResult = await dbQuery(
      `SELECT id, name, price, seller_id, is_active
       FROM products
       WHERE id = ANY($1::uuid[])`,
      [productIds]
    );

    if (productsResult.rows.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products not found' });
    }

    // Check if all products are active
    const inactiveProducts = productsResult.rows.filter(p => !p.is_active);
    if (inactiveProducts.length > 0) {
      return res.status(400).json({ error: 'Some products are no longer available' });
    }

    // Calculate total amount
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = productsResult.rows.find(p => p.id === item.product_id);
      if (!product) continue;

      const unitPrice = parseFloat(product.price);
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;

      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        seller_id: product.seller_id
      });
    }

    // Create order
    const orderResult = await dbQuery(
      `INSERT INTO orders (
        user_id, total_amount, status, payment_method, payment_status,
        shipping_address, billing_address, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, total_amount, status, created_at`,
      [
        userId, totalAmount, 'pending', payment_method, 'pending',
        JSON.stringify(shipping_address),
        billing_address ? JSON.stringify(billing_address) : null,
        notes || null
      ]
    );

    const order = orderResult.rows[0];
    const orderId = order.id;

    // Create order items
    const itemInsertPromises = orderItems.map(item =>
      dbQuery(
        `INSERT INTO order_items (
          order_id, product_id, quantity, unit_price, total_price
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id`,
        [orderId, item.product_id, item.quantity, item.unit_price, item.total_price]
      )
    );

    await Promise.all(itemInsertPromises);

    // Update product sales count
    const salesUpdatePromises = orderItems.map(item =>
      dbQuery(
        'UPDATE products SET sales_count = sales_count + $1 WHERE id = $2',
        [item.quantity, item.product_id]
      )
    );

    await Promise.all(salesUpdatePromises);

    sendSuccess(res, {
      id: orderId,
      total_amount: totalAmount,
      status: 'pending',
      payment_method,
      created_at: order.created_at,
      items: orderItems.length
    }, 'Order created successfully', 201);
  })
);

// Update order status (admin only)
router.patch('/:id/status',
  authenticateToken,
  requireRole(['admin']),
  [
    param('id')
      .isUUID()
      .withMessage('Invalid order ID'),
    body('status')
      .isIn(['pending', 'processing', 'completed', 'cancelled', 'refunded'])
      .withMessage('Invalid order status'),
    body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Notes must be less than 500 characters'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Check if order exists
    const existingResult = await dbQuery(
      'SELECT id, status FROM orders WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const currentStatus = existingResult.rows[0].status;

    // Validate status transition
    const validTransitions: { [key: string]: string[] } = {
      'pending': ['processing', 'cancelled'],
      'processing': ['completed', 'cancelled'],
      'completed': ['refunded'],
      'cancelled': [],
      'refunded': []
    };

    if (!validTransitions[currentStatus].includes(status)) {
      return res.status(400).json({ 
        error: `Cannot change status from ${currentStatus} to ${status}` 
      });
    }

    // Update order status
    const result = await dbQuery(
      `UPDATE orders 
       SET status = $1, notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, status, updated_at`,
      [status, notes || null, id]
    );

    const order = result.rows[0];

    sendSuccess(res, order, 'Order status updated successfully');
  })
);

// Update payment status
router.patch('/:id/payment',
  authenticateToken,
  requireRole(['admin']),
  [
    param('id')
      .isUUID()
      .withMessage('Invalid order ID'),
    body('payment_status')
      .isIn(['pending', 'processing', 'completed', 'failed', 'refunded'])
      .withMessage('Invalid payment status'),
    body('payment_intent_id')
      .optional()
      .isString()
      .withMessage('Payment intent ID must be a string'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { payment_status, payment_intent_id } = req.body;

    // Check if order exists
    const existingResult = await dbQuery(
      'SELECT id FROM orders WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update payment status
    const result = await dbQuery(
      `UPDATE orders 
       SET payment_status = $1, 
           payment_intent_id = COALESCE($2, payment_intent_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, payment_status, payment_intent_id, updated_at`,
      [payment_status, payment_intent_id || null, id]
    );

    const order = result.rows[0];

    sendSuccess(res, order, 'Payment status updated successfully');
  })
);

// Cancel order
router.patch('/:id/cancel',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid order ID'),
    body('reason')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Reason must be less than 500 characters'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check if order exists and user has permission
    const existingResult = await dbQuery(
      'SELECT user_id, status FROM orders WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { user_id: orderUserId, status } = existingResult.rows[0];

    // Check permission
    if (userRole !== 'admin' && orderUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized to cancel this order' });
    }

    // Check if order can be cancelled
    if (!['pending', 'processing'].includes(status)) {
      return res.status(400).json({ error: 'Order cannot be cancelled' });
    }

    // Cancel order
    const result = await dbQuery(
      `UPDATE orders 
       SET status = 'cancelled', 
           notes = COALESCE($1, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, status, updated_at`,
      [reason || null, id]
    );

    const order = result.rows[0];

    sendSuccess(res, order, 'Order cancelled successfully');
  })
);

// Get order statistics (admin only)
router.get('/admin/statistics',
  authenticateToken,
  requireRole(['admin']),
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month', 'year'])
      .withMessage('Invalid period'),
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('Invalid start date'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('Invalid end date'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { period = 'month', start_date, end_date } = req.query;

    let dateFilter = '';
    const queryParams: any[] = [];

    if (start_date && end_date) {
      dateFilter = 'WHERE created_at >= $1 AND created_at <= $2';
      queryParams.push(start_date, end_date);
    } else {
      // Default period filters
      switch (period) {
        case 'day':
          dateFilter = "WHERE created_at >= CURRENT_DATE";
          break;
        case 'week':
          dateFilter = "WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'";
          break;
        case 'month':
          dateFilter = "WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'";
          break;
        case 'year':
          dateFilter = "WHERE created_at >= CURRENT_DATE - INTERVAL '365 days'";
          break;
      }
    }

    // Get order statistics
    const statsResult = await dbQuery(
      `SELECT 
         COUNT(*) as total_orders,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
         COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as total_revenue,
         COALESCE(AVG(CASE WHEN status = 'completed' THEN total_amount END), 0) as average_order_value
       FROM orders
       ${dateFilter}`,
      queryParams
    );

    // Get daily revenue trend
    const trendResult = await dbQuery(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as orders,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as revenue
       FROM orders
       ${dateFilter}
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) DESC
       LIMIT 30`,
      queryParams
    );

    // Get top products
    const topProductsResult = await dbQuery(
      `SELECT 
         p.id, p.name, p.category,
         SUM(oi.quantity) as total_sold,
         SUM(oi.total_price) as total_revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.status = 'completed' ${dateFilter ? 'AND o.' + dateFilter.substring(6) : ''}
       GROUP BY p.id, p.name, p.category
       ORDER BY total_sold DESC
       LIMIT 10`,
      queryParams
    );

    const stats = statsResult.rows[0];
    const trend = trendResult.rows.map(row => ({
      date: row.date,
      orders: parseInt(row.orders),
      revenue: parseFloat(row.revenue)
    }));
    const topProducts = topProductsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      total_sold: parseInt(row.total_sold),
      total_revenue: parseFloat(row.total_revenue)
    }));

    sendSuccess(res, {
      summary: {
        total_orders: parseInt(stats.total_orders),
        completed_orders: parseInt(stats.completed_orders),
        pending_orders: parseInt(stats.pending_orders),
        cancelled_orders: parseInt(stats.cancelled_orders),
        total_revenue: parseFloat(stats.total_revenue),
        average_order_value: parseFloat(stats.average_order_value)
      },
      trend,
      top_products: topProducts
    }, 'Order statistics retrieved successfully');
  })
);

// Get all orders (admin only)
router.get('/admin/all',
  authenticateToken,
  requireRole(['admin']),
  [
    query('status')
      .optional()
      .isIn(['pending', 'processing', 'completed', 'cancelled', 'refunded'])
      .withMessage('Invalid order status'),
    query('payment_status')
      .optional()
      .isIn(['pending', 'processing', 'completed', 'failed', 'refunded'])
      .withMessage('Invalid payment status'),
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
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { status, payment_status, user_id, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build WHERE clause
    let whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`o.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (payment_status) {
      whereConditions.push(`o.payment_status = $${paramIndex}`);
      queryParams.push(payment_status);
      paramIndex++;
    }

    if (user_id) {
      whereConditions.push(`o.user_id = $${paramIndex}`);
      queryParams.push(user_id);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get orders
    const result = await dbQuery(
      `SELECT o.id, o.user_id, o.total_amount, o.status, o.payment_method,
              o.payment_status, o.created_at, o.updated_at,
              u.username, u.full_name, u.email,
              COUNT(oi.id) as item_count
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       ${whereClause}
       GROUP BY o.id, o.user_id, o.total_amount, o.status, o.payment_method,
                o.payment_status, o.created_at, o.updated_at,
                u.username, u.full_name, u.email
       ORDER BY o.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );

    const orders = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      total_amount: parseFloat(row.total_amount),
      status: row.status,
      payment_method: row.payment_method,
      payment_status: row.payment_status,
      item_count: parseInt(row.item_count),
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        username: row.username,
        full_name: row.full_name,
        email: row.email
      }
    }));

    sendPaginatedResponse(res, orders, total, Number(page), Number(limit), 'All orders retrieved successfully');
  })
);

export default router;