'use client';

import { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes, FaCog } from 'react-icons/fa';

interface Feature {
  id: string;
  name: string;
  feature_key: string;
  limit_value?: number | null;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  credits_included: number;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  features: Feature[];
}

interface AvailableFeature {
  id: string;
  name: string;
  feature_key: string;
}

export default function PlansManagementPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [allFeatures, setAllFeatures] = useState<AvailableFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [selectedPlanFeatures, setSelectedPlanFeatures] = useState<{feature_id: string; limit_value: number | null}[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    credits_included: 0,
    is_active: true,
    is_default: false,
    sort_order: 0,
  });

  useEffect(() => {
    loadPlans();
    loadFeatures();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/admin/plans', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFeatures = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/admin/plan-features', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAllFeatures(data.features || []);
      }
    } catch (error) {
      console.error('Failed to load features:', error);
    }
  };

  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingPlan
        ? `http://localhost:3001/api/admin/plans/${editingPlan.id}`
        : 'http://localhost:3001/api/admin/plans';

      const response = await fetch(url, {
        method: editingPlan ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadPlans();
        setShowPlanModal(false);
        setEditingPlan(null);
        setFormData({
          name: '',
          description: '',
          price_monthly: 0,
          price_yearly: 0,
          credits_included: 0,
          is_active: true,
          is_default: false,
          sort_order: 0,
        });
      }
    } catch (error) {
      console.error('Failed to save plan:', error);
    }
  };

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      credits_included: plan.credits_included,
      is_active: plan.is_active,
      is_default: plan.is_default,
      sort_order: plan.sort_order,
    });
    setShowPlanModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/admin/plans/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (response.ok) {
        await loadPlans();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete plan');
      }
    } catch (error) {
      console.error('Failed to delete plan:', error);
    }
  };

  const handleManageFeatures = (plan: Plan) => {
    setEditingPlan(plan);
    setSelectedPlanFeatures(plan.features.map(f => ({
      feature_id: f.id,
      limit_value: f.limit_value || null
    })));
    setShowFeaturesModal(true);
  };

  const handleToggleFeature = (featureId: string) => {
    const exists = selectedPlanFeatures.find(f => f.feature_id === featureId);
    if (exists) {
      setSelectedPlanFeatures(prev => prev.filter(f => f.feature_id !== featureId));
    } else {
      setSelectedPlanFeatures(prev => [...prev, { feature_id: featureId, limit_value: null }]);
    }
  };

  const handleUpdateLimit = (featureId: string, value: string) => {
    setSelectedPlanFeatures(prev =>
      prev.map(f => f.feature_id === featureId
        ? { ...f, limit_value: value === '' ? null : parseInt(value) }
        : f
      )
    );
  };

  const handleSaveFeatures = async () => {
    if (!editingPlan) return;

    try {
      const response = await fetch(`http://localhost:3001/api/admin/plans/${editingPlan.id}/features`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ features: selectedPlanFeatures }),
      });

      if (response.ok) {
        await loadPlans();
        setShowFeaturesModal(false);
        setEditingPlan(null);
      }
    } catch (error) {
      console.error('Failed to save features:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Plan Management</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage subscription plans and features</p>
          </div>
          <button
            onClick={() => {
              setEditingPlan(null);
              setFormData({
                name: '',
                description: '',
                price_monthly: 0,
                price_yearly: 0,
                credits_included: 0,
                is_active: true,
                is_default: false,
                sort_order: 0,
              });
              setShowPlanModal(true);
            }}
            className="btn btn-primary"
          >
            <FaPlus />
            Add Plan
          </button>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan.id} className="card relative">
              {plan.is_default && (
                <div className="absolute top-4 right-4">
                  <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                    Default
                  </span>
                </div>
              )}

              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{plan.name}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{plan.description}</p>

              <div className="mb-4">
                <div className="text-3xl font-bold text-primary mb-1">
                  ${Number(plan.price_monthly).toFixed(2)}
                  <span className="text-sm text-gray-500">/month</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  or ${Number(plan.price_yearly).toFixed(2)}/year
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {plan.credits_included} credits included
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  Status: {plan.is_active ? 'Active' : 'Inactive'} | Order: {plan.sort_order}
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Features ({plan.features.length}):
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {plan.features.map(f => (
                    <div key={f.id} className="text-xs text-gray-600 dark:text-gray-400">
                      ✓ {f.name} {f.limit_value && `(limit: ${f.limit_value})`}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleEditPlan(plan)}
                  className="flex-1 btn bg-blue-500 text-white hover:bg-blue-600 text-sm py-2"
                >
                  <FaEdit />
                  Edit
                </button>
                <button
                  onClick={() => handleManageFeatures(plan)}
                  className="flex-1 btn bg-purple-500 text-white hover:bg-purple-600 text-sm py-2"
                >
                  <FaCog />
                  Features
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
                  className="btn bg-red-500 text-white hover:bg-red-600 text-sm py-2"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Plan Edit Modal */}
        {showPlanModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
                {editingPlan ? 'Edit Plan' : 'Add Plan'}
              </h2>
              <form onSubmit={handleSubmitPlan}>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Plan Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input w-full"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Credits Included
                    </label>
                    <input
                      type="number"
                      value={formData.credits_included}
                      onChange={(e) => setFormData({ ...formData, credits_included: parseInt(e.target.value) || 0 })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Monthly Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price_monthly}
                      onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) || 0 })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Yearly Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price_yearly}
                      onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value) || 0 })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={formData.sort_order}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                      className="input w-full"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="input w-full"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="mr-2"
                    />
                    <label className="text-sm text-gray-700 dark:text-gray-300">Active</label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                      className="mr-2"
                    />
                    <label className="text-sm text-gray-700 dark:text-gray-300">Default Plan</label>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button type="submit" className="btn btn-primary flex-1">
                    <FaCheck />
                    {editingPlan ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPlanModal(false)}
                    className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 flex-1"
                  >
                    <FaTimes />
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Features Assignment Modal */}
        {showFeaturesModal && editingPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
                Manage Features for {editingPlan.name}
              </h2>

              <div className="space-y-3">
                {allFeatures.map((feature) => {
                  const isSelected = selectedPlanFeatures.find(f => f.feature_id === feature.id);
                  return (
                    <div key={feature.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={() => handleToggleFeature(feature.id)}
                        className="mr-2"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{feature.name}</div>
                        <div className="text-xs text-gray-500">{feature.feature_key}</div>
                      </div>
                      {isSelected && (
                        <div className="w-32">
                          <input
                            type="number"
                            placeholder="Limit (optional)"
                            value={isSelected.limit_value || ''}
                            onChange={(e) => handleUpdateLimit(feature.id, e.target.value)}
                            className="input w-full text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={handleSaveFeatures} className="btn btn-primary flex-1">
                  <FaCheck />
                  Save Features
                </button>
                <button
                  onClick={() => {
                    setShowFeaturesModal(false);
                    setEditingPlan(null);
                  }}
                  className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 flex-1"
                >
                  <FaTimes />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
