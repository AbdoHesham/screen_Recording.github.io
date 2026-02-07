const express = require('express');
const router = express.Router();
const mockStorageService = require('../utils/mockStorageService');
const path = require('path');

/**
 * Mock Storage Routes
 * Only used in development when AWS S3 is not configured
 * Handles file uploads and serving for local testing
 */

/**
 * PUT /mock-storage/:key
 * Upload a file to mock storage (mimics S3 presigned URL upload)
 */
router.put('/*', async (req, res) => {
  try {
    const key = req.params[0]; // Get full path after /mock-storage/

    // Collect chunks of the upload
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);

        // Store the file
        await mockStorageService.storeFile(key, buffer);

        console.log(`📁 Mock storage: File uploaded - ${key} (${buffer.length} bytes)`);

        res.status(200).json({
          message: 'File uploaded successfully',
          key,
          size: buffer.length
        });
      } catch (error) {
        console.error('Error storing file:', error);
        res.status(500).json({ error: 'Failed to store file' });
      }
    });

    req.on('error', (error) => {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    });
  } catch (error) {
    console.error('Mock storage upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * GET /mock-storage/:key
 * Retrieve a file from mock storage (mimics S3 file access)
 */
router.get('/*', (req, res) => {
  try {
    const key = req.params[0]; // Get full path after /mock-storage/

    // Check if file exists
    if (!mockStorageService.fileExists(key)) {
      return res.status(404).json({
        error: 'File not found',
        key
      });
    }

    // Get file path
    const filePath = mockStorageService.getFilePath(key);

    // Determine content type based on file extension
    const ext = path.extname(key).toLowerCase();
    const contentTypes = {
      '.webm': 'video/webm',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set headers for video/audio streaming
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');

    // Stream the file
    const fs = require('fs');
    const stat = fs.statSync(filePath);

    // Handle range requests for video seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': chunksize,
        'Content-Type': contentType
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }

    console.log(`📥 Mock storage: File served - ${key}`);
  } catch (error) {
    console.error('Mock storage retrieve error:', error);
    res.status(500).json({ error: 'Failed to retrieve file' });
  }
});

module.exports = router;
