/**
 * DiscussionQuestionsEditorPage
 * Lesson manager for Discussion Questions course
 * 5 Levels → 10 Topics per level → 20 questions per topic
 */
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import {
  createLesson,
  listLessonsByCourse,
  getExistingChapterName,
  checkDuplicate,
  deleteLesson,
  duplicateLesson,
  publishLesson,
  unpublishLesson,
  type LessonMaterial,
  type CreateLessonInput,
} from '../api/lessonMaterial.api';
import { toast } from '../Components/Toast/Toast';
import './ConversationalSkillsEditorPage.css'; // Reuse existing styles

// ============================================================================
// CONSTANTS
// ============================================================================

const COURSE_ID = 'discussion-questions';
const LEVELS = [1, 2, 3, 4, 5];
const TOPICS_PER_LEVEL = Array.from({ length: 10 }, (_, i) => i + 1);

const LEVEL_BADGES: Record<number, string> = {
  1: 'STARTER',
  2: 'BEGINNER',
  3: 'ELEMENTARY',
  4: 'INTERMEDIATE',
  5: 'ADVANCED',
};

const LEVEL_COLORS: Record<number, string> = {
  1: '#10b981', // Green
  2: '#3b82f6', // Blue
  3: '#8b5cf6', // Purple
  4: '#f59e0b', // Amber
  5: '#ef4444', // Red
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DiscussionQuestionsEditorPage() {
  const [lessons, setLessons] = useState<LessonMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set());
  const [selectedLesson, setSelectedLesson] = useState<LessonMaterial | null>(null);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      setLoading(true);
      const data = await listLessonsByCourse(COURSE_ID);
      setLessons(data);
    } catch (error) {
      console.error('Failed to load lessons:', error);
      toast.error('Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  // Group lessons by level
  const lessonsByLevel = useMemo(() => {
    const map: Record<number, LessonMaterial[]> = {};
    lessons.forEach(lesson => {
      if (!map[lesson.level]) map[lesson.level] = [];
      map[lesson.level].push(lesson);
    });
    Object.keys(map).forEach(key => {
      map[parseInt(key)].sort((a, b) => a.lessonNumber - b.lessonNumber);
    });
    return map;
  }, [lessons]);

  const getLevelLessonCount = (level: number): number => {
    return lessonsByLevel[level]?.length || 0;
  };

  const toggleLevel = (level: number) => {
    setExpandedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const handleCreateLesson = async (input: CreateLessonInput) => {
    try {
      const lesson = await createLesson(input);
      setLessons([...lessons, lesson]);
      setShowCreateModal(false);
      setExpandedLevels(prev => new Set([...prev, lesson.level]));
      toast.success('Topic created successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create topic');
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('Are you sure you want to delete this topic?')) return;
    try {
      await deleteLesson(id);
      setLessons(lessons.filter(l => l.id !== id));
      toast.success('Topic deleted');
    } catch (error) {
      toast.error('Failed to delete topic');
    }
  };

  const handleDuplicateLesson = async (lesson: LessonMaterial) => {
    try {
      const duplicated = await duplicateLesson(lesson.id);
      setLessons([...lessons, duplicated]);
      setExpandedLevels(prev => new Set([...prev, duplicated.level]));
      toast.success('Topic duplicated!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to duplicate topic');
    }
  };

  const handleEditLesson = (lesson: LessonMaterial) => {
    window.open(`/discussion-questions-visual-editor/${lesson.id}`, '_blank');
  };

  const handlePublishLesson = async (lesson: LessonMaterial) => {
    try {
      const updated = await publishLesson(lesson.id);
      setLessons(lessons.map(l => l.id === lesson.id ? updated : l));
      if (selectedLesson?.id === lesson.id) setSelectedLesson(updated);
      toast.success('Topic published!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to publish');
    }
  };

  const handleUnpublishLesson = async (lesson: LessonMaterial) => {
    try {
      const updated = await unpublishLesson(lesson.id);
      setLessons(lessons.map(l => l.id === lesson.id ? updated : l));
      if (selectedLesson?.id === lesson.id) setSelectedLesson(updated);
      toast.success('Topic unpublished.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to unpublish');
    }
  };

  const handleSelectLesson = (lesson: LessonMaterial) => {
    setSelectedLesson(prev => prev?.id === lesson.id ? null : lesson);
  };

  const courseStats = useMemo(() => {
    const totalLessons = lessons.length;
    const totalCapacity = 5 * 10; // 5 levels × 10 topics
    return {
      totalLessons,
      totalCapacity,
      progressPercent: Math.round((totalLessons / totalCapacity) * 100),
    };
  }, [lessons]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="cse-page">
      {/* Header */}
      <div className="cse-header">
        <div className="cse-header-content">
          <div className="cse-title-row">
            <div className="cse-title-icon">
              <i className="ri-question-answer-line" />
            </div>
            <div>
              <h1>Discussion Questions</h1>
              <p>{lessons.length} topics across 5 levels</p>
            </div>
          </div>
          <button className="cse-create-btn" onClick={() => setShowCreateModal(true)}>
            <i className="ri-add-line" />
            Create Topic
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="cse-main-layout">
        {/* Left: Accordion */}
        <div className="cse-accordion-container">
          <div className="cse-accordion">
            {loading ? (
              <div className="cse-loading">
                <i className="ri-loader-4-line" />
                Loading topics...
              </div>
            ) : (
              LEVELS.map(level => (
                <div className="cse-level" key={level}>
                  <button
                    className={`cse-level-header ${expandedLevels.has(level) ? 'expanded' : ''}`}
                    onClick={() => toggleLevel(level)}
                    style={{ '--level-color': LEVEL_COLORS[level] } as any}
                  >
                    <div className="cse-level-info">
                      <i className={`ri-arrow-${expandedLevels.has(level) ? 'down' : 'right'}-s-line`} />
                      <span className="cse-level-badge" style={{ backgroundColor: LEVEL_COLORS[level] }}>
                        {LEVEL_BADGES[level]}
                      </span>
                      <span className="cse-level-name">Level {level}</span>
                    </div>
                    <span className="cse-level-count">
                      {getLevelLessonCount(level)} topic{getLevelLessonCount(level) !== 1 ? 's' : ''}
                    </span>
                  </button>

                  {expandedLevels.has(level) && (
                    <div className="cse-lessons-list" style={{ paddingLeft: '12px' }}>
                      {(lessonsByLevel[level] || []).length > 0 ? (
                        (lessonsByLevel[level] || []).map(lesson => (
                          <div
                            className={`cse-lesson-row ${selectedLesson?.id === lesson.id ? 'selected' : ''} ${lesson.status === 'published' ? 'published' : ''}`}
                            key={lesson.id}
                            onClick={() => handleSelectLesson(lesson)}
                          >
                            <div className="cse-lesson-main">
                              <span className="cse-lesson-number">#{lesson.lessonNumber}</span>
                              <span className="cse-lesson-title">{lesson.lessonTitle}</span>
                              {lesson.status === 'published' && (
                                <span className="cse-published-badge">Published</span>
                              )}
                            </div>
                            <div className="cse-lesson-actions">
                              {lesson.status === 'draft' ? (
                                <button
                                  className="cse-action-btn cse-action-publish"
                                  onClick={(e) => { e.stopPropagation(); handlePublishLesson(lesson); }}
                                  title="Publish"
                                >
                                  <i className="ri-upload-cloud-line" />
                                </button>
                              ) : (
                                <button
                                  className="cse-action-btn cse-action-unpublish"
                                  onClick={(e) => { e.stopPropagation(); handleUnpublishLesson(lesson); }}
                                  title="Unpublish"
                                >
                                  <i className="ri-download-cloud-line" />
                                </button>
                              )}
                              <button
                                className="cse-action-btn"
                                onClick={(e) => { e.stopPropagation(); handleEditLesson(lesson); }}
                                title="Edit"
                              >
                                <i className="ri-edit-line" />
                              </button>
                              <button
                                className="cse-action-btn"
                                onClick={(e) => { e.stopPropagation(); handleDuplicateLesson(lesson); }}
                                title="Duplicate"
                              >
                                <i className="ri-file-copy-line" />
                              </button>
                              <button
                                className="cse-action-btn cse-action-delete"
                                onClick={(e) => { e.stopPropagation(); handleDeleteLesson(lesson.id); }}
                                title="Delete"
                              >
                                <i className="ri-delete-bin-line" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="cse-empty-chapter">
                          <span>No topics yet</span>
                          <button
                            className="cse-add-lesson-btn"
                            onClick={() => setShowCreateModal(true)}
                          >
                            <i className="ri-add-line" /> Add
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Selected Lesson Details or Stats */}
        <div className="cse-detail-panel">
          {selectedLesson ? (
            <LessonDetail
              lesson={selectedLesson}
              onEdit={handleEditLesson}
              onDelete={handleDeleteLesson}
              onDuplicate={handleDuplicateLesson}
              onPublish={handlePublishLesson}
              onUnpublish={handleUnpublishLesson}
            />
          ) : (
            <div className="cse-analytics">
              <div className="cse-analytics-header">
                <i className="ri-bar-chart-box-line" />
                <h3>Course Overview</h3>
              </div>
              <div className="cse-stat-cards">
                <div className="cse-stat-card">
                  <div className="cse-stat-value">{courseStats.totalLessons}</div>
                  <div className="cse-stat-label">Total Topics</div>
                </div>
                <div className="cse-stat-card">
                  <div className="cse-stat-value">{courseStats.totalCapacity}</div>
                  <div className="cse-stat-label">Capacity</div>
                </div>
                <div className="cse-stat-card">
                  <div className="cse-stat-value">{courseStats.progressPercent}%</div>
                  <div className="cse-stat-label">Complete</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTopicModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateLesson}
        />
      )}
    </div>
  );
}

// ============================================================================
// CREATE TOPIC MODAL
// ============================================================================

function CreateTopicModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: CreateLessonInput) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [form, setForm] = useState({
    level: 1,
    lessonNumber: 1,
    lessonName: '',
  });

  // Check duplicates when level/lessonNumber changes
  useEffect(() => {
    const check = async () => {
      try {
        const exists = await checkDuplicate(COURSE_ID, form.level, 1, form.lessonNumber, 'speaking');
        setDuplicateWarning(exists ? `Topic ${form.lessonNumber} already exists at Level ${form.level}` : '');
      } catch {
        setDuplicateWarning('');
      }
    };
    check();
  }, [form.level, form.lessonNumber]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!form.lessonName.trim()) {
      toast.error('Please enter a topic name');
      return;
    }
    setLoading(true);
    try {
      await onCreate({
        course: COURSE_ID,
        level: form.level,
        chapter: 1, // Discussion Questions don't use chapters
        chapterName: `Level ${form.level}`,
        lessonNumber: form.lessonNumber,
        lessonName: form.lessonName,
        skill: 'speaking', // Default skill for discussion
        goalTextEn: '',
        goalTextJp: '',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cse-modal-overlay" onClick={onClose}>
      <div className="cse-modal" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="cse-modal-header">
            <h2>Create Discussion Topic</h2>
            <button type="button" className="cse-modal-close" onClick={onClose}>
              <i className="ri-close-line" />
            </button>
          </div>

          <div className="cse-modal-body">
            <div className="cse-form-grid">
              <div className="cse-form-field">
                <label>Level</label>
                <select
                  value={form.level}
                  onChange={e => setForm({ ...form, level: parseInt((e.target as HTMLSelectElement).value) })}
                >
                  {LEVELS.map(l => (
                    <option key={l} value={l}>Level {l} ({LEVEL_BADGES[l]})</option>
                  ))}
                </select>
              </div>
              <div className="cse-form-field">
                <label>Topic Number</label>
                <select
                  value={form.lessonNumber}
                  onChange={e => setForm({ ...form, lessonNumber: parseInt((e.target as HTMLSelectElement).value) })}
                >
                  {TOPICS_PER_LEVEL.map(t => (
                    <option key={t} value={t}>Topic {t}</option>
                  ))}
                </select>
              </div>
            </div>

            {duplicateWarning && (
              <div className="cse-warning">
                <i className="ri-error-warning-line" />
                {duplicateWarning}
              </div>
            )}

            <div className="cse-form-field">
              <label>Topic Name</label>
              <input
                type="text"
                value={form.lessonName}
                onChange={e => setForm({ ...form, lessonName: (e.target as HTMLInputElement).value })}
                placeholder="e.g., Social Media, Travel, Food"
              />
            </div>

            <div className="cse-preview-labels">
              <p><strong>Level:</strong> {LEVEL_BADGES[form.level]} (Level {form.level})</p>
              <p><strong>Topic:</strong> #{form.lessonNumber}: {form.lessonName || '...'}</p>
            </div>
          </div>

          <div className="cse-modal-footer">
            <button type="button" className="cse-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="cse-btn-primary"
              disabled={loading || !!duplicateWarning}
            >
              {loading ? 'Creating...' : 'Create Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// LESSON DETAIL PANEL
// ============================================================================

function LessonDetail({
  lesson,
  onEdit,
  onDelete,
  onDuplicate,
  onPublish,
  onUnpublish,
}: {
  lesson: LessonMaterial;
  onEdit: (lesson: LessonMaterial) => void;
  onDelete: (id: string) => void;
  onDuplicate: (lesson: LessonMaterial) => void;
  onPublish: (lesson: LessonMaterial) => void;
  onUnpublish: (lesson: LessonMaterial) => void;
}) {
  return (
    <div className="cse-detail">
      <div className="cse-detail-header">
        <span className="cse-level-badge" style={{ backgroundColor: LEVEL_COLORS[lesson.level] || '#666' }}>
          {LEVEL_BADGES[lesson.level] || `LVL ${lesson.level}`}
        </span>
        <h2>#{lesson.lessonNumber}: {lesson.lessonTitle}</h2>
        <span className={`cse-status-badge ${lesson.status}`}>{lesson.status}</span>
      </div>

      <div className="cse-detail-meta">
        <div className="cse-meta-item">
          <i className="ri-folder-line" />
          <span>Level {lesson.level}</span>
        </div>
        <div className="cse-meta-item">
          <i className="ri-calendar-line" />
          <span>{new Date(lesson.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="cse-detail-actions">
        <button className="cse-btn-primary" onClick={() => onEdit(lesson)}>
          <i className="ri-edit-line" /> Edit Topic
        </button>
        {lesson.status === 'draft' ? (
          <button className="cse-btn-secondary" onClick={() => onPublish(lesson)}>
            <i className="ri-upload-cloud-line" /> Publish
          </button>
        ) : (
          <button className="cse-btn-secondary" onClick={() => onUnpublish(lesson)}>
            <i className="ri-download-cloud-line" /> Unpublish
          </button>
        )}
        <button className="cse-btn-secondary" onClick={() => onDuplicate(lesson)}>
          <i className="ri-file-copy-line" /> Duplicate
        </button>
        <button className="cse-btn-danger" onClick={() => onDelete(lesson.id)}>
          <i className="ri-delete-bin-line" /> Delete
        </button>
      </div>
    </div>
  );
}
