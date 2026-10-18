/**
 * BusinessEnglishEditorPage
 * No-code editor for creating Business English lesson materials
 * Hierarchical view: Levels 3–10 → 5 Chapters → 5 Lessons per chapter
 *
 * Syllabus:
 *   Level 3       — Beginner         (TOEIC 10-220)   Listening, Speaking, Reading
 *   Level 4-5     — High Beginner    (TOEIC 225-545)  Listening, Speaking, Reading
 *   Level 6-7     — Intermediate     (TOEIC 550-780)  Listening, Speaking, Reading, Writing
 *   Level 8-9     — High Intermediate(TOEIC 785-940)  Listening, Speaking, Reading, Writing
 *   Level 10      — Advanced         (TOEIC 945+)     Listening, Speaking, Reading, Writing (Task-Based)
 *
 * Methodology: PCPP for Levels 3–9 | Task-Based for Level 10
 */
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import {
  createLesson,
  listLessonsByCourse,
  checkDuplicate,
  deleteLesson,
  duplicateLesson,
  publishLesson,
  unpublishLesson,
  getCourseMetadata,
  saveLevelTopic,
  saveChapterMeta,
  assignLevelAdmin,
  unassignLevelAdmin,
  getLevelAssignments,
  saveCourseStructure,
  type LessonMaterial,
  type Skill,
  type CreateLessonInput,
  type CourseMetadata,
  type LevelAssignment,
} from '../api/lessonMaterial.api';
import {
  generateCourseStructure,
  generateLessonStructure,
  type CourseStructureChapter,
  type LessonStructureItem,
} from '../api/ai.api';
import { authApi, type AdminListItem } from '../api/auth.api';
import { useAuthContext } from '../context/AuthContext';
import { toast } from '../Components/Toast/Toast';
import './BusinessEnglishEditorPage.css';

// ============================================================================
// CONSTANTS
// ============================================================================

const COURSE_ID = 'business-english';
const LEVELS = [3, 4, 5, 6, 7, 8, 9, 10];
const CHAPTERS = Array.from({ length: 5 }, (_, i) => i + 1);
const LESSONS = Array.from({ length: 5 }, (_, i) => i + 1);

/** All levels have 5 chapters */
const getChaptersForLevel = (_level: number): number[] => CHAPTERS;

/**
 * Hardcoded skill cycle per lesson number within a chapter.
 * Fixed order: Listening → Reading → Speaking → Speaking → Review
 * Same for ALL levels (3–10).
 */
const SKILL_CYCLE: Skill[] = ['listening', 'reading', 'speaking', 'speaking', 'review'];

const getSkillForLesson = (lessonNumber: number): Skill => {
  return SKILL_CYCLE[(lessonNumber - 1) % SKILL_CYCLE.length];
};

/** Flat skill list for analytics (superset) */
const ALL_SKILLS: { value: Skill; label: string }[] = [
  { value: 'listening', label: 'Listening' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'reading', label: 'Reading' },
  { value: 'writing', label: 'Writing' },
  { value: 'review', label: 'Review' },
];

const LEVEL_BADGES: Record<number, string> = {
  3: 'BEGINNER',
  4: 'HIGH BEGINNER',
  5: 'HIGH BEGINNER',
  6: 'INTERMEDIATE',
  7: 'INTERMEDIATE',
  8: 'HIGH INTERMEDIATE',
  9: 'HIGH INTERMEDIATE',
  10: 'ADVANCED',
};

const LEVEL_COLORS: Record<number, string> = {
  3: '#3b82f6',           // Blue — Beginner
  4: '#8b5cf6',           // Purple — High Beginner
  5: '#8b5cf6',
  6: '#f59e0b',           // Amber — Intermediate
  7: '#f59e0b',
  8: '#ef4444',           // Red — High Intermediate
  9: '#ef4444',
  10: '#1e293b',          // Dark — Advanced
};

const LEVEL_TOEIC: Record<number, string> = {
  3: 'TOEIC 10-220',
  4: 'TOEIC 225-545',
  5: 'TOEIC 225-545',
  6: 'TOEIC 550-780',
  7: 'TOEIC 550-780',
  8: 'TOEIC 785-940',
  9: 'TOEIC 785-940',
  10: 'TOEIC 945+',
};

const LEVEL_METHOD: Record<number, string> = {
  3: 'PCPP',
  4: 'PCPP',
  5: 'PCPP',
  6: 'PCPP',
  7: 'PCPP',
  8: 'PCPP',
  9: 'PCPP',
  10: 'Task-Based',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BusinessEnglishEditorPage() {
  const { user } = useAuthContext();
  const isSuperAdmin = user?.role === 'superadmin';

  const [lessons, setLessons] = useState<LessonMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [selectedLesson, setSelectedLesson] = useState<LessonMaterial | null>(null);

  // Course metadata
  const [metadata, setMetadata] = useState<CourseMetadata>({ levels: {}, chapters: {} });
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Level admin assignments
  const [assignments, setAssignments] = useState<Record<number, LevelAssignment>>({});
  const [showAssignModal, setShowAssignModal] = useState(false);

  // AI Generation
  const [generatingStructure, setGeneratingStructure] = useState<number | null>(null);
  const [structurePreview, setStructurePreview] = useState<{
    level: number;
    mainTopic: string;
    chapters: CourseStructureChapter[];
  } | null>(null);
  const [generatingLessons, setGeneratingLessons] = useState<string | null>(null);
  const [lessonPreview, setLessonPreview] = useState<{
    level: number;
    chapter: number;
    lessons: LessonStructureItem[];
  } | null>(null);

  // ---- Data loaders ----
  useEffect(() => {
    loadLessons();
    loadMetadata();
    loadAssignments();
  }, []);

  const loadLessons = async () => {
    try {
      setLoading(true);
      const data = await listLessonsByCourse(COURSE_ID);
      setLessons(data);
    } catch {
      toast.error('Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  const loadMetadata = async () => {
    try {
      const data = await getCourseMetadata(COURSE_ID);
      setMetadata(data);
    } catch {
      // OK — fresh course
    }
  };

  const loadAssignments = async () => {
    try {
      const data = await getLevelAssignments(COURSE_ID);
      setAssignments(data);
    } catch {
      // OK
    }
  };

  // ---- Helpers ----
  const getChapterName = (level: number, chapter: number): string => {
    const key = `${level}-${chapter}`;
    return metadata.chapters[key]?.name || '';
  };

  const getLevelTotalLessons = (level: number): number =>
    lessons.filter((l) => l.level === level).length;

  const getChapterLessonCount = (level: number, chapter: number): number =>
    lessons.filter((l) => l.level === level && l.chapter === chapter).length;

  // ---- Accordion toggles ----
  const toggleLevel = (level: number) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const toggleChapter = (level: number, chapter: number) => {
    const key = `${level}-${chapter}`;
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ---- Inline meta editing ----
  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditingValue(currentValue);
  };
  const cancelEditing = () => {
    setEditingField(null);
    setEditingValue('');
  };

  const saveLevelTopicInline = async (level: number) => {
    try {
      await saveLevelTopic(COURSE_ID, level, editingValue);
      await loadMetadata();
      cancelEditing();
      toast.success('Level topic saved');
    } catch {
      toast.error('Failed to save topic');
    }
  };

  const saveChapterMetaInline = async (level: number, chapter: number, field: 'theme' | 'name') => {
    try {
      const key = `${level}-${chapter}`;
      const existing = metadata.chapters[key] || { theme: '', name: '' };
      const data = { ...existing, [field]: editingValue };
      await saveChapterMeta(COURSE_ID, level, chapter, data);
      await loadMetadata();
      cancelEditing();
      toast.success(`Chapter ${field} saved`);
    } catch {
      toast.error('Failed to save');
    }
  };

  // ---- AI Generation ----
  const handleGenerateStructure = async (level: number) => {
    setGeneratingStructure(level);
    try {
      const existingTopic = metadata.levels[level]?.mainTopic || null;
      const chapterKeys = getChaptersForLevel(level);
      const existingChapters = chapterKeys
        .map((c) => {
          const key = `${level}-${c}`;
          const ch = metadata.chapters[key];
          return { chapter: c, theme: ch?.theme, name: ch?.name };
        })
        .filter((c) => c.theme || c.name);

      const result = await generateCourseStructure(
        level,
        existingTopic,
        existingChapters.length > 0 ? existingChapters : null
      );
      if (result.success && result.data) {
        setStructurePreview({ level, ...result.data });
      } else {
        toast.error(result.error || 'Failed to generate structure');
      }
    } catch {
      toast.error('AI generation failed');
    } finally {
      setGeneratingStructure(null);
    }
  };

  const handleAcceptStructure = async () => {
    if (!structurePreview) return;
    try {
      await saveCourseStructure(COURSE_ID, structurePreview.level, {
        mainTopic: structurePreview.mainTopic,
        chapters: structurePreview.chapters,
      });
      await loadMetadata();
      setStructurePreview(null);
      toast.success('Structure saved');
    } catch {
      toast.error('Failed to save structure');
    }
  };

  const handleGenerateLessons = async (level: number, chapter: number) => {
    const key = `${level}-${chapter}`;
    setGeneratingLessons(key);
    try {
      const levelTopic = metadata.levels[level]?.mainTopic || '';
      const chapterMeta = metadata.chapters[key] || { theme: '', name: '' };

      if (!levelTopic || !chapterMeta.theme || !chapterMeta.name) {
        toast.error('Please set the level topic, chapter theme, and chapter name first');
        setGeneratingLessons(null);
        return;
      }

      const result = await generateLessonStructure(
        level,
        chapter,
        levelTopic,
        chapterMeta.theme,
        chapterMeta.name,
        null,
        COURSE_ID
      );
      if (result.success && result.data) {
        setLessonPreview({ level, chapter, lessons: result.data.lessons.slice(0, LESSONS.length) });
      } else {
        toast.error(result.error || 'Failed to generate lessons');
      }
    } catch {
      toast.error('AI lesson generation failed');
    } finally {
      setGeneratingLessons(null);
    }
  };

  const handleAcceptLessons = async () => {
    if (!lessonPreview) return;
    try {
      for (const lesson of lessonPreview.lessons.slice(0, LESSONS.length)) {
        const skill = getSkillForLesson(lesson.lessonNumber);
        const exists = await checkDuplicate(COURSE_ID, lessonPreview.level, lessonPreview.chapter, lesson.lessonNumber, skill);
        if (exists) continue;
        await createLesson({
          course: COURSE_ID,
          level: lessonPreview.level,
          chapter: lessonPreview.chapter,
          lessonNumber: lesson.lessonNumber,
          skill,
          lessonName: lesson.lessonName,
          goalTextEn: lesson.goalTextEn,
          goalTextJp: lesson.goalTextJp,
        });
      }
      await loadLessons();
      setLessonPreview(null);
      toast.success('Lessons created');
    } catch {
      toast.error('Failed to create lessons');
    }
  };

  // ---- CRUD ----
  const handleCreateLesson = async (input: CreateLessonInput) => {
    try {
      await createLesson({ ...input, course: COURSE_ID });
      await loadLessons();
      setShowCreateModal(false);
      toast.success('Lesson created!');
    } catch {
      toast.error('Failed to create lesson');
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('Delete this lesson? This cannot be undone.')) return;
    try {
      await deleteLesson(id);
      setLessons((prev) => prev.filter((l) => l.id !== id));
      if (selectedLesson?.id === id) setSelectedLesson(null);
      toast.success('Lesson deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleDuplicateLesson = async (lesson: LessonMaterial) => {
    try {
      await duplicateLesson(lesson.id);
      await loadLessons();
      toast.success('Lesson duplicated');
    } catch {
      toast.error('Failed to duplicate');
    }
  };

  const handlePublishLesson = async (lesson: LessonMaterial) => {
    try {
      await publishLesson(lesson.id);
      setLessons((prev) => prev.map((l) => (l.id === lesson.id ? { ...l, status: 'published' as const } : l)));
      toast.success('Lesson published');
    } catch {
      toast.error('Failed to publish');
    }
  };

  const handleUnpublishLesson = async (lesson: LessonMaterial) => {
    try {
      await unpublishLesson(lesson.id);
      setLessons((prev) => prev.map((l) => (l.id === lesson.id ? { ...l, status: 'draft' as const } : l)));
      toast.success('Lesson unpublished');
    } catch {
      toast.error('Failed to unpublish');
    }
  };

  const handleSelectLesson = (lesson: LessonMaterial) => {
    setSelectedLesson(selectedLesson?.id === lesson.id ? null : lesson);
  };

  const handleEditLesson = (lesson: LessonMaterial) => {
    window.open(`/business-english-visual-editor/${lesson.id}`, '_blank');
  };

  const handlePreviewLesson = (lesson: LessonMaterial) => {
    window.open(`/business-english-preview/${lesson.id}`, '_blank');
  };

  // ---- Computed ----
  const lessonsByLevelChapter = useMemo(() => {
    const map: Record<string, LessonMaterial[]> = {};
    for (const l of lessons) {
      const key = `${l.level}-${l.chapter}`;
      if (!map[key]) map[key] = [];
      map[key].push(l);
    }
    // Sort each bucket by lessonNumber then skill
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.lessonNumber - b.lessonNumber || a.skill.localeCompare(b.skill));
    }
    return map;
  }, [lessons]);

  const courseStats = useMemo(() => {
    const speakingCount = lessons.filter((l) => l.skill === 'speaking').length;
    const listeningCount = lessons.filter((l) => l.skill === 'listening').length;
    const readingCount = lessons.filter((l) => l.skill === 'reading').length;
    const writingCount = lessons.filter((l) => l.skill === 'writing').length;
    const reviewCount = lessons.filter((l) => l.skill === 'review').length;
    const totalLessons = lessons.length;
    // Capacity: 8 levels × 5 chapters × 5 lessons = 200 total
    const totalCapacity = LEVELS.length * 5 * 5; // 200
    const completedLevels = LEVELS.filter((lv) => {
      return getLevelTotalLessons(lv) >= 5 * 5; // 25 lessons per level
    }).length;
    const progressPercent = totalCapacity > 0 ? Math.round((totalLessons / totalCapacity) * 100) : 0;

    return {
      totalLessons,
      speakingCount,
      listeningCount,
      readingCount,
      writingCount,
      reviewCount,
      completedLevels,
      totalCapacity,
      progressPercent,
    };
  }, [lessons]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="bee-page cse-page">
      {/* Header */}
      <div className="cse-header">
        <div className="cse-header-content">
          <div className="cse-title-row">
            <div className="cse-title-icon bee-title-icon">
              <i className="ri-briefcase-4-line" />
            </div>
            <div>
              <h1>Business English</h1>
              <p>Professional English for the Workplace — Levels 3–10</p>
            </div>
          </div>
          <div className="cse-toolbar-actions">
            {isSuperAdmin && (
              <button className="cse-assign-btn" onClick={() => setShowAssignModal(true)}>
                <i className="ri-user-settings-line" />
                Assign Levels
              </button>
            )}
            <button className="cse-create-btn bee-create-btn" onClick={() => setShowCreateModal(true)}>
              <i className="ri-add-line" />
              New Lesson
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout: Accordion + Analytics */}
      <div className="cse-main-layout">
        <div className="cse-accordion-container">
          <div className="cse-accordion">
            {loading ? (
              <div className="cse-loading">
                <i className="ri-loader-4-line" />
                Loading…
              </div>
            ) : (
              LEVELS.map((level) => (
                <div className="cse-level" key={level}>
                  {/* Level Header */}
                  <button
                    className={`cse-level-header ${expandedLevels.has(level) ? 'expanded' : ''}`}
                    onClick={() => toggleLevel(level)}
                  >
                    <div className="cse-level-info">
                      <i className={`ri-arrow-${expandedLevels.has(level) ? 'down' : 'right'}-s-line`} />
                      <span className="cse-level-badge" style={{ backgroundColor: LEVEL_COLORS[level] }}>
                        {LEVEL_BADGES[level]}
                      </span>
                      <span className="cse-level-name">Level {level}</span>
                      {metadata.levels[level]?.mainTopic && (
                        <span className="cse-level-topic">{metadata.levels[level].mainTopic}</span>
                      )}
                    </div>
                    <div className="bee-level-right">
                      <span className="bee-toeic-badge">{LEVEL_TOEIC[level]}</span>
                      <span className="bee-method-badge">{LEVEL_METHOD[level]}</span>
                      {assignments[level] && (
                        <span className="cse-assigned-badge">
                          <i className="ri-user-line" />
                          {assignments[level].adminName}
                        </span>
                      )}
                      <span className="cse-level-count">
                        {getLevelTotalLessons(level)} lessons
                      </span>
                    </div>
                  </button>

                  {/* Expanded Level Content */}
                  {expandedLevels.has(level) && (
                    <>
                      {/* Level Topic Editor */}
                      <div className="cse-meta-row">
                        <label className="cse-meta-label">
                          <i className="ri-folder-open-line" /> Topic
                        </label>
                        {editingField === `level-topic-${level}` ? (
                          <div className="cse-meta-edit">
                            <input
                              type="text"
                              className="cse-meta-input"
                              value={editingValue}
                              onInput={(e) => setEditingValue((e.target as HTMLInputElement).value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveLevelTopicInline(level);
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              autoFocus
                              placeholder="e.g., Business Basics"
                            />
                            <button className="cse-meta-save" onClick={() => saveLevelTopicInline(level)} title="Save">
                              <i className="ri-check-line" />
                            </button>
                            <button className="cse-meta-cancel" onClick={cancelEditing} title="Cancel">
                              <i className="ri-close-line" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="cse-meta-display"
                            onClick={() => startEditing(`level-topic-${level}`, metadata.levels[level]?.mainTopic || '')}
                          >
                            <span className={metadata.levels[level]?.mainTopic ? '' : 'cse-meta-placeholder'}>
                              {metadata.levels[level]?.mainTopic || 'Click to set topic…'}
                            </span>
                            <i className="ri-pencil-line cse-meta-edit-icon" />
                          </div>
                        )}
                      </div>

                      {/* AI Generate Structure */}
                      <div className="cse-ai-generate-row">
                        <button
                          className="cse-ai-generate-btn"
                          onClick={() => handleGenerateStructure(level)}
                          disabled={generatingStructure === level}
                        >
                          {generatingStructure === level ? (
                            <>
                              <i className="ri-loader-4-line ri-spin" /> Generating…
                            </>
                          ) : (
                            <>
                              <i className="ri-magic-line" /> Generate Structure with AI
                            </>
                          )}
                        </button>
                        <span className="cse-ai-generate-hint">Generates main topic + chapter themes &amp; names</span>
                      </div>

                      {/* Chapters */}
                      <div className="cse-chapters">
                        {getChaptersForLevel(level).map((chapter) => {
                          const chapterKey = `${level}-${chapter}`;
                          const chapterName = getChapterName(level, chapter) || metadata.chapters[chapterKey]?.name || '';
                          const chapterTheme = metadata.chapters[chapterKey]?.theme || '';
                          const chapterLessons = lessonsByLevelChapter[chapterKey] || [];
                          const hasLessons = chapterLessons.length > 0;

                          return (
                            <div className="cse-chapter" key={chapterKey}>
                              {/* Chapter Header */}
                              <button
                                className={`cse-chapter-header ${expandedChapters.has(chapterKey) ? 'expanded' : ''} ${!hasLessons ? 'empty' : ''}`}
                                onClick={() => toggleChapter(level, chapter)}
                              >
                                <div className="cse-chapter-info">
                                  <i className={`ri-arrow-${expandedChapters.has(chapterKey) ? 'down' : 'right'}-s-line`} />
                                  <span className="cse-chapter-number">Chapter {chapter}</span>
                                  {chapterTheme && <span className="cse-chapter-theme">{chapterTheme}</span>}
                                  {chapterName && <span className="cse-chapter-name">{chapterName}</span>}
                                </div>
                                <span className="cse-chapter-count">{getChapterLessonCount(level, chapter)}/5</span>
                              </button>

                              {/* Chapter Meta Editors */}
                              {expandedChapters.has(chapterKey) && (
                                <div className="cse-chapter-meta-editors">
                                  {/* Theme */}
                                  <div className="cse-meta-row cse-meta-row-compact">
                                    <label className="cse-meta-label">
                                      <i className="ri-bookmark-line" /> Theme
                                    </label>
                                    {editingField === `chapter-theme-${chapterKey}` ? (
                                      <div className="cse-meta-edit">
                                        <input
                                          type="text"
                                          className="cse-meta-input"
                                          value={editingValue}
                                          onInput={(e) => setEditingValue((e.target as HTMLInputElement).value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveChapterMetaInline(level, chapter, 'theme');
                                            if (e.key === 'Escape') cancelEditing();
                                          }}
                                          autoFocus
                                          placeholder="e.g., Meetings & Presentations"
                                        />
                                        <button className="cse-meta-save" onClick={() => saveChapterMetaInline(level, chapter, 'theme')} title="Save">
                                          <i className="ri-check-line" />
                                        </button>
                                        <button className="cse-meta-cancel" onClick={cancelEditing} title="Cancel">
                                          <i className="ri-close-line" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div
                                        className="cse-meta-display"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEditing(`chapter-theme-${chapterKey}`, chapterTheme);
                                        }}
                                      >
                                        <span className={chapterTheme ? '' : 'cse-meta-placeholder'}>
                                          {chapterTheme || 'Click to set theme…'}
                                        </span>
                                        <i className="ri-pencil-line cse-meta-edit-icon" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Name */}
                                  <div className="cse-meta-row cse-meta-row-compact">
                                    <label className="cse-meta-label">
                                      <i className="ri-text" /> Name
                                    </label>
                                    {editingField === `chapter-name-${chapterKey}` ? (
                                      <div className="cse-meta-edit">
                                        <input
                                          type="text"
                                          className="cse-meta-input"
                                          value={editingValue}
                                          onInput={(e) => setEditingValue((e.target as HTMLInputElement).value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveChapterMetaInline(level, chapter, 'name');
                                            if (e.key === 'Escape') cancelEditing();
                                          }}
                                          autoFocus
                                          placeholder="e.g., Opening a Meeting"
                                        />
                                        <button className="cse-meta-save" onClick={() => saveChapterMetaInline(level, chapter, 'name')} title="Save">
                                          <i className="ri-check-line" />
                                        </button>
                                        <button className="cse-meta-cancel" onClick={cancelEditing} title="Cancel">
                                          <i className="ri-close-line" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div
                                        className="cse-meta-display"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEditing(`chapter-name-${chapterKey}`, chapterName);
                                        }}
                                      >
                                        <span className={chapterName ? '' : 'cse-meta-placeholder'}>
                                          {chapterName || 'Click to set name…'}
                                        </span>
                                        <i className="ri-pencil-line cse-meta-edit-icon" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Lessons */}
                              {expandedChapters.has(chapterKey) && (
                                <>
                                  {/* AI Generate Lessons */}
                                  <div className="cse-ai-generate-row cse-ai-generate-row-chapter">
                                    <button
                                      className="cse-ai-generate-btn cse-ai-generate-btn-sm"
                                      onClick={() => handleGenerateLessons(level, chapter)}
                                      disabled={generatingLessons === chapterKey}
                                    >
                                      {generatingLessons === chapterKey ? (
                                        <>
                                          <i className="ri-loader-4-line ri-spin" /> Generating…
                                        </>
                                      ) : (
                                        <>
                                          <i className="ri-magic-line" /> Generate Lessons with AI
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  <div className="cse-lessons-list">
                                    {chapterLessons.length > 0 ? (
                                      chapterLessons.map((lesson) => (
                                        <div
                                          className={`cse-lesson-row ${selectedLesson?.id === lesson.id ? 'selected' : ''} ${lesson.status === 'published' ? 'published' : ''}`}
                                          key={lesson.id}
                                          onClick={() => handleSelectLesson(lesson)}
                                        >
                                          <div className="cse-lesson-main">
                                            <span className={`cse-skill-dot cse-skill-${lesson.skill}`} />
                                            <span className="cse-lesson-number">L{lesson.lessonNumber}</span>
                                            <span className="cse-lesson-title">{lesson.lessonTitle}</span>
                                            {lesson.status === 'published' && (
                                              <span className="cse-published-badge">Published</span>
                                            )}
                                          </div>
                                          <div className="cse-lesson-actions">
                                            {lesson.status === 'draft' ? (
                                              <button
                                                className="cse-action-btn cse-action-publish"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handlePublishLesson(lesson);
                                                }}
                                                title="Publish"
                                              >
                                                <i className="ri-upload-cloud-line" />
                                              </button>
                                            ) : (
                                              <button
                                                className="cse-action-btn cse-action-unpublish"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleUnpublishLesson(lesson);
                                                }}
                                                title="Unpublish"
                                              >
                                                <i className="ri-download-cloud-line" />
                                              </button>
                                            )}
                                            <button
                                              className="cse-action-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditLesson(lesson);
                                              }}
                                              title="Edit"
                                            >
                                              <i className="ri-edit-line" />
                                            </button>
                                            <button
                                              className="cse-action-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handlePreviewLesson(lesson);
                                              }}
                                              title="Preview"
                                            >
                                              <i className="ri-eye-line" />
                                            </button>
                                            <button
                                              className="cse-action-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDuplicateLesson(lesson);
                                              }}
                                              title="Duplicate"
                                            >
                                              <i className="ri-file-copy-line" />
                                            </button>
                                            <button
                                              className="cse-action-btn cse-action-delete"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteLesson(lesson.id);
                                              }}
                                              title="Delete"
                                            >
                                              <i className="ri-delete-bin-line" />
                                            </button>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="cse-empty-chapter">
                                        <span>No lessons yet</span>
                                      </div>
                                    )}
                                    {chapterLessons.length < 10 && (
                                      <button className="cse-add-lesson-btn" onClick={() => setShowCreateModal(true)}>
                                        <i className="ri-add-line" />
                                        Add Lesson
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Analytics Panel */}
        <div className="cse-analytics-panel">
          {selectedLesson ? (
            <BELessonAnalytics lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />
          ) : (
            <BECourseAnalytics stats={courseStats} lessons={lessons} />
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <BECreateLessonModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateLesson} metadata={metadata} />
      )}

      {/* Admin Assignment Modal */}
      {showAssignModal && (
        <BEAssignmentModal
          assignments={assignments}
          onClose={() => setShowAssignModal(false)}
          onAssign={async (level, adminId, adminName) => {
            await assignLevelAdmin(COURSE_ID, level, adminId, adminName);
            await loadAssignments();
            toast.success(`Level ${level} assigned to ${adminName}`);
          }}
          onUnassign={async (level) => {
            await unassignLevelAdmin(COURSE_ID, level);
            await loadAssignments();
            toast.success(`Level ${level} unassigned`);
          }}
        />
      )}

      {/* AI Structure Preview Modal */}
      {structurePreview && (
        <BEStructurePreviewModal
          preview={structurePreview}
          onAccept={handleAcceptStructure}
          onReject={() => setStructurePreview(null)}
          onChange={(updated) => setStructurePreview(updated)}
        />
      )}

      {/* AI Lesson Preview Modal */}
      {lessonPreview && (
        <BELessonPreviewModal
          preview={lessonPreview}
          onAccept={handleAcceptLessons}
          onReject={() => setLessonPreview(null)}
          onChange={(updated) => setLessonPreview(updated)}
        />
      )}
    </div>
  );
}

// ============================================================================
// CREATE LESSON MODAL
// ============================================================================

function BECreateLessonModal({
  onClose,
  onCreate,
  metadata,
}: {
  onClose: () => void;
  onCreate: (input: CreateLessonInput) => void;
  metadata: CourseMetadata;
}) {
  const [form, setForm] = useState({
    level: 3,
    chapter: 1,
    lessonNumber: 1,
    skill: getSkillForLesson(1),
    lessonName: '',
    goalTextEn: '',
    goalTextJp: '',
  });
  const [loading, setLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState('');

  useEffect(() => {
    const checkDup = async () => {
      try {
        const exists = await checkDuplicate(COURSE_ID, form.level, form.chapter, form.lessonNumber, form.skill);
        setDuplicateWarning(
          exists
            ? `Level ${form.level}, Chapter ${form.chapter}, Lesson ${form.lessonNumber} (${form.skill}) already exists`
            : ''
        );
      } catch {
        // ignore
      }
    };
    checkDup();
  }, [form.level, form.chapter, form.lessonNumber, form.skill]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (duplicateWarning) {
      if (!confirm(`${duplicateWarning}. Do you want to create it anyway?`)) return;
    }
    if (!form.lessonName || !form.goalTextEn || !form.goalTextJp) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await onCreate({ course: COURSE_ID, ...form });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cse-modal-overlay" onClick={onClose}>
      <div className="cse-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cse-modal-header">
          <h2>Create New Business English Lesson</h2>
          <button className="cse-modal-close" onClick={onClose}>
            <i className="ri-close-line" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cse-modal-body">
            <div className="cse-form-row cse-form-row-4">
              <div className="cse-form-field">
                <label>Level</label>
                <select
                  value={form.level}
                  onChange={(e) => {
                    const newLevel = parseInt((e.target as HTMLSelectElement).value);
                    setForm({ ...form, level: newLevel });
                  }}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      Level {l} ({LEVEL_BADGES[l]})
                    </option>
                  ))}
                </select>
              </div>
              <div className="cse-form-field">
                <label>Chapter</label>
                <select
                  value={form.chapter}
                  onChange={(e) => setForm({ ...form, chapter: parseInt((e.target as HTMLSelectElement).value) })}
                >
                  {getChaptersForLevel(form.level).map((c) => (
                    <option key={c} value={c}>
                      Chapter {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cse-form-field">
                <label>Lesson</label>
                <select
                  value={form.lessonNumber}
                  onChange={(e) => {
                    const num = parseInt((e.target as HTMLSelectElement).value);
                    setForm({ ...form, lessonNumber: num, skill: getSkillForLesson(num) });
                  }}
                >
                  {LESSONS.map((l) => (
                    <option key={l} value={l}>
                      Lesson {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cse-form-field">
                <label>Skill</label>
                <div className="cse-skill-display">
                  <span className={`cse-skill-dot cse-skill-${form.skill}`} />
                  {form.skill.charAt(0).toUpperCase() + form.skill.slice(1)}
                </div>
              </div>
            </div>

            {duplicateWarning && (
              <div className="cse-warning">
                <i className="ri-error-warning-line" />
                {duplicateWarning}
              </div>
            )}

            <div className="cse-form-field">
              <label>Lesson Name</label>
              <input
                type="text"
                value={form.lessonName}
                onChange={(e) => setForm({ ...form, lessonName: (e.target as HTMLInputElement).value })}
                placeholder="e.g., Pleased to Meet You"
              />
            </div>

            <div className="cse-preview-labels">
              <p>
                <strong>Lesson Title:</strong> Lesson {form.lessonNumber}: {form.lessonName || '…'}
              </p>
            </div>

            <div className="cse-form-field">
              <label>Lesson Goal (English)</label>
              <input
                type="text"
                value={form.goalTextEn}
                onChange={(e) => setForm({ ...form, goalTextEn: (e.target as HTMLInputElement).value })}
                placeholder="e.g., I can introduce myself in a business setting."
              />
            </div>
            <div className="cse-form-field">
              <label>Lesson Goal (Korean)</label>
              <input
                type="text"
                value={form.goalTextJp}
                onChange={(e) => setForm({ ...form, goalTextJp: (e.target as HTMLInputElement).value })}
                placeholder="e.g., 비즈니스 상황에서 자기소개를 할 수 있다."
              />
            </div>
          </div>

          <div className="cse-modal-footer">
            <button type="button" className="cse-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cse-btn-primary bee-btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create Lesson'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// COURSE ANALYTICS
// ============================================================================

function BECourseAnalytics({
  stats,
  lessons,
}: {
  stats: {
    totalLessons: number;
    speakingCount: number;
    listeningCount: number;
    readingCount: number;
    writingCount: number;
    reviewCount: number;
    completedLevels: number;
    totalCapacity: number;
    progressPercent: number;
  };
  lessons: LessonMaterial[];
}) {
  return (
    <div className="cse-analytics">
      <div className="cse-analytics-header">
        <i className="ri-bar-chart-box-line" />
        <h3>Course Overview</h3>
      </div>

      {/* Progress Circle */}
      <div className="cse-progress-section">
        <div className="cse-progress-circle">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" className="cse-progress-bg" />
            <circle
              cx="50"
              cy="50"
              r="42"
              className="cse-progress-fill bee-progress-fill"
              style={{ strokeDasharray: `${stats.progressPercent * 2.64} 264` }}
            />
          </svg>
          <div className="cse-progress-text">
            <span className="cse-progress-value">{stats.progressPercent}%</span>
            <span className="cse-progress-label">Complete</span>
          </div>
        </div>
        <p className="cse-progress-detail">
          {stats.totalLessons} of {stats.totalCapacity} lessons created
        </p>
      </div>

      {/* Skill Distribution */}
      <div className="cse-stats-section">
        <h4>Skill Distribution</h4>
        <div className="cse-skill-bars">
          {[
            { key: 'listening', label: 'Listening', count: stats.listeningCount },
            { key: 'speaking', label: 'Speaking', count: stats.speakingCount },
            { key: 'reading', label: 'Reading', count: stats.readingCount },
            { key: 'writing', label: 'Writing', count: stats.writingCount },
            { key: 'review', label: 'Review', count: stats.reviewCount },
          ].map((item) => (
            <div className="cse-skill-bar-item" key={item.key}>
              <div className="cse-skill-bar-header">
                <span className="cse-skill-bar-label">
                  <span className={`cse-skill-dot cse-skill-${item.key}`} />
                  {item.label}
                </span>
                <span className="cse-skill-bar-value">{item.count}</span>
              </div>
              <div className="cse-skill-bar-track">
                <div
                  className={`cse-skill-bar-fill ${item.key}`}
                  style={{ width: `${stats.totalLessons ? (item.count / stats.totalLessons) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="cse-stats-section">
        <h4>Quick Stats</h4>
        <div className="cse-quick-stats">
          <div className="cse-quick-stat">
            <i className="ri-stack-line" />
            <div>
              <span className="cse-quick-stat-value">8</span>
              <span className="cse-quick-stat-label">Levels</span>
            </div>
          </div>
          <div className="cse-quick-stat">
            <i className="ri-book-2-line" />
            <div>
              <span className="cse-quick-stat-value">40</span>
              <span className="cse-quick-stat-label">Chapters</span>
            </div>
          </div>
          <div className="cse-quick-stat">
            <i className="ri-file-list-3-line" />
            <div>
              <span className="cse-quick-stat-value">{stats.totalLessons}</span>
              <span className="cse-quick-stat-label">Lessons</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recently Updated */}
      <div className="cse-stats-section">
        <h4>Recently Updated</h4>
        <div className="cse-recent-list">
          {lessons.slice(0, 5).map((lesson) => (
            <div className="cse-recent-item" key={lesson.id}>
              <span className={`cse-skill-dot cse-skill-${lesson.skill}`} />
              <span className="cse-recent-title">{lesson.lessonTitle}</span>
              <span className="cse-recent-date">{new Date(lesson.updatedAt).toLocaleDateString()}</span>
            </div>
          ))}
          {lessons.length === 0 && <p className="cse-empty-recent">No lessons yet</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LESSON ANALYTICS
// ============================================================================

function BELessonAnalytics({ lesson, onClose }: { lesson: LessonMaterial; onClose: () => void }) {
  const skillColors: Record<string, string> = {
    speaking: '#3b82f6',
    listening: '#8b5cf6',
    reading: '#10b981',
    writing: '#f59e0b',
  };

  return (
    <div className="cse-analytics">
      <div className="cse-analytics-header">
        <i className="ri-line-chart-line" />
        <h3>Lesson Details</h3>
        <button className="cse-analytics-close" onClick={onClose}>
          <i className="ri-close-line" />
        </button>
      </div>

      <div className="cse-lesson-info-card">
        <div className="cse-lesson-info-badge" style={{ backgroundColor: skillColors[lesson.skill] || '#6b7280' }}>
          {lesson.skill}
        </div>
        <h4>{lesson.lessonTitle}</h4>
        <p className="cse-lesson-info-chapter">{lesson.chapterLabel}</p>
        <div className="cse-lesson-info-meta">
          <span className="cse-lesson-info-level">{lesson.levelBadge}</span>
          <span>Level {lesson.level}</span>
          <span className="bee-method-tag">{LEVEL_METHOD[lesson.level]}</span>
        </div>
      </div>

      {/* Content Status */}
      <div className="cse-stats-section">
        <h4>Template Sections</h4>
        <div className="cse-content-status">
          {[
            { name: 'Set the Scene', icon: 'ri-map-pin-line', done: !!lesson.introductionData },
            { name: 'Explore', icon: 'ri-compass-3-line', done: !!lesson.learnData },
            { name: 'Break It Down', icon: 'ri-puzzle-line', done: !!lesson.stepBData },
            { name: 'Hands-On', icon: 'ri-hand-heart-line', done: !!lesson.applyData },
            { name: 'Go Live', icon: 'ri-live-line', done: !!lesson.exerciseData },
            { name: 'Wrap-Up', icon: 'ri-flag-line', done: !!lesson.feedbackData },
          ].map((section) => (
            <div className={`cse-status-item ${section.done ? 'complete' : 'incomplete'}`} key={section.name}>
              <i className={section.done ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
              <span>{section.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Time Stats */}
      <div className="cse-stats-section">
        <h4>Time Metrics</h4>
        <div className="cse-time-stats">
          <div className="cse-time-stat">
            <i className="ri-calendar-line" />
            <div>
              <span className="cse-time-value">{new Date(lesson.createdAt).toLocaleDateString()}</span>
              <span className="cse-time-label">Created</span>
            </div>
          </div>
          <div className="cse-time-stat">
            <i className="ri-refresh-line" />
            <div>
              <span className="cse-time-value">{new Date(lesson.updatedAt).toLocaleDateString()}</span>
              <span className="cse-time-label">Last Updated</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ADMIN ASSIGNMENT MODAL
// ============================================================================

function BEAssignmentModal({
  assignments,
  onClose,
  onAssign,
  onUnassign,
}: {
  assignments: Record<number, LevelAssignment>;
  onClose: () => void;
  onAssign: (level: number, adminId: string, adminName: string) => Promise<void>;
  onUnassign: (level: number) => Promise<void>;
}) {
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await authApi.listAdmins();
        setAdmins(list);
      } catch {
        toast.error('Failed to load admin list');
      } finally {
        setLoadingAdmins(false);
      }
    })();
  }, []);

  const handleChange = async (level: number, adminId: string) => {
    setSaving(level);
    try {
      if (adminId === '') {
        await onUnassign(level);
      } else {
        const admin = admins.find((a) => a.id === adminId);
        const name = admin ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.username : '';
        await onAssign(level, adminId, name);
      }
    } catch {
      toast.error('Failed to update assignment');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="cse-modal-overlay" onClick={onClose}>
      <div className="cse-modal cse-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="cse-modal-header">
          <h2>
            <i className="ri-user-settings-line" /> Manage Level Assignments
          </h2>
          <button className="cse-modal-close" onClick={onClose}>
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="cse-modal-body">
          <p className="cse-assign-description">Assign admins to Business English levels.</p>
          {loadingAdmins ? (
            <div className="cse-loading">
              <i className="ri-loader-4-line" /> Loading admins…
            </div>
          ) : (
            <div className="cse-assign-grid">
              {LEVELS.map((level) => (
                <div className="cse-assign-row" key={level}>
                  <div className="cse-assign-level">
                    <span className="cse-level-badge" style={{ backgroundColor: LEVEL_COLORS[level] }}>
                      {LEVEL_BADGES[level]}
                    </span>
                    <span>Level {level}</span>
                  </div>
                  <select
                    className="cse-assign-select"
                    value={assignments[level]?.adminId || ''}
                    onChange={(e) => handleChange(level, (e.target as HTMLSelectElement).value)}
                    disabled={saving === level}
                  >
                    <option value="">— Unassigned —</option>
                    {admins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {`${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.username}
                        {admin.role === 'superadmin' ? ' (Super Admin)' : ''}
                      </option>
                    ))}
                  </select>
                  {saving === level && <i className="ri-loader-4-line ri-spin" />}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="cse-modal-footer">
          <button type="button" className="cse-btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AI STRUCTURE PREVIEW MODAL
// ============================================================================

function BEStructurePreviewModal({
  preview,
  onAccept,
  onReject,
  onChange,
}: {
  preview: { level: number; mainTopic: string; chapters: CourseStructureChapter[] };
  onAccept: () => Promise<void> | void;
  onReject: () => void;
  onChange: (updated: { level: number; mainTopic: string; chapters: CourseStructureChapter[] }) => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    setSaving(true);
    try {
      await onAccept();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cse-modal-overlay" onClick={saving ? undefined : onReject}>
      <div className="cse-modal cse-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="cse-modal-header cse-modal-header-ai">
          <h2>
            <i className="ri-magic-line" /> AI-Generated Structure — Level {preview.level}
          </h2>
          <button className="cse-modal-close" onClick={onReject} disabled={saving}>
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="cse-modal-body">
          {saving ? (
            <div className="cse-saving-overlay">
              <i className="ri-loader-4-line ri-spin" />
              <span>Saving structure…</span>
            </div>
          ) : (
            <>
              <p className="cse-ai-review-hint">Review and edit the generated structure. Click Accept to save.</p>
              <div className="cse-form-field">
                <label>Level Main Topic</label>
                <input
                  type="text"
                  value={preview.mainTopic}
                  onInput={(e) => onChange({ ...preview, mainTopic: (e.target as HTMLInputElement).value })}
                />
              </div>
              <div className="cse-ai-chapters-list">
                {preview.chapters.map((ch, idx) => (
                  <div className="cse-ai-chapter-card" key={ch.chapter}>
                    <div className="cse-ai-chapter-num">Chapter {ch.chapter}</div>
                    <div className="cse-form-field">
                      <label>Theme</label>
                      <input
                        type="text"
                        value={ch.theme}
                        onInput={(e) => {
                          const updated = [...preview.chapters];
                          updated[idx] = { ...ch, theme: (e.target as HTMLInputElement).value };
                          onChange({ ...preview, chapters: updated });
                        }}
                      />
                    </div>
                    <div className="cse-form-field">
                      <label>Name</label>
                      <input
                        type="text"
                        value={ch.name}
                        onInput={(e) => {
                          const updated = [...preview.chapters];
                          updated[idx] = { ...ch, name: (e.target as HTMLInputElement).value };
                          onChange({ ...preview, chapters: updated });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="cse-modal-footer">
          <button type="button" className="cse-btn-secondary" onClick={onReject} disabled={saving}>
            Discard
          </button>
          <button type="button" className="cse-btn-primary cse-btn-ai" onClick={handleAccept} disabled={saving}>
            {saving ? (
              <>
                <i className="ri-loader-4-line ri-spin" /> Saving…
              </>
            ) : (
              <>
                <i className="ri-check-line" /> Accept &amp; Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AI LESSON PREVIEW MODAL
// ============================================================================

function BELessonPreviewModal({
  preview,
  onAccept,
  onReject,
  onChange,
}: {
  preview: { level: number; chapter: number; lessons: LessonStructureItem[] };
  onAccept: () => Promise<void> | void;
  onReject: () => void;
  onChange: (updated: { level: number; chapter: number; lessons: LessonStructureItem[] }) => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    setSaving(true);
    try {
      await onAccept();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cse-modal-overlay" onClick={saving ? undefined : onReject}>
      <div className="cse-modal cse-modal-wide cse-modal-tall" onClick={(e) => e.stopPropagation()}>
        <div className="cse-modal-header cse-modal-header-ai">
          <h2>
            <i className="ri-magic-line" /> AI-Generated Lessons — Level {preview.level}, Chapter {preview.chapter}
          </h2>
          <button className="cse-modal-close" onClick={onReject} disabled={saving}>
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="cse-modal-body">
          {saving ? (
            <div className="cse-saving-overlay">
              <i className="ri-loader-4-line ri-spin" />
              <span>Creating lessons…</span>
            </div>
          ) : (
            <>
              <p className="cse-ai-review-hint">
                Review and edit the generated lessons. Each lesson's skill is auto-assigned in the fixed
                Business English order: Listening → Reading → Speaking → Speaking → Review.
                Existing lessons will be skipped.
              </p>
              <div className="cse-ai-lessons-list">
                {preview.lessons.map((lesson, idx) => (
                  <div className="cse-ai-lesson-card" key={lesson.lessonNumber}>
                    <div className="cse-ai-lesson-num">
                      Lesson {lesson.lessonNumber}
                      <span className={`cse-skill-dot cse-skill-${getSkillForLesson(lesson.lessonNumber)}`} style={{ marginLeft: 8 }} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#a1a1aa', marginLeft: 4 }}>
                        {getSkillForLesson(lesson.lessonNumber).charAt(0).toUpperCase() + getSkillForLesson(lesson.lessonNumber).slice(1)}
                      </span>
                    </div>
                    <div className="cse-form-row cse-form-row-2">
                      <div className="cse-form-field">
                        <label>Lesson Name</label>
                        <input
                          type="text"
                          value={lesson.lessonName}
                          onInput={(e) => {
                            const updated = [...preview.lessons];
                            updated[idx] = { ...lesson, lessonName: (e.target as HTMLInputElement).value };
                            onChange({ ...preview, lessons: updated });
                          }}
                        />
                      </div>
                      <div className="cse-form-field">
                        <label>Goal (English)</label>
                        <input
                          type="text"
                          value={lesson.goalTextEn}
                          onInput={(e) => {
                            const updated = [...preview.lessons];
                            updated[idx] = { ...lesson, goalTextEn: (e.target as HTMLInputElement).value };
                            onChange({ ...preview, lessons: updated });
                          }}
                        />
                      </div>
                    </div>
                    <div className="cse-form-field">
                      <label>Goal (Korean)</label>
                      <input
                        type="text"
                        value={lesson.goalTextJp}
                        onInput={(e) => {
                          const updated = [...preview.lessons];
                          updated[idx] = { ...lesson, goalTextJp: (e.target as HTMLInputElement).value };
                          onChange({ ...preview, lessons: updated });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="cse-modal-footer">
          <button type="button" className="cse-btn-secondary" onClick={onReject} disabled={saving}>
            Discard
          </button>
          <button type="button" className="cse-btn-primary cse-btn-ai" onClick={handleAccept} disabled={saving}>
            {saving ? (
              <>
                <i className="ri-loader-4-line ri-spin" /> Creating…
              </>
            ) : (
              <>
                <i className="ri-check-line" /> Accept &amp; Create Lessons
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
