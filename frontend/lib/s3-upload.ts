/**
 * Upload file to S3 using presigned URL
 */
export async function uploadToS3(presignedUrl: string, file: Blob, onProgress?: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

/**
 * Generate a unique filename for recording
 */
export function generateRecordingFilename(type: 'screen' | 'voice', extension: string = 'webm'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `recording-${type}-${timestamp}-${random}.${extension}`;
}
