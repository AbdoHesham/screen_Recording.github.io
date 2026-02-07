'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FaUsers, FaDollarSign, FaChartLine, FaCog, FaUserPlus, FaCoins,
  FaVideo, FaArrowLeft, FaSearch, FaTrash, FaTimes, FaToggleOn, FaToggleOff
} from 'react-icons/fa';
import { apiClient } from '@/lib/api-client';
import ThemeToggle from '@/components/ThemeToggle';

interface Stats {
  users: {
    total: number;
    byRole: Array<{ role: string; count: string }>;
    newThisMonth: number;
    active30Days: number;
  };
  recordings: { total: number };
  credits: {
    totalDistributed: number;
    totalPurchased: number;
    totalUsed: number;
  };
  revenue: {
    total: string;
    transactions: number;
  };
  aiJobs: {
    total: number;
    completed: number;
    failed: number;
    creditsUsed: number;
  };
}

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  creditsBalance: number;
  emailVerified: boolean;
  createdAt: string;
  lastLogin: string | null;
}

interface Feature {
  id: string;
  featureName: string;
  displayName: string;
  description: string;
  enabled: boolean;
  requiresSubscription: boolean;
  requiredRole: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'revenue' | 'features'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'free',
    creditsBalance: 100
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadDashboard();
  }, [router]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load stats
      const statsData = await apiClient.getAdminStats();
      setStats(statsData);

      // Load users
      const usersData = await apiClient.getAdminUsers(100, 0, searchTerm);
      setUsers(usersData.users);

      // Load features
      const featuresData = await apiClient.getFeatures();
      setFeatures(featuresData.features);
    } catch (err: any) {
      console.error('Admin dashboard error:', err);
      if (err.message.includes('Insufficient permissions') || err.message.includes('403')) {
        setError('Access denied. Admin role required.');
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        setError(err.message || 'Failed to load admin dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createAdminUser(newUser);
      setShowAddUser(false);
      setNewUser({
        email: '',
        password: '',
        fullName: '',
        role: 'free',
        creditsBalance: 100
      });
      loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    }
  };

  const handleGrantCredits = async (userId: string, amount: number) => {
    const userEmail = users.find(u => u.id === userId)?.email;
    const creditsInput = prompt(`Grant credits to ${userEmail}:`, amount.toString());
    if (!creditsInput) return;

    try {
      await apiClient.grantCredits(userId, parseInt(creditsInput));
      loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to grant credits');
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;

    try {
      await apiClient.deleteAdminUser(userId);
      loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleUpdateRole = async (userId: string, currentRole: string) => {
    const newRole = prompt(`Change role for this user (current: ${currentRole}):`, currentRole);
    if (!newRole || newRole === currentRole) return;

    try {
      await apiClient.updateAdminUser(userId, { role: newRole });
      loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    }
  };

  const handleToggleFeature = async (featureId: string, currentEnabled: boolean) => {
    try {
      await apiClient.updateFeature(featureId, { enabled: !currentEnabled });
      loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle feature');
    }
  };

  const handleToggleSubscription = async (featureId: string, currentRequiresSubscription: boolean) => {
    try {
      await apiClient.updateFeature(featureId, { requiresSubscription: !currentRequiresSubscription });
      loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to update subscription requirement');
    }
  };

  const handleChangeRequiredRole = async (featureId: string, currentRole: string) => {
    const newRole = prompt(`Change required role (current: ${currentRole}):`, currentRole);
    if (!newRole || newRole === currentRole) return;

    try {
      await apiClient.updateFeature(featureId, { requiredRole: newRole });
      loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to update required role');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="card max-w-md">
          <div className="text-red-600 dark:text-red-400 text-center">
            <FaTimes className="text-4xl mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Access Denied</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm">
                <FaArrowLeft />
                Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                <FaCog className="inline mr-2" />
                Admin Dashboard
              </h1>
            </div>
            <ThemeToggle />
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 font-medium transition border-b-2 ${
                activeTab === 'overview'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <FaChartLine className="inline mr-2" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 font-medium transition border-b-2 ${
                activeTab === 'users'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <FaUsers className="inline mr-2" />
              Users ({stats?.users.total || 0})
            </button>
            <button
              onClick={() => setActiveTab('revenue')}
              className={`px-4 py-2 font-medium transition border-b-2 ${
                activeTab === 'revenue'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <FaDollarSign className="inline mr-2" />
              Revenue
            </button>
            <button
              onClick={() => setActiveTab('features')}
              className={`px-4 py-2 font-medium transition border-b-2 ${
                activeTab === 'features'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <FaCog className="inline mr-2" />
              Features
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Management Links */}
            <div className="grid md:grid-cols-4 gap-4">
              <Link href="/admin/plans" className="card hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900 dark:to-indigo-800 border-2 border-indigo-200 dark:border-indigo-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-indigo-600 dark:text-indigo-300 text-sm font-medium">Plans Management</p>
                    <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">Create & edit subscription plans</p>
                  </div>
                  <FaDollarSign className="text-2xl text-indigo-400 dark:text-indigo-500" />
                </div>
              </Link>

              <Link href="/admin/features" className="card hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900 dark:to-teal-800 border-2 border-teal-200 dark:border-teal-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-teal-600 dark:text-teal-300 text-sm font-medium">Features Management</p>
                    <p className="text-xs text-teal-500 dark:text-teal-400 mt-1">Manage system features</p>
                  </div>
                  <FaCog className="text-2xl text-teal-400 dark:text-teal-500" />
                </div>
              </Link>

              <Link href="/admin/users-plans" className="card hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900 dark:to-pink-800 border-2 border-pink-200 dark:border-pink-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-pink-600 dark:text-pink-300 text-sm font-medium">User Plans</p>
                    <p className="text-xs text-pink-500 dark:text-pink-400 mt-1">Assign plans to users</p>
                  </div>
                  <FaUsers className="text-2xl text-pink-400 dark:text-pink-500" />
                </div>
              </Link>

              <Link href="/admin/landing-page" className="card hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900 dark:to-amber-800 border-2 border-amber-200 dark:border-amber-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-600 dark:text-amber-300 text-sm font-medium">Landing Page</p>
                    <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">Edit landing page content</p>
                  </div>
                  <FaChartLine className="text-2xl text-amber-400 dark:text-amber-500" />
                </div>
              </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-4 gap-6">
              <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Total Users</p>
                    <p className="text-3xl font-bold">{stats.users.total}</p>
                    <p className="text-blue-100 text-xs mt-1">+{stats.users.newThisMonth} this month</p>
                  </div>
                  <FaUsers className="text-4xl text-blue-200" />
                </div>
              </div>

              <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Revenue</p>
                    <p className="text-3xl font-bold">${stats.revenue.total}</p>
                    <p className="text-green-100 text-xs mt-1">{stats.revenue.transactions} transactions</p>
                  </div>
                  <FaDollarSign className="text-4xl text-green-200" />
                </div>
              </div>

              <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">Recordings</p>
                    <p className="text-3xl font-bold">{stats.recordings.total}</p>
                    <p className="text-purple-100 text-xs mt-1">Total created</p>
                  </div>
                  <FaVideo className="text-4xl text-purple-200" />
                </div>
              </div>

              <div className="card bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-100 text-sm">Credits</p>
                    <p className="text-3xl font-bold">{stats.credits.totalDistributed.toLocaleString()}</p>
                    <p className="text-yellow-100 text-xs mt-1">{stats.credits.totalUsed} used</p>
                  </div>
                  <FaCoins className="text-4xl text-yellow-200" />
                </div>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Users by Role</h3>
                <div className="space-y-3">
                  {stats.users.byRole.map((item) => (
                    <div key={item.role} className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300 capitalize">{item.role}</span>
                      <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">AI Jobs</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Total Jobs</span>
                    <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{stats.aiJobs.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Completed</span>
                    <span className="font-bold text-lg text-green-600 dark:text-green-400">{stats.aiJobs.completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Failed</span>
                    <span className="font-bold text-lg text-red-600 dark:text-red-400">{stats.aiJobs.failed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Credits Used</span>
                    <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{stats.aiJobs.creditsUsed}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Actions Bar */}
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 w-full"
                />
              </div>
              <button
                onClick={() => setShowAddUser(true)}
                className="btn btn-primary"
              >
                <FaUserPlus />
                Add User
              </button>
            </div>

            {/* Add User Modal */}
            {showAddUser && (
              <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
                <div className="card max-w-md w-full">
                  <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Add New User</h2>
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email</label>
                      <input
                        type="email"
                        required
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Full Name</label>
                      <input
                        type="text"
                        required
                        value={newUser.fullName}
                        onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password</label>
                      <input
                        type="password"
                        required
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Role</label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        className="input w-full"
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Initial Credits</label>
                      <input
                        type="number"
                        value={newUser.creditsBalance}
                        onChange={(e) => setNewUser({ ...newUser, creditsBalance: parseInt(e.target.value) })}
                        className="input w-full"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" className="btn btn-primary flex-1">
                        Create User
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddUser(false)}
                        className="btn bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 flex-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Users Table */}
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">User</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Credits</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Joined</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Last Login</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter(u =>
                      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      u.fullName.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{user.fullName}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleUpdateRole(user.id, user.role)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide transition-all ${
                              user.role === 'admin'
                                ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 ring-2 ring-red-300 dark:ring-red-700'
                                : user.role === 'pro'
                                ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 ring-2 ring-purple-300 dark:ring-purple-700'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                            title={`Click to change role (current: ${user.role})`}
                          >
                            {user.role === 'admin' && '👑 '}
                            {user.role === 'pro' && '⭐ '}
                            {user.role}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleGrantCredits(user.id, user.creditsBalance)}
                            className="font-medium text-primary hover:underline"
                          >
                            {user.creditsBalance}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="btn bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 text-sm px-3 py-1"
                              title="Delete user"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && stats && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="card">
                <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Revenue</h3>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">${stats.revenue.total}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stats.revenue.transactions} transactions</p>
              </div>
              <div className="card">
                <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Credits Sold</h3>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.credits.totalPurchased.toLocaleString()}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Lifetime</p>
              </div>
              <div className="card">
                <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Active Users (30d)</h3>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.users.active30Days}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Last 30 days</p>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Revenue Breakdown</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-300">Credits Purchased</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">{stats.credits.totalPurchased} (${ (stats.credits.totalPurchased * 0.10).toFixed(2)})</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-300">Credits Used (AI)</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">{stats.credits.totalUsed}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-gray-700 dark:text-gray-300">Average per Transaction</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    ${stats.revenue.transactions > 0
                      ? (parseFloat(stats.revenue.total) / stats.revenue.transactions).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Features Tab */}
        {activeTab === 'features' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Feature Flags Management</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Control which features are enabled and whether they require subscriptions.
                Features marked as requiring subscription will only be available to Pro users.
              </p>

              {/* Features Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Feature</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Subscription</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Required Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((feature) => (
                      <tr key={feature.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="py-4 px-4">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{feature.displayName}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{feature.description}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{feature.featureName}</code>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleToggleFeature(feature.id, feature.enabled)}
                            className={`flex items-center gap-2 px-3 py-2 rounded transition ${
                              feature.enabled
                                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'
                                : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800'
                            }`}
                          >
                            {feature.enabled ? (
                              <>
                                <FaToggleOn className="text-xl" />
                                <span className="text-sm font-medium">Enabled</span>
                              </>
                            ) : (
                              <>
                                <FaToggleOff className="text-xl" />
                                <span className="text-sm font-medium">Disabled</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleToggleSubscription(feature.id, feature.requiresSubscription)}
                            className={`px-3 py-2 rounded text-sm font-medium transition ${
                              feature.requiresSubscription
                                ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {feature.requiresSubscription ? 'Pro Only' : 'Free'}
                          </button>
                        </td>
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleChangeRequiredRole(feature.id, feature.requiredRole)}
                            className="px-3 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 rounded text-sm font-medium capitalize"
                          >
                            {feature.requiredRole}
                          </button>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(feature.updatedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {features.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <FaCog className="text-4xl mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p>No features configured yet</p>
                </div>
              )}
            </div>

            {/* Features Guide */}
            <div className="card bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700">
              <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">How to Use Feature Flags</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <li>
                  <strong>Status:</strong> Click to enable/disable features. Disabled features are hidden from all users.
                </li>
                <li>
                  <strong>Subscription:</strong> Toggle between Free (available to all) and Pro Only (requires subscription).
                </li>
                <li>
                  <strong>Required Role:</strong> Set minimum user role needed (free, pro, or admin).
                </li>
                <li>
                  <strong>Example:</strong> The "Video Editor" feature is currently set to Free, so all users can access it.
                  Click "Free" to change it to "Pro Only" to monetize this feature.
                </li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
