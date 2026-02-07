const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

/**
 * Mock Storage Service for development when AWS S3 is not configured
 * This stores files locally in a temp directory and serves them via HTTP
 */
class MockStorageService {
  constructor() {
    // Create storage directory if it doesn't exist
    this.storageDir = path.join(__dirname, '../../mock-storage');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Generate a mock presigned URL for uploading a file
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

      // Create directory structure
      const filePath = path.join(this.storageDir, key);
      const fileDir = path.dirname(filePath);
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      // Return URLs for upload and access
      const mockUrl = `http://localhost:3001/mock-storage/${key}`;

      return {
        uploadUrl: mockUrl,  // Mock upload endpoint (will handle PUT request)
        key,                  // Storage key
        fileUrl: mockUrl     // Access URL for playback
      };
    } catch (error) {
      console.error('Error generating mock presigned URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  /**
   * Store a file from buffer
   * @param {string} key - Storage key
   * @param {Buffer} buffer - File buffer
   */
  async storeFile(key, buffer) {
    try {
      const filePath = path.join(this.storageDir, key);
      const fileDir = path.dirname(filePath);

      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      fs.writeFileSync(filePath, buffer);
      return true;
    } catch (error) {
      console.error('Error storing file:', error);
      throw error;
    }
  }

  /**
   * Get file path for serving
   * @param {string} key - Storage key
   */
  getFilePath(key) {
    return path.join(this.storageDir, key);
  }

  /**
   * Check if file exists
   * @param {string} key - Storage key
   */
  fileExists(key) {
    const filePath = this.getFilePath(key);
    return fs.existsSync(filePath);
  }

  /**
   * Extract S3 key from URL
   */
  extractKeyFromUrl(url) {
    try {
      const urlObj = new URL(url);
      // Remove '/mock-storage/' prefix
      return urlObj.pathname.replace('/mock-storage/', '');
    } catch (error) {
      return url;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(key) {
    try {
      const filePath = this.getFilePath(key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Mock: Deleted file:', key);
      }
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }
}

module.exports = new MockStorageService();
