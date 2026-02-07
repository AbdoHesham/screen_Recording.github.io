'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  credits_balance: number;
  plan_id: string | null;
  created_at: string;
  last_login: string | null;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
}

export default function AdminUserPlansPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Fetch users
      const usersRes = await fetch('http://localhost:3001/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (usersRes.status === 403) {
        router.push('/dashboard');
        return;
      }

      const usersData = await usersRes.json();

      // Fetch plans
      const plansRes = await fetch('http://localhost:3001/api/admin/plans', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const plansData = await plansRes.json();

      setUsers(usersData.users || []);
      setPlans(plansData.plans || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleEditPlan = (userId: string, currentPlanId: string | null) => {
    setEditingUserId(userId);
    setSelectedPlanId(currentPlanId || '');
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setSelectedPlanId('');
  };

  const handleSavePlan = async (userId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/admin/plans/users/${userId}/plan`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_id: selectedPlanId || null }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user plan');
      }

      showNotification('User plan updated successfully', 'success');
      setEditingUserId(null);
      setSelectedPlanId('');
      fetchData();
    } catch (error) {
      console.error('Error updating user plan:', error);
      showNotification('Failed to update user plan', 'error');
    }
  };

  const getPlanName = (planId: string | null) => {
    if (!planId) return 'No Plan';
    const plan = plans.find(p => p.id === planId);
    return plan ? plan.name : 'Unknown';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-text-primary">User Plan Management</h1>
              <p className="mt-1 text-sm text-text-secondary">Assign and manage subscription plans for users</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-surface-lighter transition-colors"
            >
              Back to Admin
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-surface rounded-lg shadow-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-lighter">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Credits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Current Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-lighter transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-text-primary">
                        {user.full_name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-secondary">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {user.credits_balance}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === user.id ? (
                        <select
                          value={selectedPlanId}
                          onChange={(e) => setSelectedPlanId(e.target.value)}
                          className="px-3 py-1 text-sm bg-background border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">No Plan</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} - ${plan.price_monthly}/mo
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-sm text-text-primary font-medium">
                          {getPlanName(user.plan_id)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {formatDate(user.last_login)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {editingUserId === user.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSavePlan(user.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditPlan(user.id, user.plan_id)}
                          className="text-primary hover:text-primary-dark"
                        >
                          Change Plan
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-12">
              <p className="text-text-secondary">No users found</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface rounded-lg shadow border border-border p-6">
            <div className="text-sm text-text-secondary">Total Users</div>
            <div className="mt-2 text-3xl font-bold text-text-primary">{users.length}</div>
          </div>
          <div className="bg-surface rounded-lg shadow border border-border p-6">
            <div className="text-sm text-text-secondary">Users with Plans</div>
            <div className="mt-2 text-3xl font-bold text-text-primary">
              {users.filter(u => u.plan_id).length}
            </div>
          </div>
          <div className="bg-surface rounded-lg shadow border border-border p-6">
            <div className="text-sm text-text-secondary">Admin Users</div>
            <div className="mt-2 text-3xl font-bold text-text-primary">
              {users.filter(u => u.role === 'admin').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
