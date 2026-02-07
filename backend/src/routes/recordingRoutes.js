const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { query } = require('../db/connection');

// Use database storage (stores files directly in PostgreSQL)
const s3Service = require('../utils/dbStorageService');

console.log('📦 Using database storage - files stored directly in Neon PostgreSQL');
console.log('   No external storage (AWS S3, filesystem) required');

/**
 * POST /api/recordings/presigned-url
 * Get presigned URL for uploading a recording
 */
router.post('/presigned-url', authenticateToken, async (req, res) => {
  try {
    const { fileName, fileType, recordingType } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({
        error: 'fileName and fileType are required'
      });
    }

    const uploadInfo = await s3Service.getPresignedUploadUrl(
      req.user.userId,
      fileName,
      fileType,
      recordingType || 'screen'
    );

    res.json({
      uploadUrl: uploadInfo.uploadUrl,
      key: uploadInfo.key,
      fileUrl: uploadInfo.fileUrl
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({
      error: 'Failed to generate upload URL'
    });
  }
});

/**
 * POST /api/recordings
 * Create a new recording entry after upload
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      rawFileUrl,
      durationSeconds,
      fileSizeBytes,
      metadata
    } = req.body;

    if (!title || !type || !rawFileUrl) {
      return res.status(400).json({
        error: 'title, type, and rawFileUrl are required'
      });
    }

    const result = await query(
      `INSERT INTO recordings (
        user_id, title, description, type, raw_file_url,
        duration_seconds, file_size_bytes, metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, title, type, status, created_at`,
      [
        req.user.userId,
        title,
        description || null,
        type,
        rawFileUrl,
        durationSeconds || 0,
        fileSizeBytes || 0,
        metadata ? JSON.stringify(metadata) : null,
        'ready'
      ]
    );

    const recording = result.rows[0];

    res.status(201).json({
      message: 'Recording created successfully',
      recording: {
        id: recording.id,
        title: recording.title,
        type: recording.type,
        status: recording.status,
        createdAt: recording.created_at
      }
    });
  } catch (error) {
    console.error('Error creating recording:', error);
    res.status(500).json({
      error: 'Failed to create recording'
    });
  }
});

/**
 * GET /api/recordings
 * Get all recordings for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;

    let queryText = `
      SELECT
        id, title, description, type, status,
        raw_file_url, processed_file_url, thumbnail_url,
        duration_seconds, file_size_bytes, metadata,
        created_at, updated_at
      FROM recordings
      WHERE user_id = $1
    `;

    const queryParams = [req.user.userId];

    if (status) {
      queryText += ` AND status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, queryParams);

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) FROM recordings WHERE user_id = $1',
      [req.user.userId]
    );

    res.json({
      recordings: result.rows.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        type: r.type,
        status: r.status,
        rawFileUrl: r.raw_file_url,
        processedFileUrl: r.processed_file_url,
        thumbnailUrl: r.thumbnail_url,
        durationSeconds: r.duration_seconds,
        fileSizeBytes: r.file_size_bytes,
        metadata: r.metadata,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      })),
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({
      error: 'Failed to fetch recordings'
    });
  }
});

/**
 * GET /api/recordings/:id
 * Get a specific recording by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        r.id, r.title, r.description, r.type, r.status,
        r.raw_file_url, r.processed_file_url, r.thumbnail_url,
        r.duration_seconds, r.file_size_bytes, r.metadata,
        r.created_at, r.updated_at,
        t.raw_text, t.enhanced_text, t.language
      FROM recordings r
      LEFT JOIN transcriptions t ON r.id = t.recording_id
      WHERE r.id = $1 AND r.user_id = $2`,
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Recording not found'
      });
    }

    const recording = result.rows[0];

    res.json({
      recording: {
        id: recording.id,
        title: recording.title,
        description: recording.description,
        type: recording.type,
        status: recording.status,
        rawFileUrl: recording.raw_file_url,
        processedFileUrl: recording.processed_file_url,
        thumbnailUrl: recording.thumbnail_url,
        durationSeconds: recording.duration_seconds,
        fileSizeBytes: recording.file_size_bytes,
        metadata: recording.metadata,
        createdAt: recording.created_at,
        updatedAt: recording.updated_at,
        transcription: recording.raw_text ? {
          rawText: recording.raw_text,
          enhancedText: recording.enhanced_text,
          language: recording.language
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching recording:', error);
    res.status(500).json({
      error: 'Failed to fetch recording'
    });
  }
});

/**
 * DELETE /api/recordings/:id
 * Delete a recording
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get recording to check ownership and get file URLs
    const recordingResult = await query(
      'SELECT raw_file_url, processed_file_url FROM recordings WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );

    if (recordingResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Recording not found'
      });
    }

    const recording = recordingResult.rows[0];

    // Delete from database (cascades to transcriptions and ai_jobs)
    await query(
      'DELETE FROM recordings WHERE id = $1',
      [id]
    );

    // Delete files from S3 (don't fail if S3 delete fails)
    try {
      if (recording.raw_file_url) {
        const rawKey = s3Service.extractKeyFromUrl(recording.raw_file_url);
        await s3Service.deleteFile(rawKey);
      }

      if (recording.processed_file_url) {
        const processedKey = s3Service.extractKeyFromUrl(recording.processed_file_url);
        await s3Service.deleteFile(processedKey);
      }
    } catch (s3Error) {
      console.error('Error deleting files from S3:', s3Error);
      // Continue anyway - database is already deleted
    }

    res.json({
      message: 'Recording deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting recording:', error);
    res.status(500).json({
      error: 'Failed to delete recording'
    });
  }
});

/**
 * PATCH /api/recordings/:id
 * Update a recording
 */
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status } = req.body;

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No fields to update'
      });
    }

    values.push(id, req.user.userId);

    const result = await query(
      `UPDATE recordings
       SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING id, title, description, status, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Recording not found'
      });
    }

    res.json({
      message: 'Recording updated successfully',
      recording: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating recording:', error);
    res.status(500).json({
      error: 'Failed to update recording'
    });
  }
});

/**
 * PUT /api/recordings/upload-db/:key
 * Upload file data to database
 */
router.put('/upload-db/*', authenticateToken, async (req, res) => {
  try {
    const key = req.params[0]; // Get everything after /upload-db/

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));

    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || 'video/webm';

        await s3Service.storeFile(key, buffer, contentType, req.user.userId);

        res.status(200).json({
          message: 'File uploaded to database successfully',
          key,
          size: buffer.length
        });
      } catch (error) {
        console.error('Error uploading to database:', error);
        res.status(500).json({
          error: 'Failed to upload file to database'
        });
      }
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      res.status(500).json({
        error: 'Failed to upload file'
      });
    });
  } catch (error) {
    console.error('Error in upload-db route:', error);
    res.status(500).json({
      error: 'Failed to process upload'
    });
  }
});

/**
 * GET /api/recordings/stream/:key
 * Stream file from database
 */
router.get('/stream/*', async (req, res) => {
  try {
    const key = req.params[0]; // Get everything after /stream/

    const { data, contentType } = await s3Service.getFile(key);

    // Set headers for streaming
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', data.length);
    res.setHeader('Accept-Ranges', 'bytes');

    // Handle range requests for video seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : data.length - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`);
      res.setHeader('Content-Length', chunksize);
      res.end(data.slice(start, end + 1));
    } else {
      res.end(data);
    }
  } catch (error) {
    console.error('Error streaming from database:', error);
    res.status(404).json({
      error: 'File not found',
      key: req.params[0]
    });
  }
});

module.exports = router;
