const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'proscreen-recordings';
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

class S3Service {
  /**
   * Generate a presigned URL for uploading a file
   * @param {string} userId - User UUID
   * @param {string} fileName - Original file name
   * @param {string} fileType - MIME type
   * @param {string} recordingType - 'screen', 'voice', or 'camera'
   * @returns {Promise<{uploadUrl, key, url}>}
   */
  async getPresignedUploadUrl(userId, fileName, fileType, recordingType = 'screen') {
    try {
      // Generate unique key for the file
      const fileExtension = fileName.split('.').pop() || 'webm';
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      const key = `recordings/${userId}/${recordingType}/${uniqueFileName}`;

      // Create presigned URL for PUT operation
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: fileType,
        Metadata: {
          userId,
          recordingType,
          originalFileName: fileName
        }
      });

      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: PRESIGNED_URL_EXPIRY
      });

      // Public URL (or CloudFront URL in production)
      const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

      return {
        uploadUrl,  // For client to upload to
        key,        // S3 object key
        url: publicUrl  // For accessing the file later
      };
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  /**
   * Generate a presigned URL for downloading a file
   * @param {string} key - S3 object key
   * @param {number} expiresIn - URL expiry in seconds (default 1 hour)
   * @returns {Promise<string>}
   */
  async getPresignedDownloadUrl(key, expiresIn = PRESIGNED_URL_EXPIRY) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('Error generating download URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }

  /**
   * Delete a file from S3
   * @param {string} key - S3 object key
   * @returns {Promise<boolean>}
   */
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Extract S3 key from URL
   * @param {string} url - S3 or CloudFront URL
   * @returns {string} S3 key
   */
  extractKeyFromUrl(url) {
    try {
      const urlObj = new URL(url);
      // Remove leading slash
      return urlObj.pathname.substring(1);
    } catch (error) {
      console.error('Error extracting key from URL:', error);
      return url; // Assume it's already a key
    }
  }

  /**
   * Generate thumbnail upload URL
   * @param {string} userId - User UUID
   * @param {string} recordingId - Recording UUID
   * @returns {Promise<{uploadUrl, key, url}>}
   */
  async getThumbnailUploadUrl(userId, recordingId) {
    try {
      const key = `thumbnails/${userId}/${recordingId}.jpg`;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: 'image/jpeg',
        Metadata: {
          userId,
          recordingId
        }
      });

      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: PRESIGNED_URL_EXPIRY
      });

      const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

      return {
        uploadUrl,
        key,
        url: publicUrl
      };
    } catch (error) {
      console.error('Error generating thumbnail upload URL:', error);
      throw new Error('Failed to generate thumbnail upload URL');
    }
  }
}

module.exports = new S3Service();
