'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FaUsers, FaDollarSign, FaChartLine, FaCog, FaUserPlus, FaCoins,
  FaVideo, FaArrowLeft, FaSearch, FaEdit, FaTrash, FaCheck, FaTimes
} from 'react-icons/fa';
import { apiClient } from '@/lib/api-client';

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

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'revenue'>('overview');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card max-w-md">
          <div className="text-red-600 text-center">
            <FaTimes className="text-4xl mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Access Denied</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">
                <FaArrowLeft />
                Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                <FaCog className="inline mr-2" />
                Admin Dashboard
              </h1>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 font-medium transition border-b-2 ${
                activeTab === 'overview'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
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
                  : 'border-transparent text-gray-600 hover:text-gray-900'
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
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <FaDollarSign className="inline mr-2" />
              Revenue
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
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
                <h3 className="text-lg font-bold mb-4">Users by Role</h3>
                <div className="space-y-3">
                  {stats.users.byRole.map((item) => (
                    <div key={item.role} className="flex items-center justify-between">
                      <span className="text-gray-700 capitalize">{item.role}</span>
                      <span className="font-bold text-lg">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-bold mb-4">AI Jobs</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Total Jobs</span>
                    <span className="font-bold text-lg">{stats.aiJobs.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Completed</span>
                    <span className="font-bold text-lg text-green-600">{stats.aiJobs.completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Failed</span>
                    <span className="font-bold text-lg text-red-600">{stats.aiJobs.failed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Credits Used</span>
                    <span className="font-bold text-lg">{stats.aiJobs.creditsUsed}</span>
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
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="card max-w-md w-full">
                  <h2 className="text-xl font-bold mb-4">Add New User</h2>
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Email</label>
                      <input
                        type="email"
                        required
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={newUser.fullName}
                        onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Password</label>
                      <input
                        type="password"
                        required
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Role</label>
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
                      <label className="block text-sm font-medium mb-1">Initial Credits</label>
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
                        className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 flex-1"
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
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Credits</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Joined</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Login</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter(u =>
                      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      u.fullName.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-gray-900">{user.fullName}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleUpdateRole(user.id, user.role)}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm capitalize"
                          >
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
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="btn bg-red-100 text-red-700 hover:bg-red-200 text-sm px-3 py-1"
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
                <h3 className="text-sm text-gray-600 mb-2">Total Revenue</h3>
                <p className="text-3xl font-bold text-green-600">${stats.revenue.total}</p>
                <p className="text-sm text-gray-500 mt-1">{stats.revenue.transactions} transactions</p>
              </div>
              <div className="card">
                <h3 className="text-sm text-gray-600 mb-2">Credits Sold</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.credits.totalPurchased.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">Lifetime</p>
              </div>
              <div className="card">
                <h3 className="text-sm text-gray-600 mb-2">Active Users (30d)</h3>
                <p className="text-3xl font-bold text-purple-600">{stats.users.active30Days}</p>
                <p className="text-sm text-gray-500 mt-1">Last 30 days</p>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-bold mb-4">Revenue Breakdown</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-700">Credits Purchased</span>
                  <span className="font-bold">{stats.credits.totalPurchased} (${ (stats.credits.totalPurchased * 0.10).toFixed(2)})</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-700">Credits Used (AI)</span>
                  <span className="font-bold">{stats.credits.totalUsed}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-gray-700">Average per Transaction</span>
                  <span className="font-bold">
                    ${stats.revenue.transactions > 0
                      ? (parseFloat(stats.revenue.total) / stats.revenue.transactions).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
