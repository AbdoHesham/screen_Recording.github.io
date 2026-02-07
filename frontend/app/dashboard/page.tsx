'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaVideo, FaCoins, FaSignOutAlt, FaPlay, FaTrash, FaDownload, FaClock, FaFileAlt } from 'react-icons/fa';
import { apiClient } from '@/lib/api-client';
import ThemeToggle from '@/components/ThemeToggle';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  creditsBalance: number;
}

interface Recording {
  id: string;
  title: string;
  type: string;
  status: string;
  durationSeconds: number;
  fileSizeBytes: number;
  createdAt: string;
  rawFileUrl: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      // Check if user is logged in
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Load user data
      const userData = await apiClient.getCurrentUser();
      setUser(userData.user);

      // Load credits
      const creditsData = await apiClient.getCredits();
      setCredits(creditsData.balance);

      // Load recordings
      const recordingsData = await apiClient.getRecordings();
      setRecordings(recordingsData.recordings);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      // If unauthorized, redirect to login
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiClient.logout();
    router.push('/');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;

    try {
      await apiClient.deleteRecording(id);
      setRecordings(recordings.filter(r => r.id !== id));
    } catch (error) {
      alert('Failed to delete recording');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-primary">
            <FaVideo className="text-2xl" />
            <span className="text-xl font-bold">ProScreen</span>
          </div>

          <div className="flex items-center gap-6">
            {/* Credits Display */}
            <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/30 px-4 py-2 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <FaCoins className="text-yellow-600 dark:text-yellow-500" />
              <span className="font-semibold text-yellow-800 dark:text-yellow-300">{credits} Credits</span>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.fullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm px-4 py-2"
              >
                <FaSignOutAlt />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Welcome back, {user?.fullName?.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your recordings and start creating amazing content.</p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Link href="/record" className="card hover:scale-105 transition cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center group-hover:scale-110 transition">
                <FaVideo className="text-white text-xl" />
              </div>
              <div>
                <h3 className="font-bold text-lg dark:text-gray-100">New Recording</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Start recording now</p>
              </div>
            </div>
          </Link>

          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-success to-info rounded-full flex items-center justify-center">
                <FaFileAlt className="text-white text-xl" />
              </div>
              <div>
                <h3 className="font-bold text-lg dark:text-gray-100">{recordings.length}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Recordings</p>
              </div>
            </div>
          </div>

          <Link href="/pricing" className="card hover:scale-105 transition cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-warning to-danger rounded-full flex items-center justify-center group-hover:scale-110 transition">
                <FaCoins className="text-white text-xl" />
              </div>
              <div>
                <h3 className="font-bold text-lg dark:text-gray-100">Buy Credits</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Get more AI features</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Recordings List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Your Recordings</h2>
          </div>

          {recordings.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <FaVideo className="text-gray-300 text-6xl mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No recordings yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Start recording to see your content here</p>
              <Link href="/record" className="btn btn-primary inline-flex">
                <FaVideo />
                Start Recording
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {recordings.map((recording) => (
                <div key={recording.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{recording.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="flex items-center gap-1">
                          <FaClock />
                          {formatDuration(recording.durationSeconds)}
                        </span>
                        <span>{formatFileSize(recording.fileSizeBytes)}</span>
                        <span className="capitalize">{recording.type}</span>
                        <span>{formatDate(recording.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={recording.rawFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn bg-green-100 text-green-700 hover:bg-green-200 text-sm px-3 py-2"
                        title="Play"
                      >
                        <FaPlay />
                      </a>
                      <a
                        href={recording.rawFileUrl}
                        download
                        className="btn bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm px-3 py-2"
                        title="Download"
                      >
                        <FaDownload />
                      </a>
                      <button
                        onClick={() => handleDelete(recording.id)}
                        className="btn bg-red-100 text-red-700 hover:bg-red-200 text-sm px-3 py-2"
                        title="Delete"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

