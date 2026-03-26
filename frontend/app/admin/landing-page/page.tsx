'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface LandingPageContent {
  id: string;
  section_key: string;
  content_type: string;
  content_value: string;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
}

interface CreateContentData {
  section_key: string;
  content_type: string;
  content_value: string;
  is_active: boolean;
}

// Sortable Row Component
function SortableRow({ content, onEdit, onDelete, onToggleActive, onPreview }: {
  content: LandingPageContent;
  onEdit: (content: LandingPageContent) => void;
  onDelete: (id: string) => void;
  onToggleActive: (content: LandingPageContent) => void;
  onPreview: (content: LandingPageContent) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: content.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors ${
        isDragging ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Drag to reorder"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {content.section_key}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
          {content.content_type}
        </span>
      </td>
      <td className="px-6 py-4">
        {content.content_type === 'image' ? (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
              {content.content_value ? (
                <img
                  src={content.content_value}
                  alt={content.section_key}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full" />
              )}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 max-w-sm truncate">
              {content.content_value || 'No image URL'}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-600 dark:text-gray-300 max-w-md truncate">
            {content.content_value}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <button
          onClick={() => onToggleActive(content)}
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer ${
            content.is_active
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {content.is_active ? 'Active' : 'Inactive'}
        </button>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
        {new Date(content.updated_at).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
        <button
          onClick={() => onPreview(content)}
          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
        >
          Preview
        </button>
        <button
          onClick={() => onEdit(content)}
          className="text-primary hover:text-primary-dark"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(content.id)}
          className="text-red-600 hover:text-red-900"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

export default function AdminLandingPagePage() {
  const router = useRouter();
  const [contents, setContents] = useState<LandingPageContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingContent, setEditingContent] = useState<LandingPageContent | null>(null);
  const [formData, setFormData] = useState<CreateContentData>({
    section_key: '',
    content_type: 'text',
    content_value: '',
    is_active: true,
  });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [previewContent, setPreviewContent] = useState<LandingPageContent | null>(null);
  const isImageType = formData.content_type === 'image';
  const isHtmlType = formData.content_type === 'html';
  const isJsonType = formData.content_type === 'json';
  const isMarkdownType = formData.content_type === 'markdown';

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchContents();
  }, []);

  const fetchContents = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:3001/api/admin/landing-page', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 403) {
        router.push('/dashboard');
        return;
      }

      const data = await response.json();
      setContents(data.content || []);
    } catch (error) {
      console.error('Error fetching landing page content:', error);
      showNotification('Failed to load landing page content', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleOpenModal = (content?: LandingPageContent) => {
    console.log('handleOpenModal called with:', content);
    if (content) {
      console.log('Opening edit modal for:', content.section_key);
      setEditingContent(content);
      const newFormData = {
        section_key: content.section_key,
        content_type: content.content_type,
        content_value: content.content_value,
        is_active: content.is_active,
      };
      console.log('Setting form data to:', newFormData);
      setFormData(newFormData);
    } else {
      console.log('Opening create modal');
      setEditingContent(null);
      setFormData({
        section_key: '',
        content_type: 'text',
        content_value: '',
        is_active: true,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingContent(null);
    setFormData({
      section_key: '',
      content_type: 'text',
      content_value: '',
      is_active: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('Form submitted with data:', formData);
    console.log('Editing content:', editingContent);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const url = editingContent
        ? `http://localhost:3001/api/admin/landing-page/${editingContent.id}`
        : 'http://localhost:3001/api/admin/landing-page';

      const method = editingContent ? 'PUT' : 'POST';
      const bodyData = editingContent
        ? { content_value: formData.content_value, is_active: formData.is_active }
        : formData;

      console.log('Sending request:', { method, url, bodyData });

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(bodyData),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error('Server error:', error);
        throw new Error(error.error || 'Failed to save content');
      }

      const result = await response.json();
      console.log('Success result:', result);

      showNotification(
        editingContent ? 'Content updated successfully' : 'Content created successfully',
        'success'
      );
      handleCloseModal();
      await fetchContents();
    } catch (error: any) {
      console.error('Error saving content:', error);
      showNotification(error.message || 'Failed to save content', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this content?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/admin/landing-page/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete content');
      }

      showNotification('Content deleted successfully', 'success');
      fetchContents();
    } catch (error) {
      console.error('Error deleting content:', error);
      showNotification('Failed to delete content', 'error');
    }
  };

  const handleToggleActive = async (content: LandingPageContent) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/admin/landing-page/${content.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !content.is_active }),
      });

      if (!response.ok) {
        throw new Error('Failed to update content');
      }

      showNotification('Content status updated', 'success');
      fetchContents();
    } catch (error) {
      console.error('Error toggling content status:', error);
      showNotification('Failed to update content status', 'error');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = contents.findIndex((item) => item.id === active.id);
    const newIndex = contents.findIndex((item) => item.id === over.id);

    const newContents = arrayMove(contents, oldIndex, newIndex);
    setContents(newContents);

    // Update sort_order on backend
    try {
      const token = localStorage.getItem('token');
      const items = newContents.map((item, index) => ({
        id: item.id,
        sort_order: (index + 1) * 10,
      }));

      const response = await fetch('http://localhost:3001/api/admin/landing-page/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        throw new Error('Failed to update sort order');
      }

      showNotification('Content reordered successfully', 'success');
    } catch (error) {
      console.error('Error updating sort order:', error);
      showNotification('Failed to update sort order', 'error');
      // Revert on error
      fetchContents();
    }
  };

  const handlePreview = (content: LandingPageContent) => {
    setPreviewContent(content);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading landing page content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Landing Page Content</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage content displayed on the landing page</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleOpenModal()}
                className="btn btn-primary text-sm px-4 py-2"
              >
                Add New Content
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm px-4 py-2"
              >
                Back to Admin
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Section Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Content Preview
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                <SortableContext
                  items={contents.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {contents.map((content) => (
                    <SortableRow
                      key={content.id}
                      content={content}
                      onEdit={handleOpenModal}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                      onPreview={handlePreview}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>

          {contents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">No content sections found</p>
              <button
                onClick={() => handleOpenModal()}
                className="mt-4 text-primary hover:text-primary-dark"
              >
                Add your first content section
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCloseModal}></div>
          <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <form onSubmit={handleSubmit}>
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
                  <h3 className="text-xl font-bold text-white">
                    {editingContent ? 'Edit Content Section' : 'Add New Content Section'}
                  </h3>
                  <p className="text-sm text-white/90 mt-1">
                    Customize what appears on your landing page
                  </p>
                </div>

                <div className="px-6 py-6 space-y-5">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Tip: Use the Image type to add an image URL. For custom layouts, use HTML or Markdown.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      Section Key *
                    </label>
                    <input
                      type="text"
                      value={formData.section_key}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        console.log('section_key changed to:', newValue);
                        setFormData(prev => ({ ...prev, section_key: newValue }));
                      }}
                      disabled={!!editingContent}
                      className="input"
                      placeholder="e.g., hero_title, logo_url, feature_1_image"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Unique identifier for this content section
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      Content Type *
                    </label>
                    <select
                      value={formData.content_type}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        console.log('content_type changed to:', newValue);
                        setFormData(prev => ({ ...prev, content_type: newValue }));
                      }}
                      disabled={!!editingContent}
                      className="input"
                    >
                      <option value="text">Text</option>
                      <option value="image">Image (URL)</option>
                      <option value="html">HTML</option>
                      <option value="json">JSON</option>
                      <option value="markdown">Markdown</option>
                    </select>
                  </div>

                  {isImageType ? (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Image URL *
                      </label>
                      <input
                        type="url"
                        value={formData.content_value}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          console.log('Image URL changed to:', newValue);
                          setFormData(prev => ({ ...prev, content_value: newValue }));
                        }}
                        className="input"
                        placeholder="https://example.com/image.png"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Paste a public image URL that starts with http:// or https://
                      </p>
                      {formData.content_value && (
                        <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900">
                          <img
                            src={formData.content_value}
                            alt="Preview"
                            className="h-40 w-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Content Value *
                      </label>
                      <textarea
                        value={formData.content_value}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          console.log('Textarea changed to:', newValue);
                          setFormData(prev => ({ ...prev, content_value: newValue }));
                        }}
                        className="input font-mono text-sm"
                        placeholder={
                          isHtmlType
                            ? '<div class="...">Your HTML here</div>'
                            : isJsonType
                            ? '{"key": "value"}'
                            : isMarkdownType
                            ? '# Your markdown here'
                            : 'Enter text content here...'
                        }
                        rows={6}
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {isHtmlType && 'Enter valid HTML markup.'}
                        {isJsonType && 'Enter valid JSON format.'}
                        {isMarkdownType && 'Use markdown syntax for formatting.'}
                        {!isHtmlType && !isJsonType && !isMarkdownType && 'Plain text content.'}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        console.log('is_active changed to:', newValue);
                        setFormData(prev => ({ ...prev, is_active: newValue }));
                      }}
                      className="h-5 w-5 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                    />
                    <label htmlFor="is_active" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer">
                      Active (visible on landing page)
                    </label>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/60 px-6 py-4 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="submit"
                    className="btn btn-primary w-full sm:w-auto text-sm px-5 py-2"
                  >
                    {editingContent ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 w-full sm:w-auto text-sm px-5 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewContent(null)}
          ></div>
          <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Content Preview</h3>
                  <p className="text-sm text-white/90 mt-1">
                    {previewContent.section_key} ({previewContent.content_type})
                  </p>
                </div>
                <button
                  onClick={() => setPreviewContent(null)}
                  className="text-white/90 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
                <div className="mb-4 flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    previewContent.is_active
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {previewContent.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Last updated: {new Date(previewContent.updated_at).toLocaleString()}
                  </span>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  {previewContent.content_type === 'image' ? (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600 dark:text-gray-400 break-all mb-3">
                        URL: {previewContent.content_value}
                      </div>
                      {previewContent.content_value && (
                        <div className="rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                          <img
                            src={previewContent.content_value}
                            alt={previewContent.section_key}
                            className="w-full h-auto max-h-96 object-contain bg-white dark:bg-gray-800"
                          />
                        </div>
                      )}
                    </div>
                  ) : previewContent.content_type === 'html' ? (
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Rendered HTML:
                      </div>
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: previewContent.content_value }}
                      />
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Raw HTML:
                        </div>
                        <pre className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                          <code>{previewContent.content_value}</code>
                        </pre>
                      </div>
                    </div>
                  ) : previewContent.content_type === 'json' ? (
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Formatted JSON:
                      </div>
                      <pre className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{JSON.stringify(JSON.parse(previewContent.content_value), null, 2)}</code>
                      </pre>
                    </div>
                  ) : previewContent.content_type === 'markdown' ? (
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Raw Markdown:
                      </div>
                      <pre className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap">
                        <code>{previewContent.content_value}</code>
                      </pre>
                    </div>
                  ) : (
                    <div className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {previewContent.content_value}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/60 px-6 py-4 flex justify-end">
                <button
                  onClick={() => setPreviewContent(null)}
                  className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm px-5 py-2"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

