const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/connection');

/**
 * Database Storage Service - stores files directly in PostgreSQL
 * No external storage (S3, filesystem) required
 */
class DbStorageService {
  /**
   * Generate a unique identifier for file upload
   * @param {string} userId - User UUID
   * @param {string} fileName - Original file name
   * @param {string} fileType - MIME type
   * @param {string} recordingType - 'screen', 'voice', or 'camera'
   * @returns {Promise<{uploadUrl, key, fileUrl}>}
   */
  async getPresignedUploadUrl(userId, fileName, fileType, recordingType = 'screen') {
    try {
      // Generate unique key for the file
      const fileExtension = fileName.split('.').pop() || 'webm';
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      const key = `recordings/${userId}/${recordingType}/${uniqueFileName}`;

      // For database storage, we return a special endpoint
      const uploadUrl = `http://localhost:3001/api/recordings/upload-db/${key}`;
      const fileUrl = `http://localhost:3001/api/recordings/stream/${key}`;

      return {
        uploadUrl,  // Endpoint to upload file data to database
        key,        // Unique identifier
        fileUrl     // Endpoint to stream file from database
      };
    } catch (error) {
      console.error('Error generating database upload URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  /**
   * Store file data in database
   * @param {string} key - Storage key
   * @param {Buffer} buffer - File buffer
   * @param {string} contentType - MIME type
   * @param {string} userId - User ID
   */
  async storeFile(key, buffer, contentType, userId) {
    try {
      // Extract recording type and create initial record
      const recordingType = key.includes('/screen/') ? 'screen' :
                           key.includes('/voice/') ? 'voice' : 'camera';

      const fileName = key.split('/').pop();
      const title = fileName.replace(/\.[^/.]+$/, '');

      // Insert or update recording with file data
      const result = await query(
        `INSERT INTO recordings (
          user_id, title, type, raw_file_url,
          file_data, file_content_type,
          file_size_bytes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (raw_file_url)
        DO UPDATE SET
          file_data = EXCLUDED.file_data,
          file_content_type = EXCLUDED.file_content_type,
          file_size_bytes = EXCLUDED.file_size_bytes,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id`,
        [
          userId,
          title,
          recordingType,
          `http://localhost:3001/api/recordings/stream/${key}`,
          buffer,
          contentType,
          buffer.length,
          'processing'
        ]
      );

      console.log(`✅ Stored file in database: ${key} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error storing file in database:', error);
      throw error;
    }
  }

  /**
   * Retrieve file data from database
   * @param {string} key - Storage key
   * @returns {Promise<{data: Buffer, contentType: string}>}
   */
  async getFile(key) {
    try {
      const fileUrl = `http://localhost:3001/api/recordings/stream/${key}`;

      const result = await query(
        `SELECT file_data, file_content_type
         FROM recordings
         WHERE raw_file_url = $1`,
        [fileUrl]
      );

      if (result.rows.length === 0) {
        throw new Error('File not found');
      }

      const row = result.rows[0];

      if (!row.file_data) {
        throw new Error('File data not found in database');
      }

      return {
        data: row.file_data,
        contentType: row.file_content_type || 'video/webm'
      };
    } catch (error) {
      console.error('Error retrieving file from database:', error);
      throw error;
    }
  }

  /**
   * Check if file exists in database
   * @param {string} key - Storage key
   */
  async fileExists(key) {
    try {
      const fileUrl = `http://localhost:3001/api/recordings/stream/${key}`;

      const result = await query(
        `SELECT EXISTS(
          SELECT 1 FROM recordings
          WHERE raw_file_url = $1 AND file_data IS NOT NULL
        ) as exists`,
        [fileUrl]
      );

      return result.rows[0].exists;
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  }

  /**
   * Delete a file from database
   * @param {string} key - Storage key
   */
  async deleteFile(key) {
    try {
      const fileUrl = `http://localhost:3001/api/recordings/stream/${key}`;

      await query(
        `UPDATE recordings
         SET file_data = NULL, file_content_type = NULL
         WHERE raw_file_url = $1`,
        [fileUrl]
      );

      console.log('Database: Cleared file data for:', key);
      return true;
    } catch (error) {
      console.error('Error deleting file from database:', error);
      return false;
    }
  }

  /**
   * Extract key from URL
   */
  extractKeyFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.replace('/api/recordings/stream/', '');
    } catch (error) {
      return url;
    }
  }
}

module.exports = new DbStorageService();
