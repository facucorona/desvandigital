import express from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import { validateRequest, asyncHandler, sendSuccess, sendPaginatedResponse } from '../middleware/errorHandler';
import { query as dbQuery } from '../config/database';
import { AtticObject } from '../../shared/types';

const router = express.Router();

// Configure multer for 3D model uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for 3D models
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'model/gltf-binary', 'model/gltf+json', 'application/octet-stream',
      'model/obj', 'model/fbx', 'model/dae', 'model/3ds',
      'image/jpeg', 'image/png', 'image/webp' // For textures
    ];
    
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.match(/\.(glb|gltf|obj|fbx|dae|3ds|jpg|jpeg|png|webp)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported for 3D models'));
    }
  },
});

// Get user's attic objects
router.get('/',
  authenticateToken,
  [
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
      .isIn(['newest', 'oldest', 'name_asc', 'name_desc', 'category'])
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

    if (category) {
      whereConditions.push(`category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        name ILIKE $${paramIndex} OR 
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
        orderBy = 'name ASC';
        break;
      case 'name_desc':
        orderBy = 'name DESC';
        break;
      case 'category':
        orderBy = 'category ASC, created_at DESC';
        break;
    }

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM attic_objects WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get attic objects
    const result = await dbQuery(
      `SELECT id, name, description, category, model_url, texture_url, thumbnail_url,
              position_x, position_y, position_z, rotation_x, rotation_y, rotation_z,
              scale_x, scale_y, scale_z, tags, metadata, is_visible, created_at, updated_at
       FROM attic_objects
       WHERE ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, Number(limit), offset]
    );

    const objects = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      model_url: row.model_url,
      texture_url: row.texture_url,
      thumbnail_url: row.thumbnail_url,
      position: {
        x: parseFloat(row.position_x),
        y: parseFloat(row.position_y),
        z: parseFloat(row.position_z)
      },
      rotation: {
        x: parseFloat(row.rotation_x),
        y: parseFloat(row.rotation_y),
        z: parseFloat(row.rotation_z)
      },
      scale: {
        x: parseFloat(row.scale_x),
        y: parseFloat(row.scale_y),
        z: parseFloat(row.scale_z)
      },
      tags: row.tags,
      metadata: row.metadata,
      is_visible: row.is_visible,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    sendPaginatedResponse(res, objects, total, Number(page), Number(limit), 'Attic objects retrieved successfully');
  })
);

// Get single attic object
router.get('/:id',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid object ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    const result = await dbQuery(
      `SELECT id, name, description, category, model_url, texture_url, thumbnail_url,
              position_x, position_y, position_z, rotation_x, rotation_y, rotation_z,
              scale_x, scale_y, scale_z, tags, metadata, is_visible, created_at, updated_at
       FROM attic_objects
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attic object not found' });
    }

    const row = result.rows[0];
    const object = {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      model_url: row.model_url,
      texture_url: row.texture_url,
      thumbnail_url: row.thumbnail_url,
      position: {
        x: parseFloat(row.position_x),
        y: parseFloat(row.position_y),
        z: parseFloat(row.position_z)
      },
      rotation: {
        x: parseFloat(row.rotation_x),
        y: parseFloat(row.rotation_y),
        z: parseFloat(row.rotation_z)
      },
      scale: {
        x: parseFloat(row.scale_x),
        y: parseFloat(row.scale_y),
        z: parseFloat(row.scale_z)
      },
      tags: row.tags,
      metadata: row.metadata,
      is_visible: row.is_visible,
      created_at: row.created_at,
      updated_at: row.updated_at
    };

    sendSuccess(res, object, 'Attic object retrieved successfully');
  })
);

// Upload 3D model
router.post('/upload',
  authenticateToken,
  upload.fields([
    { name: 'model', maxCount: 1 },
    { name: 'texture', maxCount: 5 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  [
    body('name')
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters'),
    body('position_x')
      .optional()
      .isFloat()
      .withMessage('Position X must be a number'),
    body('position_y')
      .optional()
      .isFloat()
      .withMessage('Position Y must be a number'),
    body('position_z')
      .optional()
      .isFloat()
      .withMessage('Position Z must be a number'),
    body('rotation_x')
      .optional()
      .isFloat()
      .withMessage('Rotation X must be a number'),
    body('rotation_y')
      .optional()
      .isFloat()
      .withMessage('Rotation Y must be a number'),
    body('rotation_z')
      .optional()
      .isFloat()
      .withMessage('Rotation Z must be a number'),
    body('scale_x')
      .optional()
      .isFloat({ min: 0.1, max: 10 })
      .withMessage('Scale X must be between 0.1 and 10'),
    body('scale_y')
      .optional()
      .isFloat({ min: 0.1, max: 10 })
      .withMessage('Scale Y must be between 0.1 and 10'),
    body('scale_z')
      .optional()
      .isFloat({ min: 0.1, max: 10 })
      .withMessage('Scale Z must be between 0.1 and 10'),
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
      name,
      description,
      category,
      position_x = 0,
      position_y = 0,
      position_z = 0,
      rotation_x = 0,
      rotation_y = 0,
      rotation_z = 0,
      scale_x = 1,
      scale_y = 1,
      scale_z = 1,
      tags,
      metadata
    } = req.body;
    const userId = req.user!.id;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files.model || files.model.length === 0) {
      return res.status(400).json({ error: '3D model file is required' });
    }

    const modelFile = files.model[0];
    let textureUrls: string[] = [];
    let thumbnailUrl = null;

    // In a real application, you would upload to a cloud storage service
    const modelUrl = `https://api.desvandigital.com/uploads/models/${userId}_${Date.now()}_${modelFile.originalname}`;

    // Handle texture files
    if (files.texture && files.texture.length > 0) {
      textureUrls = files.texture.map((file, index) => 
        `https://api.desvandigital.com/uploads/textures/${userId}_${Date.now()}_${index}_${file.originalname}`
      );
    }

    // Handle thumbnail
    if (files.thumbnail && files.thumbnail.length > 0) {
      const thumbnailFile = files.thumbnail[0];
      thumbnailUrl = `https://api.desvandigital.com/uploads/thumbnails/${userId}_${Date.now()}_${thumbnailFile.originalname}`;
    }

    const result = await dbQuery(
      `INSERT INTO attic_objects (
        user_id, name, description, category, model_url, texture_url, thumbnail_url,
        position_x, position_y, position_z, rotation_x, rotation_y, rotation_z,
        scale_x, scale_y, scale_z, tags, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id, name, model_url, created_at`,
      [
        userId, name, description || null, category || null,
        modelUrl, JSON.stringify(textureUrls), thumbnailUrl,
        parseFloat(position_x), parseFloat(position_y), parseFloat(position_z),
        parseFloat(rotation_x), parseFloat(rotation_y), parseFloat(rotation_z),
        parseFloat(scale_x), parseFloat(scale_y), parseFloat(scale_z),
        JSON.stringify(tags || []), JSON.stringify(metadata || {})
      ]
    );

    const object = result.rows[0];

    sendSuccess(res, {
      id: object.id,
      name: object.name,
      model_url: object.model_url,
      created_at: object.created_at
    }, '3D object uploaded successfully', 201);
  })
);

// Create attic object (without file upload)
router.post('/',
  authenticateToken,
  [
    body('name')
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters'),
    body('model_url')
      .isURL()
      .withMessage('Valid model URL is required'),
    body('texture_url')
      .optional()
      .isArray()
      .withMessage('Texture URLs must be an array'),
    body('thumbnail_url')
      .optional()
      .isURL()
      .withMessage('Invalid thumbnail URL'),
    body('position')
      .optional()
      .isObject()
      .withMessage('Position must be an object with x, y, z coordinates'),
    body('rotation')
      .optional()
      .isObject()
      .withMessage('Rotation must be an object with x, y, z values'),
    body('scale')
      .optional()
      .isObject()
      .withMessage('Scale must be an object with x, y, z values'),
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
      name,
      description,
      category,
      model_url,
      texture_url,
      thumbnail_url,
      position = { x: 0, y: 0, z: 0 },
      rotation = { x: 0, y: 0, z: 0 },
      scale = { x: 1, y: 1, z: 1 },
      tags,
      metadata
    } = req.body;
    const userId = req.user!.id;

    const result = await dbQuery(
      `INSERT INTO attic_objects (
        user_id, name, description, category, model_url, texture_url, thumbnail_url,
        position_x, position_y, position_z, rotation_x, rotation_y, rotation_z,
        scale_x, scale_y, scale_z, tags, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id, name, description, category, model_url, texture_url, thumbnail_url,
                position_x, position_y, position_z, rotation_x, rotation_y, rotation_z,
                scale_x, scale_y, scale_z, created_at`,
      [
        userId, name, description || null, category || null,
        model_url, JSON.stringify(texture_url || []), thumbnail_url || null,
        position.x, position.y, position.z,
        rotation.x, rotation.y, rotation.z,
        scale.x, scale.y, scale.z,
        JSON.stringify(tags || []), JSON.stringify(metadata || {})
      ]
    );

    const row = result.rows[0];
    const object = {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      model_url: row.model_url,
      texture_url: JSON.parse(row.texture_url),
      thumbnail_url: row.thumbnail_url,
      position: {
        x: parseFloat(row.position_x),
        y: parseFloat(row.position_y),
        z: parseFloat(row.position_z)
      },
      rotation: {
        x: parseFloat(row.rotation_x),
        y: parseFloat(row.rotation_y),
        z: parseFloat(row.rotation_z)
      },
      scale: {
        x: parseFloat(row.scale_x),
        y: parseFloat(row.scale_y),
        z: parseFloat(row.scale_z)
      },
      created_at: row.created_at
    };

    sendSuccess(res, object, 'Attic object created successfully', 201);
  })
);

// Update attic object
router.put('/:id',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid object ID'),
    body('name')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters'),
    body('position')
      .optional()
      .isObject()
      .withMessage('Position must be an object with x, y, z coordinates'),
    body('rotation')
      .optional()
      .isObject()
      .withMessage('Rotation must be an object with x, y, z values'),
    body('scale')
      .optional()
      .isObject()
      .withMessage('Scale must be an object with x, y, z values'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object'),
    body('is_visible')
      .optional()
      .isBoolean()
      .withMessage('is_visible must be a boolean'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if object exists and belongs to user
    const existingResult = await dbQuery(
      'SELECT id FROM attic_objects WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attic object not found' });
    }

    // Build update query
    const updateFields = [];
    const queryParams = [];
    let paramIndex = 1;

    const simpleFields = ['name', 'description', 'category', 'tags', 'metadata', 'is_visible'];

    for (const field of simpleFields) {
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

    // Handle position, rotation, scale objects
    const transformFields = ['position', 'rotation', 'scale'];
    for (const field of transformFields) {
      if (req.body[field]) {
        const obj = req.body[field];
        if (obj.x !== undefined) {
          updateFields.push(`${field}_x = $${paramIndex}`);
          queryParams.push(parseFloat(obj.x));
          paramIndex++;
        }
        if (obj.y !== undefined) {
          updateFields.push(`${field}_y = $${paramIndex}`);
          queryParams.push(parseFloat(obj.y));
          paramIndex++;
        }
        if (obj.z !== undefined) {
          updateFields.push(`${field}_z = $${paramIndex}`);
          queryParams.push(parseFloat(obj.z));
          paramIndex++;
        }
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    queryParams.push(id);

    const result = await dbQuery(
      `UPDATE attic_objects 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, description, category, model_url, texture_url, thumbnail_url,
                 position_x, position_y, position_z, rotation_x, rotation_y, rotation_z,
                 scale_x, scale_y, scale_z, tags, metadata, is_visible, updated_at`,
      queryParams
    );

    const row = result.rows[0];
    const object = {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      model_url: row.model_url,
      texture_url: JSON.parse(row.texture_url || '[]'),
      thumbnail_url: row.thumbnail_url,
      position: {
        x: parseFloat(row.position_x),
        y: parseFloat(row.position_y),
        z: parseFloat(row.position_z)
      },
      rotation: {
        x: parseFloat(row.rotation_x),
        y: parseFloat(row.rotation_y),
        z: parseFloat(row.rotation_z)
      },
      scale: {
        x: parseFloat(row.scale_x),
        y: parseFloat(row.scale_y),
        z: parseFloat(row.scale_z)
      },
      tags: row.tags,
      metadata: row.metadata,
      is_visible: row.is_visible,
      updated_at: row.updated_at
    };

    sendSuccess(res, object, 'Attic object updated successfully');
  })
);

// Delete attic object
router.delete('/:id',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid object ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if object exists and belongs to user
    const existingResult = await dbQuery(
      'SELECT id FROM attic_objects WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attic object not found' });
    }

    // Delete related object links first
    await dbQuery(
      'DELETE FROM object_links WHERE source_object_id = $1 OR target_object_id = $1',
      [id]
    );

    // Delete the object
    await dbQuery(
      'DELETE FROM attic_objects WHERE id = $1',
      [id]
    );

    sendSuccess(res, null, 'Attic object deleted successfully');
  })
);

// Get object links for a specific object
router.get('/:id/links',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid object ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify object belongs to user
    const objectResult = await dbQuery(
      'SELECT id FROM attic_objects WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (objectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attic object not found' });
    }

    // Get all links where this object is either source or target
    const result = await dbQuery(
      `SELECT ol.id, ol.link_type, ol.link_data, ol.created_at,
              so.id as source_id, so.name as source_name,
              to.id as target_id, to.name as target_name
       FROM object_links ol
       JOIN attic_objects so ON ol.source_object_id = so.id
       JOIN attic_objects to ON ol.target_object_id = to.id
       WHERE (ol.source_object_id = $1 OR ol.target_object_id = $1)
         AND so.user_id = $2 AND to.user_id = $2
       ORDER BY ol.created_at DESC`,
      [id, userId]
    );

    const links = result.rows.map(row => ({
      id: row.id,
      link_type: row.link_type,
      link_data: row.link_data,
      source_object: {
        id: row.source_id,
        name: row.source_name
      },
      target_object: {
        id: row.target_id,
        name: row.target_name
      },
      created_at: row.created_at
    }));

    sendSuccess(res, links, 'Object links retrieved successfully');
  })
);

// Create object link
router.post('/:id/links',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid source object ID'),
    body('target_object_id')
      .isUUID()
      .withMessage('Invalid target object ID'),
    body('link_type')
      .isIn(['reference', 'dependency', 'similarity', 'custom'])
      .withMessage('Invalid link type'),
    body('link_data')
      .optional()
      .isObject()
      .withMessage('Link data must be an object'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const sourceObjectId = req.params.id;
    const { target_object_id, link_type, link_data } = req.body;
    const userId = req.user!.id;

    // Verify both objects exist and belong to user
    const objectsResult = await dbQuery(
      `SELECT id FROM attic_objects 
       WHERE id IN ($1, $2) AND user_id = $3`,
      [sourceObjectId, target_object_id, userId]
    );

    if (objectsResult.rows.length !== 2) {
      return res.status(404).json({ error: 'One or both objects not found' });
    }

    // Check if link already exists
    const existingLinkResult = await dbQuery(
      `SELECT id FROM object_links 
       WHERE source_object_id = $1 AND target_object_id = $2`,
      [sourceObjectId, target_object_id]
    );

    if (existingLinkResult.rows.length > 0) {
      return res.status(409).json({ error: 'Link already exists between these objects' });
    }

    const result = await dbQuery(
      `INSERT INTO object_links (source_object_id, target_object_id, link_type, link_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id, link_type, link_data, created_at`,
      [sourceObjectId, target_object_id, link_type, JSON.stringify(link_data || {})]
    );

    const link = result.rows[0];

    sendSuccess(res, {
      id: link.id,
      source_object_id: sourceObjectId,
      target_object_id: target_object_id,
      link_type: link.link_type,
      link_data: link.link_data,
      created_at: link.created_at
    }, 'Object link created successfully', 201);
  })
);

// Delete object link
router.delete('/:id/links/:linkId',
  authenticateToken,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid object ID'),
    param('linkId')
      .isUUID()
      .withMessage('Invalid link ID'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id, linkId } = req.params;
    const userId = req.user!.id;

    // Verify the link exists and involves an object owned by the user
    const linkResult = await dbQuery(
      `SELECT ol.id FROM object_links ol
       JOIN attic_objects so ON ol.source_object_id = so.id
       JOIN attic_objects to ON ol.target_object_id = to.id
       WHERE ol.id = $1 AND (ol.source_object_id = $2 OR ol.target_object_id = $2)
         AND so.user_id = $3 AND to.user_id = $3`,
      [linkId, id, userId]
    );

    if (linkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Object link not found' });
    }

    await dbQuery(
      'DELETE FROM object_links WHERE id = $1',
      [linkId]
    );

    sendSuccess(res, null, 'Object link deleted successfully');
  })
);

// Get attic scene (all visible objects with their positions)
router.get('/scene/load',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const result = await dbQuery(
      `SELECT id, name, description, category, model_url, texture_url, thumbnail_url,
              position_x, position_y, position_z, rotation_x, rotation_y, rotation_z,
              scale_x, scale_y, scale_z, tags, metadata
       FROM attic_objects
       WHERE user_id = $1 AND is_visible = true
       ORDER BY created_at ASC`,
      [userId]
    );

    const objects = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      model_url: row.model_url,
      texture_url: JSON.parse(row.texture_url || '[]'),
      thumbnail_url: row.thumbnail_url,
      position: {
        x: parseFloat(row.position_x),
        y: parseFloat(row.position_y),
        z: parseFloat(row.position_z)
      },
      rotation: {
        x: parseFloat(row.rotation_x),
        y: parseFloat(row.rotation_y),
        z: parseFloat(row.rotation_z)
      },
      scale: {
        x: parseFloat(row.scale_x),
        y: parseFloat(row.scale_y),
        z: parseFloat(row.scale_z)
      },
      tags: row.tags,
      metadata: row.metadata
    }));

    sendSuccess(res, {
      objects,
      total_objects: objects.length
    }, 'Attic scene loaded successfully');
  })
);

// Save attic scene (bulk update positions)
router.post('/scene/save',
  authenticateToken,
  [
    body('objects')
      .isArray()
      .withMessage('Objects must be an array'),
    body('objects.*.id')
      .isUUID()
      .withMessage('Invalid object ID'),
    body('objects.*.position')
      .isObject()
      .withMessage('Position must be an object'),
    body('objects.*.rotation')
      .optional()
      .isObject()
      .withMessage('Rotation must be an object'),
    body('objects.*.scale')
      .optional()
      .isObject()
      .withMessage('Scale must be an object'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { objects } = req.body;
    const userId = req.user!.id;

    // Verify all objects belong to the user
    const objectIds = objects.map((obj: any) => obj.id);
    const verifyResult = await dbQuery(
      `SELECT id FROM attic_objects WHERE id = ANY($1) AND user_id = $2`,
      [objectIds, userId]
    );

    if (verifyResult.rows.length !== objectIds.length) {
      return res.status(404).json({ error: 'One or more objects not found' });
    }

    // Update each object's transform
    const updatePromises = objects.map((obj: any) => {
      const { id, position, rotation, scale } = obj;
      
      return dbQuery(
        `UPDATE attic_objects 
         SET position_x = $1, position_y = $2, position_z = $3,
             rotation_x = $4, rotation_y = $5, rotation_z = $6,
             scale_x = $7, scale_y = $8, scale_z = $9,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $10`,
        [
          position.x, position.y, position.z,
          rotation?.x || 0, rotation?.y || 0, rotation?.z || 0,
          scale?.x || 1, scale?.y || 1, scale?.z || 1,
          id
        ]
      );
    });

    await Promise.all(updatePromises);

    sendSuccess(res, {
      updated_objects: objects.length
    }, 'Attic scene saved successfully');
  })
);

export default router;