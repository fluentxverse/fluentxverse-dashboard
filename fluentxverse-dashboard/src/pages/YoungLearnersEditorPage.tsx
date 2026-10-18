/**
 * YoungLearnersEditorPage
 * No-code editor for creating Young Learners lesson materials
 * Hierarchical view: 5 Levels → 10 Units → 5 Lessons per unit
 * Similar structure to Conversational Skills Editor
 */
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { toast } from '../Components/Toast/Toast';
import * as youngLearnersApi from '../api/youngLearners.api';
import './YoungLearnersEditorPage.css';

// ============================================================================
// TYPES
// ============================================================================

export type AgeGroup = '3-5' | '6-8' | '9-12';
export type ActivityType = 'coloring' | 'matching' | 'tracing' | 'counting' | 'sorting' | 'singing' | 'story';
export type LessonTheme = 'animals' | 'colors' | 'numbers' | 'shapes' | 'family' | 'food' | 'weather' | 'body' | 'clothes' | 'nature';

export interface VocabularyWord {
  id: string;
  word: string;
  translation: string;
  image: string;
  audio?: string;
}

export interface SongLyric {
  id: string;
  line: string;
  translation?: string;
  timing?: number;
}

export interface StoryPage {
  id: string;
  image: string;
  text: string;
  translation?: string;
  audio?: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  instruction: string;
  instructionJp?: string;
  data: any;
}

export interface YoungLearnersLesson {
  id: string;
  course: string;
  level: number;
  unit: number;
  lessonNumber: number;
  theme: LessonTheme;
  ageGroup: AgeGroup;
  unitLabel: string;
  lessonTitle: string;
  mascot: string;
  backgroundColor: string;
  greeting: string;
  greetingJp?: string;
  
  vocabularyWords: VocabularyWord[];
  song: {
    title: string;
    audioUrl?: string;
    lyrics: SongLyric[];
  } | null;
  story: {
    title: string;
    pages: StoryPage[];
  } | null;
  activities: Activity[];
  
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'published';
}

export interface CreateYoungLearnersInput {
  level: number;
  unit: number;
  lessonNumber: number;
  theme: LessonTheme;
  ageGroup: AgeGroup;
  unitName: string;
  lessonName: string;
  mascot: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COURSE_ID = 'young-learners';
const LEVELS = Array.from({ length: 5 }, (_, i) => i + 1);
const UNITS = Array.from({ length: 10 }, (_, i) => i + 1);
const LESSONS = Array.from({ length: 5 }, (_, i) => i + 1);

const LEVEL_NAMES: Record<number, string> = {
  1: 'TINY TOTS',
  2: 'LITTLE STARS',
  3: 'RISING STARS',
  4: 'BRIGHT MINDS',
  5: 'SUPER KIDS',
};

const LEVEL_COLORS: Record<number, string> = {
  1: '#ec4899',
  2: '#f59e0b',
  3: '#10b981',
  4: '#3b82f6',
  5: '#8b5cf6',
};

const LEVEL_AGES: Record<number, string> = {
  1: '3-4 years',
  2: '4-5 years',
  3: '5-6 years',
  4: '7-8 years',
  5: '9-12 years',
};

const THEMES: { value: LessonTheme; label: string; icon: string }[] = [
  { value: 'animals', label: 'Animals', icon: '🐾' },
  { value: 'colors', label: 'Colors', icon: '🎨' },
  { value: 'numbers', label: 'Numbers', icon: '🔢' },
  { value: 'shapes', label: 'Shapes', icon: '⭐' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧' },
  { value: 'food', label: 'Food', icon: '🍎' },
  { value: 'weather', label: 'Weather', icon: '☀️' },
  { value: 'body', label: 'Body Parts', icon: '🖐️' },
  { value: 'clothes', label: 'Clothes', icon: '👕' },
  { value: 'nature', label: 'Nature', icon: '🌳' },
];

const MASCOTS: { value: string; label: string; emoji: string }[] = [
  { value: 'foxy', label: 'Foxy the Fox', emoji: '🦊' },
  { value: 'buddy', label: 'Buddy the Bear', emoji: '🐻' },
  { value: 'sunny', label: 'Sunny the Sun', emoji: '🌞' },
  { value: 'luna', label: 'Luna the Moon', emoji: '🌙' },
  { value: 'pippa', label: 'Pippa the Penguin', emoji: '🐧' },
  { value: 'ozzy', label: 'Ozzy the Owl', emoji: '🦉' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function YoungLearnersEditorPage() {
  const [lessons, setLessons] = useState<YoungLearnersLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set());
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [selectedLesson, setSelectedLesson] = useState<YoungLearnersLesson | null>(null);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      setLoading(true);
      const result = await youngLearnersApi.listLessons();
      if (result.success) {
        setLessons(result.lessons);
      } else {
        toast.error(result.error || 'Failed to load lessons');
      }
    } catch (error) {
      console.error('Failed to load lessons:', error);
      toast.error('Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  const lessonsByLevelUnit = useMemo(() => {
    const map: Record<string, YoungLearnersLesson[]> = {};
    lessons.forEach(lesson => {
      const key = `${lesson.level}-${lesson.unit}`;
      if (!map[key]) map[key] = [];
      map[key].push(lesson);
    });
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => a.lessonNumber - b.lessonNumber);
    });
    return map;
  }, [lessons]);

  const getUnitName = (level: number, unit: number): string => {
    const key = `${level}-${unit}`;
    const unitLessons = lessonsByLevelUnit[key];
    if (unitLessons && unitLessons.length > 0) {
      const match = unitLessons[0].unitLabel.match(/Unit \d+:\s*(.*)/);
      return match ? match[1] : '';
    }
    return '';
  };

  const getLevelLessonCount = (level: number): number => {
    return lessons.filter(l => l.level === level).length;
  };

  const getUnitLessonCount = (level: number, unit: number): number => {
    const key = `${level}-${unit}`;
    return lessonsByLevelUnit[key]?.length || 0;
  };

  const toggleLevel = (level: number) => {
    setExpandedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  const toggleUnit = (level: number, unit: number) => {
    const key = `${level}-${unit}`;
    setExpandedUnits(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleCreateLesson = async (input: CreateYoungLearnersInput) => {
    try {
      const result = await youngLearnersApi.createLesson(input);
      if (result.success && result.lesson) {
        setLessons([...lessons, result.lesson]);
        setShowCreateModal(false);
        setExpandedLevels(prev => new Set([...prev, result.lesson!.level]));
        setExpandedUnits(prev => new Set([...prev, `${result.lesson!.level}-${result.lesson!.unit}`]));
        toast.success('Lesson created successfully!');
      } else {
        toast.error(result.error || 'Failed to create lesson');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create lesson');
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return;
    
    try {
      const result = await youngLearnersApi.deleteLesson(id);
      if (result.success) {
        setLessons(lessons.filter(l => l.id !== id));
        if (selectedLesson?.id === id) {
          setSelectedLesson(null);
        }
        toast.success('Lesson deleted');
      } else {
        toast.error(result.error || 'Failed to delete lesson');
      }
    } catch (error) {
      toast.error('Failed to delete lesson');
    }
  };

  const handleDuplicateLesson = async (lesson: YoungLearnersLesson) => {
    try {
      const result = await youngLearnersApi.duplicateLesson(lesson.id);
      if (result.success && result.lesson) {
        setLessons([...lessons, result.lesson]);
        setExpandedLevels(prev => new Set([...prev, result.lesson!.level]));
        setExpandedUnits(prev => new Set([...prev, `${result.lesson!.level}-${result.lesson!.unit}`]));
        toast.success('Lesson duplicated!');
      } else {
        toast.error(result.error || 'Failed to duplicate lesson');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to duplicate lesson');
    }
  };

  const handleEditLesson = (lesson: YoungLearnersLesson) => {
    window.open(`/young-learners-visual-editor/${lesson.id}`, '_blank');
  };

  const handlePreviewLesson = (lesson: YoungLearnersLesson) => {
    window.open(`/young-learners-preview/${lesson.id}`, '_blank');
  };

  const handleSelectLesson = (lesson: YoungLearnersLesson) => {
    setSelectedLesson(prev => prev?.id === lesson.id ? null : lesson);
  };

  const courseStats = useMemo(() => {
    const totalLessons = lessons.length;
    const themeDistribution = THEMES.reduce((acc, theme) => {
      acc[theme.value] = lessons.filter(l => l.theme === theme.value).length;
      return acc;
    }, {} as Record<LessonTheme, number>);
    
    const completedLevels = LEVELS.filter(level => 
      getLevelLessonCount(level) >= 50
    ).length;
    
    return {
      totalLessons,
      themeDistribution,
      completedLevels,
      totalCapacity: 250,
      progressPercent: Math.round((totalLessons / 250) * 100),
    };
  }, [lessons]);

  return (
    <div className="yle-page">
      {/* Header */}
      <div className="yle-header">
        <div className="yle-header-content">
          <div className="yle-title-row">
            <div className="yle-title-icon">
              <span className="yle-title-emoji">🧒</span>
            </div>
            <div>
              <h1>Young Learners</h1>
              <p>{lessons.length} lessons across 5 levels</p>
            </div>
          </div>
          <button className="yle-create-btn" onClick={() => setShowCreateModal(true)}>
            <i className="ri-add-line" />
            Create Lesson
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="yle-main-layout">
        {/* Left: Accordion Container */}
        <div className="yle-accordion-container">
          <div className="yle-accordion">
            {loading ? (
              <div className="yle-loading">
                <i className="ri-loader-4-line" />
                Loading lessons...
              </div>
            ) : (
              LEVELS.map(level => (
                <div className="yle-level" key={level}>
                  {/* Level Header */}
                  <button 
                    className={`yle-level-header ${expandedLevels.has(level) ? 'expanded' : ''}`}
                    onClick={() => toggleLevel(level)}
                    style={{ '--level-color': LEVEL_COLORS[level] } as any}
                  >
                    <div className="yle-level-info">
                      <i className={`ri-arrow-${expandedLevels.has(level) ? 'down' : 'right'}-s-line`} />
                      <span className="yle-level-badge" style={{ backgroundColor: LEVEL_COLORS[level] }}>
                        {LEVEL_NAMES[level]}
                      </span>
                      <span className="yle-level-name">Level {level}</span>
                      <span className="yle-level-age">{LEVEL_AGES[level]}</span>
                    </div>
                    <span className="yle-level-count">
                      {getLevelLessonCount(level)} lesson{getLevelLessonCount(level) !== 1 ? 's' : ''}
                    </span>
                  </button>

                  {/* Units */}
                  {expandedLevels.has(level) && (
                    <div className="yle-units">
                      {UNITS.map(unit => {
                        const unitKey = `${level}-${unit}`;
                        const unitName = getUnitName(level, unit);
                        const unitLessons = lessonsByLevelUnit[unitKey] || [];
                        const hasLessons = unitLessons.length > 0;

                        return (
                          <div className="yle-unit" key={unitKey}>
                            {/* Unit Header */}
                            <button 
                              className={`yle-unit-header ${expandedUnits.has(unitKey) ? 'expanded' : ''} ${!hasLessons ? 'empty' : ''}`}
                              onClick={() => toggleUnit(level, unit)}
                            >
                              <div className="yle-unit-info">
                                <i className={`ri-arrow-${expandedUnits.has(unitKey) ? 'down' : 'right'}-s-line`} />
                                <span className="yle-unit-number">Unit {unit}</span>
                                {unitName && (
                                  <span className="yle-unit-name">{unitName}</span>
                                )}
                              </div>
                              <span className="yle-unit-count">
                                {getUnitLessonCount(level, unit)}/5
                              </span>
                            </button>

                            {/* Lessons */}
                            {expandedUnits.has(unitKey) && (
                              <div className="yle-lessons-list">
                                {unitLessons.length > 0 ? (
                                  unitLessons.map(lesson => (
                                    <div 
                                      className={`yle-lesson-row ${selectedLesson?.id === lesson.id ? 'selected' : ''}`} 
                                      key={lesson.id}
                                      onClick={() => handleSelectLesson(lesson)}
                                    >
                                      <div className="yle-lesson-main">
                                        <span className="yle-lesson-mascot">{lesson.mascot}</span>
                                        <span className="yle-lesson-number">L{lesson.lessonNumber}</span>
                                        <span className="yle-lesson-title">{lesson.lessonTitle.replace(/^Lesson \d+:\s*/, '')}</span>
                                      </div>
                                      <div className="yle-lesson-actions">
                                        <button 
                                          className="yle-action-btn"
                                          onClick={(e) => { e.stopPropagation(); handleEditLesson(lesson); }}
                                          title="Edit"
                                        >
                                          <i className="ri-edit-line" />
                                        </button>
                                        <button 
                                          className="yle-action-btn"
                                          onClick={(e) => { e.stopPropagation(); handlePreviewLesson(lesson); }}
                                          title="Preview"
                                        >
                                          <i className="ri-eye-line" />
                                        </button>
                                        <button 
                                          className="yle-action-btn"
                                          onClick={(e) => { e.stopPropagation(); handleDuplicateLesson(lesson); }}
                                          title="Duplicate"
                                        >
                                          <i className="ri-file-copy-line" />
                                        </button>
                                        <button 
                                          className="yle-action-btn yle-action-delete"
                                          onClick={(e) => { e.stopPropagation(); handleDeleteLesson(lesson.id); }}
                                          title="Delete"
                                        >
                                          <i className="ri-delete-bin-line" />
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="yle-empty-unit">
                                    <span>No lessons yet</span>
                                    <button 
                                      className="yle-add-lesson-btn"
                                      onClick={() => setShowCreateModal(true)}
                                    >
                                      <i className="ri-add-line" />
                                      Add Lesson
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Analytics Panel */}
        <div className="yle-analytics-panel">
          {selectedLesson ? (
            <LessonAnalytics lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />
          ) : (
            <CourseAnalytics stats={courseStats} lessons={lessons} />
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateLessonModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateLesson}
        />
      )}
    </div>
  );
}

// ============================================================================
// CREATE LESSON MODAL
// ============================================================================

function CreateLessonModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: CreateYoungLearnersInput) => void;
}) {
  const [form, setForm] = useState({
    level: 1,
    unit: 1,
    lessonNumber: 1,
    theme: 'animals' as LessonTheme,
    ageGroup: '3-5' as AgeGroup,
    unitName: '',
    lessonName: '',
    mascot: 'foxy',
  });
  const [loading, setLoading] = useState(false);
  const [unitNameLocked, setUnitNameLocked] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState('');

  useEffect(() => {
    const checkUnit = async () => {
      try {
        const result = await youngLearnersApi.getExistingUnitName(form.level, form.unit);
        if (result.success && result.unitName) {
          setForm(f => ({ ...f, unitName: result.unitName! }));
          setUnitNameLocked(true);
        } else {
          setUnitNameLocked(false);
        }
      } catch (error) {
        console.error('Failed to check unit name:', error);
      }
    };
    checkUnit();
  }, [form.level, form.unit]);

  useEffect(() => {
    const checkDup = async () => {
      try {
        const result = await youngLearnersApi.checkDuplicate(form.level, form.unit, form.lessonNumber);
        if (result.exists) {
          setDuplicateWarning(
            `Level ${form.level}, Unit ${form.unit}, Lesson ${form.lessonNumber} already exists`
          );
        } else {
          setDuplicateWarning('');
        }
      } catch (error) {
        console.error('Failed to check duplicate:', error);
      }
    };
    checkDup();
  }, [form.level, form.unit, form.lessonNumber]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (duplicateWarning) {
      toast.error('This lesson combination already exists');
      return;
    }
    if (!form.unitName || !form.lessonName) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await onCreate(form);
    } finally {
      setLoading(false);
    }
  };

  const selectedMascot = MASCOTS.find(m => m.value === form.mascot);

  return (
    <div className="yle-modal-overlay" onClick={onClose}>
      <div className="yle-modal" onClick={e => e.stopPropagation()}>
        <div className="yle-modal-header">
          <h2>Create New Lesson</h2>
          <button className="yle-modal-close" onClick={onClose}>
            <i className="ri-close-line" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="yle-modal-body">
            {/* Dropdowns Row */}
            <div className="yle-form-row yle-form-row-3">
              <div className="yle-form-field">
                <label>Level</label>
                <select
                  value={form.level}
                  onChange={e => setForm({ ...form, level: parseInt((e.target as HTMLSelectElement).value) })}
                >
                  {LEVELS.map(l => (
                    <option key={l} value={l}>Level {l} ({LEVEL_NAMES[l]})</option>
                  ))}
                </select>
              </div>
              <div className="yle-form-field">
                <label>Unit</label>
                <select
                  value={form.unit}
                  onChange={e => setForm({ ...form, unit: parseInt((e.target as HTMLSelectElement).value) })}
                >
                  {UNITS.map(u => (
                    <option key={u} value={u}>Unit {u}</option>
                  ))}
                </select>
              </div>
              <div className="yle-form-field">
                <label>Lesson</label>
                <select
                  value={form.lessonNumber}
                  onChange={e => setForm({ ...form, lessonNumber: parseInt((e.target as HTMLSelectElement).value) })}
                >
                  {LESSONS.map(l => (
                    <option key={l} value={l}>Lesson {l}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Duplicate Warning */}
            {duplicateWarning && (
              <div className="yle-warning">
                <i className="ri-error-warning-line" />
                {duplicateWarning}
              </div>
            )}

            {/* Theme Selection */}
            <div className="yle-form-field">
              <label>Theme</label>
              <div className="yle-theme-grid">
                {THEMES.map(theme => (
                  <button
                    key={theme.value}
                    type="button"
                    className={`yle-theme-btn ${form.theme === theme.value ? 'selected' : ''}`}
                    onClick={() => setForm({ ...form, theme: theme.value })}
                  >
                    <span className="yle-theme-icon">{theme.icon}</span>
                    <span className="yle-theme-label">{theme.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mascot Selection */}
            <div className="yle-form-field">
              <label>Mascot</label>
              <div className="yle-mascot-grid">
                {MASCOTS.map(mascot => (
                  <button
                    key={mascot.value}
                    type="button"
                    className={`yle-mascot-btn ${form.mascot === mascot.value ? 'selected' : ''}`}
                    onClick={() => setForm({ ...form, mascot: mascot.value })}
                  >
                    <span className="yle-mascot-emoji">{mascot.emoji}</span>
                    <span className="yle-mascot-name">{mascot.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Unit Name */}
            <div className="yle-form-field">
              <label>
                Unit Name
                {unitNameLocked && <span className="yle-locked-label">(auto-filled from existing)</span>}
              </label>
              <input
                type="text"
                value={form.unitName}
                onChange={e => setForm({ ...form, unitName: (e.target as HTMLInputElement).value })}
                placeholder="e.g., Animal Friends"
                disabled={unitNameLocked}
              />
            </div>

            {/* Lesson Name */}
            <div className="yle-form-field">
              <label>Lesson Name</label>
              <input
                type="text"
                value={form.lessonName}
                onChange={e => setForm({ ...form, lessonName: (e.target as HTMLInputElement).value })}
                placeholder="e.g., My Pet Cat"
              />
            </div>

            {/* Preview */}
            <div className="yle-preview-labels">
              <div className="yle-preview-mascot">{selectedMascot?.emoji}</div>
              <div className="yle-preview-text">
                <p><strong>Unit Label:</strong> Unit {form.unit}: {form.unitName || '...'}</p>
                <p><strong>Lesson Title:</strong> Lesson {form.lessonNumber}: {form.lessonName || '...'}</p>
              </div>
            </div>
          </div>

          <div className="yle-modal-footer">
            <button type="button" className="yle-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="yle-btn-primary" 
              disabled={loading || !!duplicateWarning}
            >
              {loading ? 'Creating...' : 'Create Lesson'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// COURSE ANALYTICS (Default View)
// ============================================================================

function CourseAnalytics({ 
  stats, 
  lessons 
}: { 
  stats: {
    totalLessons: number;
    themeDistribution: Record<LessonTheme, number>;
    completedLevels: number;
    totalCapacity: number;
    progressPercent: number;
  };
  lessons: YoungLearnersLesson[];
}) {
  return (
    <div className="yle-analytics">
      <div className="yle-analytics-header">
        <i className="ri-bar-chart-box-line" />
        <h3>Course Overview</h3>
      </div>

      {/* Progress Circle */}
      <div className="yle-progress-section">
        <div className="yle-progress-circle">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" className="yle-progress-bg" />
            <circle 
              cx="50" cy="50" r="42" 
              className="yle-progress-fill"
              style={{ 
                strokeDasharray: `${stats.progressPercent * 2.64} 264` 
              }}
            />
          </svg>
          <div className="yle-progress-text">
            <span className="yle-progress-value">{stats.progressPercent}%</span>
            <span className="yle-progress-label">Complete</span>
          </div>
        </div>
        <p className="yle-progress-detail">
          {stats.totalLessons} of {stats.totalCapacity} lessons created
        </p>
      </div>

      {/* Theme Distribution */}
      <div className="yle-stats-section">
        <h4>Theme Distribution</h4>
        <div className="yle-theme-bars">
          {THEMES.slice(0, 5).map(theme => (
            <div className="yle-theme-bar-item" key={theme.value}>
              <div className="yle-theme-bar-header">
                <span className="yle-theme-bar-label">
                  <span className="yle-theme-icon-small">{theme.icon}</span>
                  {theme.label}
                </span>
                <span className="yle-theme-bar-value">{stats.themeDistribution[theme.value] || 0}</span>
              </div>
              <div className="yle-theme-bar-track">
                <div 
                  className={`yle-theme-bar-fill ${theme.value}`} 
                  style={{ width: `${stats.totalLessons ? ((stats.themeDistribution[theme.value] || 0) / stats.totalLessons) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="yle-stats-section">
        <h4>Quick Stats</h4>
        <div className="yle-quick-stats">
          <div className="yle-quick-stat">
            <i className="ri-stack-line" />
            <div>
              <span className="yle-quick-stat-value">5</span>
              <span className="yle-quick-stat-label">Levels</span>
            </div>
          </div>
          <div className="yle-quick-stat">
            <i className="ri-book-2-line" />
            <div>
              <span className="yle-quick-stat-value">50</span>
              <span className="yle-quick-stat-label">Units</span>
            </div>
          </div>
          <div className="yle-quick-stat">
            <i className="ri-file-list-3-line" />
            <div>
              <span className="yle-quick-stat-value">{stats.totalLessons}</span>
              <span className="yle-quick-stat-label">Lessons</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recently Updated */}
      <div className="yle-stats-section">
        <h4>Recently Updated</h4>
        <div className="yle-recent-list">
          {lessons.slice(0, 5).map(lesson => (
            <div className="yle-recent-item" key={lesson.id}>
              <span className="yle-recent-mascot">{lesson.mascot}</span>
              <span className="yle-recent-title">{lesson.lessonTitle.replace(/^Lesson \d+:\s*/, '')}</span>
              <span className="yle-recent-date">
                {new Date(lesson.updatedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
          {lessons.length === 0 && (
            <p className="yle-empty-recent">No lessons yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LESSON ANALYTICS (Selected Lesson View)
// ============================================================================

function LessonAnalytics({ 
  lesson, 
  onClose 
}: { 
  lesson: YoungLearnersLesson; 
  onClose: () => void;
}) {
  const themeData = THEMES.find(t => t.value === lesson.theme);

  return (
    <div className="yle-analytics">
      <div className="yle-analytics-header">
        <i className="ri-line-chart-line" />
        <h3>Lesson Details</h3>
        <button className="yle-analytics-close" onClick={onClose}>
          <i className="ri-close-line" />
        </button>
      </div>

      {/* Lesson Info Card */}
      <div className="yle-lesson-info-card">
        <div className="yle-lesson-info-mascot">{lesson.mascot}</div>
        <h4>{lesson.lessonTitle}</h4>
        <p className="yle-lesson-info-unit">{lesson.unitLabel}</p>
        <div className="yle-lesson-info-meta">
          <span className="yle-lesson-info-level" style={{ backgroundColor: LEVEL_COLORS[lesson.level] }}>
            {LEVEL_NAMES[lesson.level]}
          </span>
          <span className="yle-lesson-info-theme">
            {themeData?.icon} {themeData?.label}
          </span>
        </div>
      </div>

      {/* Content Status */}
      <div className="yle-stats-section">
        <h4>Content Status</h4>
        <div className="yle-content-status">
          <div className={`yle-status-item ${lesson.vocabularyWords.length > 0 ? 'complete' : 'incomplete'}`}>
            <i className={lesson.vocabularyWords.length > 0 ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Vocabulary ({lesson.vocabularyWords.length} words)</span>
          </div>
          <div className={`yle-status-item ${lesson.song ? 'complete' : 'incomplete'}`}>
            <i className={lesson.song ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Song</span>
          </div>
          <div className={`yle-status-item ${lesson.story ? 'complete' : 'incomplete'}`}>
            <i className={lesson.story ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Story</span>
          </div>
          <div className={`yle-status-item ${lesson.activities.length > 0 ? 'complete' : 'incomplete'}`}>
            <i className={lesson.activities.length > 0 ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Activities ({lesson.activities.length})</span>
          </div>
        </div>
      </div>

      {/* Mock Student Engagement */}
      <div className="yle-stats-section">
        <h4>Student Engagement</h4>
        <div className="yle-engagement-stats">
          <div className="yle-engagement-stat">
            <span className="yle-engagement-value">0</span>
            <span className="yle-engagement-label">Total Views</span>
          </div>
          <div className="yle-engagement-stat">
            <span className="yle-engagement-value">0</span>
            <span className="yle-engagement-label">Completions</span>
          </div>
          <div className="yle-engagement-stat">
            <span className="yle-engagement-value">--</span>
            <span className="yle-engagement-label">Avg. Rating</span>
          </div>
        </div>
      </div>

      {/* Time Stats */}
      <div className="yle-stats-section">
        <h4>Time Info</h4>
        <div className="yle-time-stats">
          <div className="yle-time-stat">
            <i className="ri-calendar-line" />
            <div>
              <span className="yle-time-value">{new Date(lesson.createdAt).toLocaleDateString()}</span>
              <span className="yle-time-label">Created</span>
            </div>
          </div>
          <div className="yle-time-stat">
            <i className="ri-refresh-line" />
            <div>
              <span className="yle-time-value">{new Date(lesson.updatedAt).toLocaleDateString()}</span>
              <span className="yle-time-label">Last Updated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="yle-stats-section">
        <h4>Publication Status</h4>
        <div className={`yle-status-badge ${lesson.status}`}>
          <i className={lesson.status === 'published' ? 'ri-check-line' : 'ri-draft-line'} />
          {lesson.status === 'published' ? 'Published' : 'Draft'}
        </div>
      </div>
    </div>
  );
}
