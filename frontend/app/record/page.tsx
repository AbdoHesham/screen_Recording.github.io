'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { FaVideo, FaMicrophone, FaDesktop, FaPlay, FaStop, FaPause, FaArrowLeft, FaDownload, FaTrash, FaEdit } from 'react-icons/fa';
import { useRecording, RecordingMode, AudioSource } from '@/hooks/useRecording';
import { generateRecordingFilename } from '@/lib/s3-upload';

// IndexedDB utilities
const DB_NAME = 'ProScreenDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

interface SavedRecording {
  id: number;
  name: string;
  type: 'video' | 'audio';
  blob: Blob;
  size: string;
  duration: string;
  date: string;
  time: string;
  mimeType: string;
  transcription?: string;
}

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
    };
  });
};

const saveToIndexedDB = async (recording: SavedRecording): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  await store.add(recording);
};

const loadFromIndexedDB = async (): Promise<SavedRecording[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const recordings = request.result as SavedRecording[];
      resolve(recordings.sort((a, b) => b.id - a.id));
    };
    request.onerror = () => reject(request.error);
  });
};

const deleteFromIndexedDB = async (id: number): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  await store.delete(id);
};

export default function RecordPage() {
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('screen');
  const [audioSource, setAudioSource] = useState<AudioSource>('system');
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const {
    isRecording,
    isPaused,
    duration,
    blob,
    previewUrl,
    transcription,
    isTranscribing,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  } = useRecording();

  // Load recordings from IndexedDB on mount
  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      const recordings = await loadFromIndexedDB();
      setSavedRecordings(recordings);
    } catch (error) {
      console.error('Failed to load recordings:', error);
      showNotification('Failed to load recordings', 'error');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Format duration (seconds to MM:SS)
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleStart = async () => {
    try {
      await startRecording(recordingMode, audioSource);
    } catch (err: any) {
      showNotification(err.message || 'Failed to start recording', 'error');
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

  const handleSaveLocally = async () => {
    if (!blob) return;

    try {
      const recording: SavedRecording = {
        id: Date.now(),
        name: `${recordingMode === 'screen' ? 'Screen' : 'Voice'} Recording`,
        type: recordingMode === 'screen' ? 'video' : 'audio',
        blob: blob,
        size: formatFileSize(blob.size),
        duration: formatDuration(duration),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        mimeType: blob.type,
        transcription: transcription || undefined,
      };

      await saveToIndexedDB(recording);
      await loadRecordings();
      showNotification('Recording saved successfully!', 'success');
      resetRecording();
    } catch (error) {
      console.error('Failed to save recording:', error);
      showNotification('Failed to save recording', 'error');
    }
  };

  const handleDownload = (recordingBlob?: Blob, recordingName?: string) => {
    const downloadBlob = recordingBlob || blob;
    if (!downloadBlob) return;

    const fileName = recordingName || generateRecordingFilename(recordingMode);
    const url = URL.createObjectURL(downloadBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    if (!recordingBlob) {
      showNotification('Download started!', 'success');
    }
  };

  const handleDownloadTranscription = (recordingTranscription?: string) => {
    const textToDownload = recordingTranscription || transcription;
    if (!textToDownload) {
      showNotification('No transcription available', 'error');
      return;
    }

    const blob = new Blob([textToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Transcription downloaded!', 'success');
  };

  const handlePlayRecording = (recording: SavedRecording) => {
    const url = URL.createObjectURL(recording.blob);
    window.open(url, '_blank');
  };

  const handleDeleteRecording = async (id: number) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;

    try {
      await deleteFromIndexedDB(id);
      await loadRecordings();
      showNotification('Recording deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete recording:', error);
      showNotification('Failed to delete recording', 'error');
    }
  };

  const handleReset = () => {
    resetRecording();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm">
              <FaArrowLeft />
              Back to Home
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {recordingMode === 'screen' ? 'Screen Recording' : 'Voice Recording'}
            </h1>
          </div>

          {/* Timer */}
          {isRecording && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100">
                  {formatDuration(duration)}
                </span>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {isPaused ? 'Paused' : 'Recording'}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 animate-fade-in">
          <div className={`px-6 py-3 rounded-lg shadow-lg ${
            notification.type === 'success' ? 'bg-green-500 text-white' :
            notification.type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
          }`}>
            {notification.message}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2 className="text-lg font-bold mb-4">Recording Settings</h2>

              {/* Mode Selection */}
              {!isRecording && !blob && (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Recording Mode
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setRecordingMode('screen')}
                        className={`p-4 rounded-lg border-2 transition ${
                          recordingMode === 'screen'
                            ? 'border-primary bg-primary/10'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
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
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                      onClick={handleDownload}
                      className="btn btn-primary w-full"
                    >
                      <FaDownload />
                      Download
                    </button>

                    <button
                      onClick={handleSaveLocally}
                      className="btn bg-green-500 text-white hover:bg-green-600 w-full"
                    >
                      <FaVideo />
                      Save to Library
                    </button>

                    <button
                      onClick={handleReset}
                      className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 w-full"
                    >
                      <FaPlay />
                      New Recording
                    </button>
                  </>
                )}
              </div>

              {/* Info */}
              {!isRecording && !blob && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                    {recordingMode === 'screen' ? 'Screen Recording Tips' : 'Voice Recording Tips'}
                  </h3>
                  <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                    {recordingMode === 'screen' ? (
                      <>
                        <li>- Select the window or screen to share</li>
                        <li>- Choose audio source for narration</li>
                        <li>- Click Stop when finished</li>
                        <li>- No login required - recordings saved locally</li>
                      </>
                    ) : (
                      <>
                        <li>- Allow microphone access</li>
                        <li>- Speak clearly into your microphone</li>
                        <li>- Click Stop when finished</li>
                        <li>- No login required - recordings saved locally</li>
                      </>
                    )}
                  </ul>
                </div>
              )}

              <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Advanced Video Editor
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Trim and polish your recordings without logging in.
                </p>
                <Link href="/editor" className="btn btn-primary text-sm px-4 py-2 inline-flex">
                  Open Editor
                </Link>
              </div>
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
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Recording complete! Duration: {formatDuration(duration)} |
                    Size: {(blob.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    Download immediately or save to your local library. No login required!
                  </p>
                </div>
              )}
            </div>

            {/* Transcription Section */}
            {(isRecording || isTranscribing || transcription) && (
              <div className="card mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <FaMicrophone className="text-primary" />
                    Live Transcription
                    {isTranscribing && <span className="text-xs text-green-500">(Active)</span>}
                  </h2>
                  {transcription && !isRecording && (
                    <button
                      onClick={() => handleDownloadTranscription()}
                      className="btn bg-blue-500 text-white hover:bg-blue-600 text-sm py-2"
                    >
                      <FaDownload />
                      Download Text
                    </button>
                  )}
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 min-h-[120px] max-h-[300px] overflow-y-auto">
                  {transcription ? (
                    <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {transcription}
                    </p>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 italic">
                      {isRecording
                        ? 'Start speaking to see transcription here...'
                        : 'No transcription available'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Recording History */}
            {savedRecordings.length > 0 && (
              <div className="card mt-6">
                <h2 className="text-lg font-bold mb-4">Your Recordings ({savedRecordings.length})</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {savedRecordings.map((recording) => (
                    <div
                      key={recording.id}
                      className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {recording.type === 'video' ? (
                              <FaVideo className="text-primary" />
                            ) : (
                              <FaMicrophone className="text-primary" />
                            )}
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                              {recording.name}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {recording.date} at {recording.time}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Duration: {recording.duration} | Size: {recording.size}
                          </p>
                          {recording.transcription && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              📝 Has transcription
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePlayRecording(recording)}
                            className="p-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
                            title="Play"
                          >
                            <FaPlay />
                          </button>
                          <button
                            onClick={() => handleDownload(recording.blob, `${recording.name.replace(/\s+/g, '-')}.webm`)}
                            className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                            title="Download"
                          >
                            <FaDownload />
                          </button>
                          {recording.transcription && (
                            <button
                              onClick={() => handleDownloadTranscription(recording.transcription)}
                              className="p-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition"
                              title="Download Transcription"
                            >
                              <FaMicrophone />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteRecording(recording.id)}
                            className="p-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}




