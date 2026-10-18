import { useState, useEffect } from 'preact/hooks';
import { adminApi, SystemMessage, MessageCategory, TargetAudience, MessagePriority } from '../api/admin.api';
import { useAuthContext } from '../context/AuthContext';
import './InboxPage.css';

const InboxPage = () => {
  const { user: admin } = useAuthContext();
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Filters
  const [filterCategory, setFilterCategory] = useState<MessageCategory | ''>('');
  const [filterAudience, setFilterAudience] = useState<TargetAudience | ''>('');
  
  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState<SystemMessage | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'announcement' as MessageCategory,
    targetAudience: 'all' as TargetAudience,
    priority: 'normal' as MessagePriority
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState<SystemMessage | null>(null);

  useEffect(() => {
    loadMessages();
  }, [filterCategory, filterAudience]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await adminApi.getSystemMessages({
        category: filterCategory || undefined,
        targetAudience: filterAudience || undefined,
        limit: 100
      });
      setMessages(Array.isArray(result.messages) ? result.messages : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingMessage(null);
    setFormData({
      title: '',
      content: '',
      category: 'announcement',
      targetAudience: 'all',
      priority: 'normal'
    });
    setShowModal(true);
  };

  const openEditModal = (message: SystemMessage) => {
    setEditingMessage(message);
    setFormData({
      title: message.title,
      content: message.content,
      category: message.category,
      targetAudience: message.targetAudience,
      priority: message.priority
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingMessage(null);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;

    try {
      setSubmitting(true);
      
      if (editingMessage) {
        await adminApi.updateSystemMessage(editingMessage.id, formData);
        setSuccessMessage('Message updated successfully');
      } else {
        await adminApi.createSystemMessage({
          ...formData,
          createdBy: admin?.userId || 'admin'
        });
        setSuccessMessage('Message sent successfully');
      }
      
      closeModal();
      loadMessages();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to save message');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteModal = (message: SystemMessage) => {
    setDeletingMessage(message);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deletingMessage) return;

    try {
      await adminApi.deleteSystemMessage(deletingMessage.id);
      setSuccessMessage('Message deleted successfully');
      setShowDeleteModal(false);
      setDeletingMessage(null);
      loadMessages();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete message');
    }
  };

  const getCategoryIcon = (category: MessageCategory) => {
    switch (category) {
      case 'announcement': return 'fas fa-bullhorn';
      case 'update': return 'fas fa-sync-alt';
      case 'alert': return 'fas fa-exclamation-triangle';
      case 'news': return 'fas fa-newspaper';
      case 'promotion': return 'fas fa-gift';
      default: return 'fas fa-envelope';
    }
  };

  const getAudienceLabel = (audience: TargetAudience) => {
    switch (audience) {
      case 'all': return 'All Users';
      case 'students': return 'Students Only';
      case 'tutors': return 'Tutors Only';
    }
  };

  const getPriorityClass = (priority: MessagePriority) => {
    switch (priority) {
      case 'urgent': return 'priority-urgent';
      case 'high': return 'priority-high';
      case 'normal': return 'priority-normal';
      case 'low': return 'priority-low';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="inbox-page">
      <div className="inbox-header">
        <div className="header-left">
          <h1>System Messages</h1>
          <p>Send announcements and updates to students and tutors</p>
        </div>
        <button className="create-btn" onClick={openCreateModal}>
          <i className="fas fa-plus"></i>
          New Message
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <i className="fas fa-exclamation-circle"></i>
          {error}
          <button onClick={() => setError('')}>&times;</button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <i className="fas fa-check-circle"></i>
          {successMessage}
        </div>
      )}

      <div className="filters-bar">
        <div className="filter-group">
          <label>Category:</label>
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory((e.target as HTMLSelectElement).value as MessageCategory | '')}
          >
            <option value="">All Categories</option>
            <option value="announcement">Announcements</option>
            <option value="update">Updates</option>
            <option value="alert">Alerts</option>
            <option value="news">News</option>
            <option value="promotion">Promotions</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Audience:</label>
          <select 
            value={filterAudience} 
            onChange={(e) => setFilterAudience((e.target as HTMLSelectElement).value as TargetAudience | '')}
          >
            <option value="">All Audiences</option>
            <option value="all">All Users</option>
            <option value="students">Students Only</option>
            <option value="tutors">Tutors Only</option>
          </select>
        </div>

        <button className="refresh-btn" onClick={loadMessages} disabled={loading}>
          <i className={`fas fa-sync-alt ${loading ? 'spin' : ''}`}></i>
          Refresh
        </button>
      </div>

      <div className="messages-list">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-inbox"></i>
            <h3>No messages yet</h3>
            <p>Create your first system message to reach students and tutors</p>
            <button onClick={openCreateModal}>
              <i className="fas fa-plus"></i>
              Create Message
            </button>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message-card ${getPriorityClass(message.priority)}`}>
              <div className="message-icon">
                <i className={getCategoryIcon(message.category)}></i>
              </div>
              <div className="message-content">
                <div className="message-header">
                  <h3>{message.title}</h3>
                  <div className="message-badges">
                    <span className={`badge badge-category badge-${message.category}`}>
                      {message.category}
                    </span>
                    <span className={`badge badge-audience badge-${message.targetAudience}`}>
                      {getAudienceLabel(message.targetAudience)}
                    </span>
                    <span className={`badge badge-priority ${getPriorityClass(message.priority)}`}>
                      {message.priority}
                    </span>
                  </div>
                </div>
                <p className="message-text">{message.content}</p>
                <div className="message-footer">
                  <span className="message-date">
                    <i className="fas fa-clock"></i>
                    {formatDate(message.createdAt)}
                  </span>
                </div>
              </div>
              <div className="message-actions">
                <button className="action-btn edit-btn" onClick={() => openEditModal(message)} title="Edit">
                  <i className="fas fa-edit"></i>
                </button>
                <button className="action-btn delete-btn" onClick={() => openDeleteModal(message)} title="Delete">
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className={editingMessage ? 'fas fa-edit' : 'fas fa-plus-circle'}></i>
                {editingMessage ? 'Edit Message' : 'Create New Message'}
              </h2>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </div>
            <div className="modal-content-wrapper">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onInput={(e) => setFormData({ ...formData, title: (e.target as HTMLInputElement).value })}
                    placeholder="Enter message title"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Content *</label>
                  <textarea
                    value={formData.content}
                    onInput={(e) => setFormData({ ...formData, content: (e.target as HTMLTextAreaElement).value })}
                    placeholder="Enter your message content..."
                    rows={5}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: (e.target as HTMLSelectElement).value as MessageCategory })}
                    >
                      <option value="announcement">📢 Announcement</option>
                      <option value="update">🔄 Update</option>
                      <option value="alert">⚠️ Alert</option>
                      <option value="news">📰 News</option>
                      <option value="promotion">🎁 Promotion</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Target Audience *</label>
                    <select
                      value={formData.targetAudience}
                      onChange={(e) => setFormData({ ...formData, targetAudience: (e.target as HTMLSelectElement).value as TargetAudience })}
                    >
                      <option value="all">👥 All Users</option>
                      <option value="students">🎓 Students Only</option>
                      <option value="tutors">👨‍🏫 Tutors Only</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: (e.target as HTMLSelectElement).value as MessagePriority })}
                  >
                    <option value="low">🔵 Low</option>
                    <option value="normal">🟢 Normal</option>
                    <option value="high">🟠 High</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
              </div>

              <div className="audience-preview">
                <i className="fas fa-info-circle"></i>
                This message will be sent to: <strong>{getAudienceLabel(formData.targetAudience)}</strong>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="spinner-small"></span>
                      {editingMessage ? 'Updating...' : 'Sending...'}
                    </>
                  ) : (
                    <>
                      <i className={editingMessage ? 'fas fa-save' : 'fas fa-paper-plane'}></i>
                      {editingMessage ? 'Update Message' : 'Send Message'}
                    </>
                  )}
                </button>
              </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingMessage && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header delete-header">
              <h2>
                <i className="fas fa-trash-alt"></i>
                Delete Message
              </h2>
              <button className="close-btn" onClick={() => setShowDeleteModal(false)}>&times;</button>
            </div>
            <div className="modal-content-wrapper">
              <div className="modal-body">
                <p>Are you sure you want to delete this message?</p>
                <p className="message-preview">"{deletingMessage.title}"</p>
                <p className="warning-text">This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </button>
                <button className="delete-confirm-btn" onClick={handleDelete}>
                  <i className="fas fa-trash"></i>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxPage;
