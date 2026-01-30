const { v4: uuidv4 } = require('uuid');

/**
 * Mock Storage Service for development when AWS S3 is not configured
 * This allows testing the recording flow without actual cloud storage
 *
 * Note: Files are not actually stored - this just generates mock URLs
 * for database entries. In production, use real S3 service.
 */
class MockStorageService {
  /**
   * Generate a mock presigned URL for uploading a file
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

      // For development: return mock URLs
      // Frontend will store blob locally and show warning
      const mockUrl = `http://localhost:3001/mock-storage/${key}`;

      return {
        uploadUrl: mockUrl,  // Mock upload endpoint
        key,                  // S3-style object key
        url: mockUrl         // Mock access URL
      };
    } catch (error) {
      console.error('Error generating mock presigned URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  /**
   * Mock: Extract S3 key from URL
   */
  extractKeyFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1);
    } catch (error) {
      return url;
    }
  }

  /**
   * Mock: Delete operation (no-op)
   */
  async deleteFile(key) {
    console.log('Mock: Delete file:', key);
    return true;
  }
}

module.exports = new MockStorageService();
