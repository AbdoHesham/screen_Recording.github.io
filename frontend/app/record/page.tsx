'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaVideo, FaMicrophone, FaDesktop, FaPlay, FaStop, FaPause, FaArrowLeft, FaSave, FaRedo, FaCloudUploadAlt } from 'react-icons/fa';
import { useRecording, RecordingMode, AudioSource } from '@/hooks/useRecording';
import { apiClient } from '@/lib/api-client';
import { uploadToS3, generateRecordingFilename } from '@/lib/s3-upload';

export default function RecordPage() {
  const router = useRouter();
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('screen');
  const [audioSource, setAudioSource] = useState<AudioSource>('system');
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    isRecording,
    isPaused,
    duration,
    blob,
    previewUrl,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  } = useRecording();

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // Format duration (seconds to MM:SS)
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    try {
      setError(null);
      await startRecording(recordingMode, audioSource);
    } catch (err: any) {
      setError(err.message || 'Failed to start recording');
    }
  };

  const handleStop = () => {
    stopRecording();
  };

  const handlePause = () => {
    pauseRecording();
  };

  const handleResume = () => {
    resumeRecording();
  };

  const handleSave = async () => {
    if (!blob) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      setUploadProgress(0);

      // Generate filename
      const fileName = generateRecordingFilename(recordingMode);
      const fileType = blob.type || (recordingMode === 'screen' ? 'video/webm' : 'audio/webm');

      // Step 1: Get presigned URL from backend
      const presignedData = await apiClient.getPresignedUrl(fileName, fileType, recordingMode);

      // Check if this is mock storage (for development without S3)
      const isMockStorage = presignedData.uploadUrl.includes('mock-storage');

      if (!isMockStorage) {
        // Step 2: Upload to S3 (real cloud storage)
        setUploadProgress(10);
        await uploadToS3(presignedData.uploadUrl, blob, (progress) => {
          setUploadProgress(Math.round(progress));
        });
      } else {
        // Mock storage - skip actual upload
        console.log('📁 Development mode: Skipping S3 upload (AWS not configured)');
        setUploadProgress(100);
      }

      // Step 3: Save recording metadata to database
      const recordingData = {
        title: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
        type: recordingMode,
        rawFileUrl: presignedData.fileUrl, // The S3 URL (or mock URL)
        durationSeconds: duration,
        fileSizeBytes: blob.size,
        status: 'ready',
      };

      const result = await apiClient.createRecording(recordingData);

      if (isMockStorage) {
        setSuccessMessage('✅ Recording saved to database! (Dev mode: file stored locally. Configure AWS S3 for cloud storage.)');
      } else {
        setSuccessMessage('✅ Recording uploaded to cloud and saved! Redirecting to dashboard...');
      }

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save recording. You can download it locally instead.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!blob) return;

    const fileName = generateRecordingFilename(recordingMode);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    resetRecording();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">
              <FaArrowLeft />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              {recordingMode === 'screen' ? 'Screen Recording' : 'Voice Recording'}
            </h1>
          </div>

          {/* Timer */}
          {isRecording && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-2xl font-mono font-bold text-gray-900">
                  {formatDuration(duration)}
                </span>
              </div>
              <span className="text-sm text-gray-600">
                {isPaused ? 'Paused' : 'Recording'}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {successMessage}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2 className="text-lg font-bold mb-4">Recording Settings</h2>

              {/* Mode Selection */}
              {!isRecording && !blob && (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recording Mode
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setRecordingMode('screen')}
                        className={`p-4 rounded-lg border-2 transition ${
                          recordingMode === 'screen'
                            ? 'border-primary bg-primary/10'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <FaDesktop className="text-2xl mx-auto mb-2 text-primary" />
                        <div className="text-sm font-medium">Screen</div>
                      </button>
                      <button
                        onClick={() => setRecordingMode('voice')}
                        className={`p-4 rounded-lg border-2 transition ${
                          recordingMode === 'voice'
                            ? 'border-primary bg-primary/10'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <FaMicrophone className="text-2xl mx-auto mb-2 text-primary" />
                        <div className="text-sm font-medium">Voice</div>
                      </button>
                    </div>
                  </div>

                  {/* Audio Source (only for screen recording) */}
                  {recordingMode === 'screen' && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Audio Source
                      </label>
                      <select
                        value={audioSource}
                        onChange={(e) => setAudioSource(e.target.value as AudioSource)}
                        className="input w-full"
                      >
                        <option value="system">System Audio</option>
                        <option value="microphone">Microphone</option>
                        <option value="both">System + Microphone</option>
                        <option value="none">No Audio</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Recording Controls */}
              <div className="space-y-3">
                {!isRecording && !blob && (
                  <button onClick={handleStart} className="btn btn-primary w-full text-lg py-3">
                    <FaPlay />
                    Start Recording
                  </button>
                )}

                {isRecording && (
                  <>
                    {!isPaused ? (
                      <button onClick={handlePause} className="btn bg-yellow-500 text-white hover:bg-yellow-600 w-full">
                        <FaPause />
                        Pause
                      </button>
                    ) : (
                      <button onClick={handleResume} className="btn bg-green-500 text-white hover:bg-green-600 w-full">
                        <FaPlay />
                        Resume
                      </button>
                    )}

                    <button onClick={handleStop} className="btn bg-red-500 text-white hover:bg-red-600 w-full">
                      <FaStop />
                      Stop Recording
                    </button>
                  </>
                )}

                {blob && !isRecording && (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving || !!successMessage}
                      className="btn btn-primary w-full"
                    >
                      <FaCloudUploadAlt />
                      {saving ? `Uploading... ${uploadProgress}%` : successMessage ? 'Saved!' : 'Save to Cloud'}
                    </button>

                    {saving && uploadProgress > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}

                    <button
                      onClick={handleDownload}
                      disabled={saving}
                      className="btn bg-blue-500 text-white hover:bg-blue-600 w-full"
                    >
                      <FaSave />
                      Download Locally
                    </button>

                    <button
                      onClick={handleReset}
                      disabled={saving}
                      className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 w-full"
                    >
                      <FaRedo />
                      New Recording
                    </button>
                  </>
                )}
              </div>

              {/* Info */}
              {!isRecording && !blob && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">
                    {recordingMode === 'screen' ? 'Screen Recording Tips' : 'Voice Recording Tips'}
                  </h3>
                  <ul className="text-xs text-blue-800 space-y-1">
                    {recordingMode === 'screen' ? (
                      <>
                        <li>• Select the window or screen to share</li>
                        <li>• Choose audio source for narration</li>
                        <li>• Click Stop when finished</li>
                      </>
                    ) : (
                      <>
                        <li>• Allow microphone access</li>
                        <li>• Speak clearly into your microphone</li>
                        <li>• Click Stop when finished</li>
                      </>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="lg:col-span-2">
            <div className="card">
              <h2 className="text-lg font-bold mb-4">
                {blob ? 'Preview' : isRecording ? 'Recording in Progress' : 'Ready to Record'}
              </h2>

              <div className="bg-gray-900 rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
                {blob && previewUrl ? (
                  <video
                    src={previewUrl}
                    controls
                    className="w-full h-full"
                    style={{ maxHeight: '600px' }}
                  />
                ) : isRecording ? (
                  <div className="h-96 flex flex-col items-center justify-center text-white">
                    <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-xl font-semibold mb-2">
                      {isPaused ? 'Recording Paused' : 'Recording...'}
                    </p>
                    <p className="text-gray-400">
                      {recordingMode === 'screen'
                        ? 'Your screen is being recorded'
                        : 'Your voice is being recorded'}
                    </p>
                  </div>
                ) : (
                  <div className="h-96 flex flex-col items-center justify-center text-white">
                    <FaVideo className="text-6xl mb-4 text-gray-600" />
                    <p className="text-xl font-semibold mb-2 text-gray-400">Ready to Start</p>
                    <p className="text-gray-500">
                      Click "Start Recording" to begin
                    </p>
                  </div>
                )}
              </div>

              {blob && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">
                    ✅ Recording complete! Duration: {formatDuration(duration)} |
                    Size: {(blob.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Save to cloud to view in your dashboard, or download locally to your computer.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
