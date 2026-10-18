/**
 * ConversationalSkillsEditorPage
 * No-code editor for creating Conversational Skills lesson materials
 * Hierarchical view: 10 Levels → 10 Chapters → 10 Lessons per chapter
 */
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import {
  createLesson,
  getLessonById,
  listLessonsByCourse,
  getExistingChapterName,
  checkDuplicate,
  updateLessonHeader,
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
import './ConversationalSkillsEditorPage.css';

// ============================================================================
// CONSTANTS
// ============================================================================

const COURSE_ID = 'conversational-skills';
const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);
const CHAPTERS = Array.from({ length: 5 }, (_, i) => i + 1);
const LESSONS = Array.from({ length: 10 }, (_, i) => i + 1);

/** Level 1 has only 1 chapter; all other levels have 5 */
const getChaptersForLevel = (level: number): number[] =>
  level === 1 ? [1] : CHAPTERS;
const SKILLS: { value: Skill; label: string }[] = [
  { value: 'speaking', label: 'Speaking' },
  { value: 'listening', label: 'Listening' },
  { value: 'reading', label: 'Reading' },
];

const LEVEL_BADGES: Record<number, string> = {
  1: 'STARTER', 2: 'STARTER',
  3: 'BEGINNER', 4: 'BEGINNER',
  5: 'ELEMENTARY', 6: 'ELEMENTARY',
  7: 'INTERMEDIATE', 8: 'INTERMEDIATE',
  9: 'ADVANCED', 10: 'ADVANCED',
};

const LEVEL_COLORS: Record<number, string> = {
  1: '#10b981', 2: '#10b981',  // Green - Starter
  3: '#3b82f6', 4: '#3b82f6',  // Blue - Beginner
  5: '#8b5cf6', 6: '#8b5cf6',  // Purple - Elementary
  7: '#f59e0b', 8: '#f59e0b',  // Amber - Intermediate
  9: '#ef4444', 10: '#ef4444', // Red - Advanced
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ConversationalSkillsEditorPage() {
  const { user } = useAuthContext();
  const isSuperAdmin = user?.role === 'superadmin';

  const [lessons, setLessons] = useState<LessonMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [selectedLesson, setSelectedLesson] = useState<LessonMaterial | null>(null);

  // Course metadata: level topics + chapter themes/names
  const [metadata, setMetadata] = useState<CourseMetadata>({ levels: {}, chapters: {} });
  // Inline-editing tracking
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Level admin assignments
  const [assignments, setAssignments] = useState<Record<number, LevelAssignment>>({});
  const [showAssignModal, setShowAssignModal] = useState(false);

  // AI Generation state
  const [generatingStructure, setGeneratingStructure] = useState<number | null>(null); // level being generated
  const [structurePreview, setStructurePreview] = useState<{
    level: number;
    mainTopic: string;
    chapters: CourseStructureChapter[];
  } | null>(null);
  const [generatingLessons, setGeneratingLessons] = useState<string | null>(null); // "level-chapter" key
  const [lessonPreview, setLessonPreview] = useState<{
    level: number;
    chapter: number;
    lessons: LessonStructureItem[];
  } | null>(null);

  // Load lessons + metadata + assignments on mount
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
    } catch (error) {
      console.error('Failed to load lessons:', error);
      toast.error('Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  const loadMetadata = async () => {
    try {
      const data = await getCourseMetadata(COURSE_ID);
      setMetadata(data);
    } catch (error) {
      console.error('Failed to load course metadata:', error);
    }
  };

  const loadAssignments = async () => {
    try {
      const data = await getLevelAssignments(COURSE_ID);
      setAssignments(data);
    } catch (error) {
      console.error('Failed to load level assignments:', error);
    }
  };

  // ----- AI Generation Handlers -----
  const handleGenerateStructure = async (level: number) => {
    setGeneratingStructure(level);
    try {
      const existingTopic = metadata.levels[level]?.mainTopic || null;
      const chapterKeys = getChaptersForLevel(level);
      const existingChapters = chapterKeys.map(c => {
        const key = `${level}-${c}`;
        const ch = metadata.chapters[key];
        return { chapter: c, theme: ch?.theme, name: ch?.name };
      }).filter(c => c.theme || c.name);

      const result = await generateCourseStructure(level, existingTopic, existingChapters.length > 0 ? existingChapters : null);
      if (result.success && result.data) {
        setStructurePreview({ level, ...result.data });
      } else {
        toast.error(result.error || 'Failed to generate structure');
      }
    } catch (error) {
      toast.error('Failed to generate structure');
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
      // Reload metadata + lessons (chapter names propagated)
      await loadMetadata();
      await loadLessons();
      toast.success('Course structure saved!');
    } catch (error) {
      toast.error('Failed to save structure');
    } finally {
      setStructurePreview(null);
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

      const result = await generateLessonStructure(level, chapter, levelTopic, chapterMeta.theme, chapterMeta.name);
      if (result.success && result.data) {
        setLessonPreview({ level, chapter, lessons: result.data.lessons });
      } else {
        toast.error(result.error || 'Failed to generate lessons');
      }
    } catch (error) {
      toast.error('Failed to generate lessons');
    } finally {
      setGeneratingLessons(null);
    }
  };

  const handleAcceptLessons = async () => {
    if (!lessonPreview) return;
    const { level, chapter, lessons: generatedLessons } = lessonPreview;

    try {
      let created = 0;
      for (const gl of generatedLessons) {
        // Create for each skill type
        for (const skill of ['speaking', 'listening', 'reading'] as Skill[]) {
          try {
            const exists = await checkDuplicate(COURSE_ID, level, chapter, gl.lessonNumber, skill);
            if (exists) continue;

            await createLesson({
              course: COURSE_ID,
              level,
              chapter,
              lessonNumber: gl.lessonNumber,
              skill,
              lessonName: gl.lessonName,
              goalTextEn: gl.goalTextEn,
              goalTextJp: gl.goalTextJp,
            });
            created++;
          } catch (error) {
            console.error(`Failed to create L${level}-C${chapter}-${gl.lessonNumber}-${skill}:`, error);
          }
        }
      }

      await loadLessons();
      setExpandedLevels(prev => new Set([...prev, level]));
      setExpandedChapters(prev => new Set([...prev, `${level}-${chapter}`]));
      toast.success(`Created ${created} lessons!`);
    } catch (error) {
      toast.error('Failed to create lessons');
    } finally {
      setLessonPreview(null);
    }
  };

  // ----- Inline editing helpers -----
  const startEditing = (fieldKey: string, currentValue: string) => {
    setEditingField(fieldKey);
    setEditingValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditingValue('');
  };

  const saveLevelTopicInline = async (level: number) => {
    try {
      await saveLevelTopic(COURSE_ID, level, editingValue);
      setMetadata(prev => ({
        ...prev,
        levels: { ...prev.levels, [level]: { mainTopic: editingValue } },
      }));
      toast.success('Level topic saved');
    } catch (error) {
      toast.error('Failed to save level topic');
    } finally {
      cancelEditing();
    }
  };

  const saveChapterMetaInline = async (level: number, chapter: number, field: 'theme' | 'name') => {
    const key = `${level}-${chapter}`;
    const existing = metadata.chapters[key] || { theme: '', name: '' };
    const updated = { ...existing, [field]: editingValue };

    try {
      await saveChapterMeta(COURSE_ID, level, chapter, { [field]: editingValue });
      setMetadata(prev => ({
        ...prev,
        chapters: { ...prev.chapters, [key]: updated },
      }));
      // If name was updated, reload lessons so chapterLabel is refreshed
      if (field === 'name') {
        await loadLessons();
      }
      toast.success(field === 'theme' ? 'Chapter theme saved' : 'Chapter name saved');
    } catch (error) {
      toast.error(`Failed to save chapter ${field}`);
    } finally {
      cancelEditing();
    }
  };

  // Helper to get metadata-stored chapter name (used by create modal auto-fill)
  const getMetadataChapterName = (level: number, chapter: number): string => {
    const key = `${level}-${chapter}`;
    return metadata.chapters[key]?.name || '';
  };

  // Group lessons by level and chapter
  const lessonsByLevelChapter = useMemo(() => {
    const map: Record<string, LessonMaterial[]> = {};
    lessons.forEach(lesson => {
      const key = `${lesson.level}-${lesson.chapter}`;
      if (!map[key]) map[key] = [];
      map[key].push(lesson);
    });
    // Sort lessons within each chapter
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => a.lessonNumber - b.lessonNumber);
    });
    return map;
  }, [lessons]);

  // Get chapter name from first lesson in that chapter
  const getChapterName = (level: number, chapter: number): string => {
    const key = `${level}-${chapter}`;
    const chapterLessons = lessonsByLevelChapter[key];
    if (chapterLessons && chapterLessons.length > 0) {
      // Extract chapter name from chapterLabel (e.g., "Chapter 1: All About Me")
      const match = chapterLessons[0].chapterLabel.match(/Chapter \d+:\s*(.*)/);
      return match ? match[1] : '';
    }
    return '';
  };

  // Count lessons in a level
  const getLevelLessonCount = (level: number): number => {
    return lessons.filter(l => l.level === level).length;
  };

  // Count lessons in a chapter
  const getChapterLessonCount = (level: number, chapter: number): number => {
    const key = `${level}-${chapter}`;
    return lessonsByLevelChapter[key]?.length || 0;
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

  const toggleChapter = (level: number, chapter: number) => {
    const key = `${level}-${chapter}`;
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleCreateLesson = async (input: CreateLessonInput) => {
    try {
      const lesson = await createLesson(input);
      setLessons([...lessons, lesson]);
      setShowCreateModal(false);
      // Expand to show the newly created lesson
      setExpandedLevels(prev => new Set([...prev, lesson.level]));
      setExpandedChapters(prev => new Set([...prev, `${lesson.level}-${lesson.chapter}`]));
      toast.success('Lesson created successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create lesson');
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return;
    
    try {
      await deleteLesson(id);
      setLessons(lessons.filter(l => l.id !== id));
      toast.success('Lesson deleted');
    } catch (error) {
      toast.error('Failed to delete lesson');
    }
  };

  const handleDuplicateLesson = async (lesson: LessonMaterial) => {
    try {
      const duplicated = await duplicateLesson(lesson.id);
      setLessons([...lessons, duplicated]);
      // Expand to show the duplicated lesson
      setExpandedLevels(prev => new Set([...prev, duplicated.level]));
      setExpandedChapters(prev => new Set([...prev, `${duplicated.level}-${duplicated.chapter}`]));
      toast.success('Lesson duplicated!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to duplicate lesson');
    }
  };

  const handleEditLesson = (lesson: LessonMaterial) => {
    window.open(`/conversational-skills-visual-editor/${lesson.id}`, '_blank');
  };

  const handlePreviewLesson = (lesson: LessonMaterial) => {
    window.open(`/conversational-skills-preview/${lesson.id}`, '_blank');
  };

  const handlePublishLesson = async (lesson: LessonMaterial) => {
    try {
      const updated = await publishLesson(lesson.id);
      setLessons(lessons.map(l => l.id === lesson.id ? updated : l));
      if (selectedLesson?.id === lesson.id) {
        setSelectedLesson(updated);
      }
      toast.success('Lesson published! It will now appear in student/tutor apps.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to publish lesson');
    }
  };

  const handleUnpublishLesson = async (lesson: LessonMaterial) => {
    try {
      const updated = await unpublishLesson(lesson.id);
      setLessons(lessons.map(l => l.id === lesson.id ? updated : l));
      if (selectedLesson?.id === lesson.id) {
        setSelectedLesson(updated);
      }
      toast.success('Lesson unpublished. It will no longer appear in student/tutor apps.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to unpublish lesson');
    }
  };

  const handleSelectLesson = (lesson: LessonMaterial) => {
    setSelectedLesson(prev => prev?.id === lesson.id ? null : lesson);
  };

  // Computed stats for analytics
  const courseStats = useMemo(() => {
    const totalLessons = lessons.length;
    const speakingCount = lessons.filter(l => l.skill === 'speaking').length;
    const listeningCount = lessons.filter(l => l.skill === 'listening').length;
    const readingCount = lessons.filter(l => l.skill === 'reading').length;
    const completedLevels = LEVELS.filter(level => 
      getLevelLessonCount(level) >= 50 // 5 chapters × 10 lessons
    ).length;
    
    return {
      totalLessons,
      speakingCount,
      listeningCount,
      readingCount,
      completedLevels,
      totalCapacity: 500, // 10 levels × 5 chapters × 10 lessons
      progressPercent: Math.round((totalLessons / 500) * 100),
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
              <i className="ri-chat-smile-3-line" />
            </div>
            <div>
              <h1>Conversational Skills</h1>
              <p>{lessons.length} lessons across 10 levels</p>
            </div>
          </div>
          <button className="cse-create-btn" onClick={() => setShowCreateModal(true)}>
            <i className="ri-add-line" />
            Create Lesson
          </button>
          {isSuperAdmin && (
            <button className="cse-assign-btn" onClick={() => setShowAssignModal(true)}>
              <i className="ri-user-settings-line" />
              Manage Assignments
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="cse-main-layout">
        {/* Left: Accordion Container */}
        <div className="cse-accordion-container">
          <div className="cse-accordion">
            {loading ? (
              <div className="cse-loading">
                <i className="ri-loader-4-line" />
                Loading lessons...
              </div>
            ) : (
              LEVELS.map(level => (
                <div className="cse-level" key={level}>
                  {/* Level Header */}
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
                      {/* Level Main Topic (inline) */}
                      {metadata.levels[level]?.mainTopic && (
                        <span className="cse-level-topic">{metadata.levels[level].mainTopic}</span>
                      )}
                      {/* Assigned admin badge */}
                      {assignments[level] && (
                        <span className="cse-assigned-badge" title={`Assigned to ${assignments[level].adminName}`}>
                          <i className="ri-user-line" /> {assignments[level].adminName}
                        </span>
                      )}
                    </div>
                    <span className="cse-level-count">
                      {getLevelLessonCount(level)} lesson{getLevelLessonCount(level) !== 1 ? 's' : ''}
                    </span>
                  </button>

                  {/* Expanded: Level metadata editor + Chapters */}
                  {expandedLevels.has(level) && (
                    <>
                      {/* Level Main Topic Editor */}
                      <div className="cse-meta-row">
                        <label className="cse-meta-label"><i className="ri-lightbulb-line" /> Main Topic</label>
                        {editingField === `level-topic-${level}` ? (
                          <div className="cse-meta-edit">
                            <input
                              type="text"
                              className="cse-meta-input"
                              value={editingValue}
                              onInput={e => setEditingValue((e.target as HTMLInputElement).value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveLevelTopicInline(level);
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              autoFocus
                              placeholder="e.g., Self-Introduction & Daily Life"
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
                            onClick={(e) => { e.stopPropagation(); startEditing(`level-topic-${level}`, metadata.levels[level]?.mainTopic || ''); }}
                          >
                            <span className={metadata.levels[level]?.mainTopic ? '' : 'cse-meta-placeholder'}>
                              {metadata.levels[level]?.mainTopic || 'Click to set main topic…'}
                            </span>
                            <i className="ri-pencil-line cse-meta-edit-icon" />
                          </div>
                        )}
                      </div>

                      {/* AI Generate Structure Button */}
                      <div className="cse-ai-generate-row">
                        <button
                          className="cse-ai-generate-btn"
                          onClick={() => handleGenerateStructure(level)}
                          disabled={generatingStructure === level}
                        >
                          {generatingStructure === level ? (
                            <><i className="ri-loader-4-line ri-spin" /> Generating...</>
                          ) : (
                            <><i className="ri-magic-line" /> Generate Structure with AI</>
                          )}
                        </button>
                        <span className="cse-ai-generate-hint">
                          Generates main topic + chapter themes & names
                        </span>
                      </div>

                      <div className="cse-chapters">
                      {getChaptersForLevel(level).map(chapter => {
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
                                {chapterTheme && (
                                  <span className="cse-chapter-theme">{chapterTheme}</span>
                                )}
                                {chapterName && (
                                  <span className="cse-chapter-name">{chapterName}</span>
                                )}
                              </div>
                              <span className="cse-chapter-count">
                                {getChapterLessonCount(level, chapter)}/10
                              </span>
                            </button>

                            {/* Chapter metadata editors (shown when chapter is expanded) */}
                            {expandedChapters.has(chapterKey) && (
                              <div className="cse-chapter-meta-editors">
                                {/* Chapter Theme */}
                                <div className="cse-meta-row cse-meta-row-compact">
                                  <label className="cse-meta-label"><i className="ri-bookmark-line" /> Theme</label>
                                  {editingField === `chapter-theme-${chapterKey}` ? (
                                    <div className="cse-meta-edit">
                                      <input
                                        type="text"
                                        className="cse-meta-input"
                                        value={editingValue}
                                        onInput={e => setEditingValue((e.target as HTMLInputElement).value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') saveChapterMetaInline(level, chapter, 'theme');
                                          if (e.key === 'Escape') cancelEditing();
                                        }}
                                        autoFocus
                                        placeholder="e.g., Getting to Know People"
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
                                      onClick={(e) => { e.stopPropagation(); startEditing(`chapter-theme-${chapterKey}`, chapterTheme); }}
                                    >
                                      <span className={chapterTheme ? '' : 'cse-meta-placeholder'}>
                                        {chapterTheme || 'Click to set theme…'}
                                      </span>
                                      <i className="ri-pencil-line cse-meta-edit-icon" />
                                    </div>
                                  )}
                                </div>

                                {/* Chapter Name */}
                                <div className="cse-meta-row cse-meta-row-compact">
                                  <label className="cse-meta-label"><i className="ri-text" /> Name</label>
                                  {editingField === `chapter-name-${chapterKey}` ? (
                                    <div className="cse-meta-edit">
                                      <input
                                        type="text"
                                        className="cse-meta-input"
                                        value={editingValue}
                                        onInput={e => setEditingValue((e.target as HTMLInputElement).value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') saveChapterMetaInline(level, chapter, 'name');
                                          if (e.key === 'Escape') cancelEditing();
                                        }}
                                        autoFocus
                                        placeholder="e.g., The First Meeting"
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
                                      onClick={(e) => { e.stopPropagation(); startEditing(`chapter-name-${chapterKey}`, chapterName); }}
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
                                {/* AI Generate Lessons Button */}
                                <div className="cse-ai-generate-row cse-ai-generate-row-chapter">
                                  <button
                                    className="cse-ai-generate-btn cse-ai-generate-btn-sm"
                                    onClick={() => handleGenerateLessons(level, chapter)}
                                    disabled={generatingLessons === chapterKey}
                                  >
                                    {generatingLessons === chapterKey ? (
                                      <><i className="ri-loader-4-line ri-spin" /> Generating...</>
                                    ) : (
                                      <><i className="ri-magic-line" /> Generate Lessons with AI</>
                                    )}
                                  </button>
                                </div>

                                <div className="cse-lessons-list">
                                {chapterLessons.length > 0 ? (
                                  chapterLessons.map(lesson => (
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
                                          onClick={(e) => { e.stopPropagation(); handlePreviewLesson(lesson); }}
                                          title="Preview"
                                        >
                                          <i className="ri-eye-line" />
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
                                    <span>No lessons yet</span>
                                    <button 
                                      className="cse-add-lesson-btn"
                                      onClick={() => setShowCreateModal(true)}
                                    >
                                      <i className="ri-add-line" />
                                      Add Lesson
                                    </button>
                                  </div>
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
            // Lesson-specific analytics
            <LessonAnalytics lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />
          ) : (
            // Course-wide analytics
            <CourseAnalytics stats={courseStats} lessons={lessons} />
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateLessonModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateLesson}
          metadata={metadata}
        />
      )}

      {/* Admin Assignment Modal */}
      {showAssignModal && (
        <AssignmentModal
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
        <StructurePreviewModal
          preview={structurePreview}
          onAccept={handleAcceptStructure}
          onReject={() => setStructurePreview(null)}
          onChange={(updated) => setStructurePreview(updated)}
        />
      )}

      {/* AI Lesson Preview Modal */}
      {lessonPreview && (
        <LessonPreviewModal
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

function CreateLessonModal({
  onClose,
  onCreate,
  metadata,
}: {
  onClose: () => void;
  onCreate: (input: CreateLessonInput) => void;
  metadata: CourseMetadata;
}) {
  const [form, setForm] = useState({
    level: 1,
    chapter: 1,
    lessonNumber: 1,
    skill: 'speaking' as Skill,
    lessonName: '',
    goalTextEn: '',
    goalTextJp: '',
  });
  const [loading, setLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState('');

  // Check for duplicate when selection changes
  useEffect(() => {
    const checkDup = async () => {
      try {
        const exists = await checkDuplicate(
          COURSE_ID,
          form.level,
          form.chapter,
          form.lessonNumber,
          form.skill
        );
        if (exists) {
          setDuplicateWarning(
            `Level ${form.level}, Chapter ${form.chapter}, Lesson ${form.lessonNumber} (${form.skill}) already exists`
          );
        } else {
          setDuplicateWarning('');
        }
      } catch (error) {
        console.error('Failed to check duplicate:', error);
      }
    };
    checkDup();
  }, [form.level, form.chapter, form.lessonNumber, form.skill]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (duplicateWarning) {
      toast.error('This lesson combination already exists');
      return;
    }
    if (!form.lessonName || !form.goalTextEn || !form.goalTextJp) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await onCreate({
        course: COURSE_ID,
        ...form,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cse-modal-overlay" onClick={onClose}>
      <div className="cse-modal" onClick={e => e.stopPropagation()}>
        <div className="cse-modal-header">
          <h2>Create New Lesson</h2>
          <button className="cse-modal-close" onClick={onClose}>
            <i className="ri-close-line" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cse-modal-body">
            {/* Dropdowns Row */}
            <div className="cse-form-row cse-form-row-4">
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
                <label>Chapter</label>
                <select
                  value={form.chapter}
                  onChange={e => setForm({ ...form, chapter: parseInt((e.target as HTMLSelectElement).value) })}
                >
                  {getChaptersForLevel(form.level).map(c => (
                    <option key={c} value={c}>Chapter {c}</option>
                  ))}
                </select>
              </div>
              <div className="cse-form-field">
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
              <div className="cse-form-field">
                <label>Skill</label>
                <select
                  value={form.skill}
                  onChange={e => setForm({ ...form, skill: (e.target as HTMLSelectElement).value as Skill })}
                >
                  {SKILLS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Duplicate Warning */}
            {duplicateWarning && (
              <div className="cse-warning">
                <i className="ri-error-warning-line" />
                {duplicateWarning}
              </div>
            )}

            {/* Lesson Name */}
            <div className="cse-form-field">
              <label>Lesson Name</label>
              <input
                type="text"
                value={form.lessonName}
                onChange={e => setForm({ ...form, lessonName: (e.target as HTMLInputElement).value })}
                placeholder="e.g., Greetings"
              />
            </div>

            {/* Preview */}
            <div className="cse-preview-labels">
              <p><strong>Lesson Title:</strong> Lesson {form.lessonNumber}: {form.lessonName || '...'}</p>
            </div>

            {/* Goal Text */}
            <div className="cse-form-field">
              <label>Lesson Goal (English)</label>
              <input
                type="text"
                value={form.goalTextEn}
                onChange={e => setForm({ ...form, goalTextEn: (e.target as HTMLInputElement).value })}
                placeholder="e.g., I can say basic greetings."
              />
            </div>
            <div className="cse-form-field">
              <label>Lesson Goal (Japanese)</label>
              <input
                type="text"
                value={form.goalTextJp}
                onChange={e => setForm({ ...form, goalTextJp: (e.target as HTMLInputElement).value })}
                placeholder="e.g., 基本的な挨拶ができるようになる。"
              />
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
    speakingCount: number;
    listeningCount: number;
    readingCount: number;
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
              cx="50" cy="50" r="42" 
              className="cse-progress-fill"
              style={{ 
                strokeDasharray: `${stats.progressPercent * 2.64} 264` 
              }}
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
          <div className="cse-skill-bar-item">
            <div className="cse-skill-bar-header">
              <span className="cse-skill-bar-label">
                <span className="cse-skill-dot cse-skill-speaking" />
                Speaking
              </span>
              <span className="cse-skill-bar-value">{stats.speakingCount}</span>
            </div>
            <div className="cse-skill-bar-track">
              <div 
                className="cse-skill-bar-fill speaking" 
                style={{ width: `${stats.totalLessons ? (stats.speakingCount / stats.totalLessons) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="cse-skill-bar-item">
            <div className="cse-skill-bar-header">
              <span className="cse-skill-bar-label">
                <span className="cse-skill-dot cse-skill-listening" />
                Listening
              </span>
              <span className="cse-skill-bar-value">{stats.listeningCount}</span>
            </div>
            <div className="cse-skill-bar-track">
              <div 
                className="cse-skill-bar-fill listening" 
                style={{ width: `${stats.totalLessons ? (stats.listeningCount / stats.totalLessons) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="cse-skill-bar-item">
            <div className="cse-skill-bar-header">
              <span className="cse-skill-bar-label">
                <span className="cse-skill-dot cse-skill-reading" />
                Reading
              </span>
              <span className="cse-skill-bar-value">{stats.readingCount}</span>
            </div>
            <div className="cse-skill-bar-track">
              <div 
                className="cse-skill-bar-fill reading" 
                style={{ width: `${stats.totalLessons ? (stats.readingCount / stats.totalLessons) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="cse-stats-section">
        <h4>Quick Stats</h4>
        <div className="cse-quick-stats">
          <div className="cse-quick-stat">
            <i className="ri-stack-line" />
            <div>
              <span className="cse-quick-stat-value">10</span>
              <span className="cse-quick-stat-label">Levels</span>
            </div>
          </div>
          <div className="cse-quick-stat">
            <i className="ri-book-2-line" />
            <div>
              <span className="cse-quick-stat-value">50</span>
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

      {/* Recent Activity */}
      <div className="cse-stats-section">
        <h4>Recently Updated</h4>
        <div className="cse-recent-list">
          {lessons.slice(0, 5).map(lesson => (
            <div className="cse-recent-item" key={lesson.id}>
              <span className={`cse-skill-dot cse-skill-${lesson.skill}`} />
              <span className="cse-recent-title">{lesson.lessonTitle}</span>
              <span className="cse-recent-date">
                {new Date(lesson.updatedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
          {lessons.length === 0 && (
            <p className="cse-empty-recent">No lessons yet</p>
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
  lesson: LessonMaterial; 
  onClose: () => void;
}) {
  const skillColors: Record<string, string> = {
    speaking: '#3b82f6',
    listening: '#8b5cf6',
    reading: '#10b981',
  };

  return (
    <div className="cse-analytics">
      <div className="cse-analytics-header">
        <i className="ri-line-chart-line" />
        <h3>Lesson Analytics</h3>
        <button className="cse-analytics-close" onClick={onClose}>
          <i className="ri-close-line" />
        </button>
      </div>

      {/* Lesson Info Card */}
      <div className="cse-lesson-info-card">
        <div className="cse-lesson-info-badge" style={{ backgroundColor: skillColors[lesson.skill] }}>
          {lesson.skill}
        </div>
        <h4>{lesson.lessonTitle}</h4>
        <p className="cse-lesson-info-chapter">{lesson.chapterLabel}</p>
        <div className="cse-lesson-info-meta">
          <span className="cse-lesson-info-level">{lesson.levelBadge}</span>
          <span>Level {lesson.level}</span>
        </div>
      </div>

      {/* Mock Stats - Engagement */}
      <div className="cse-stats-section">
        <h4>Student Engagement</h4>
        <div className="cse-engagement-stats">
          <div className="cse-engagement-stat">
            <span className="cse-engagement-value">1,247</span>
            <span className="cse-engagement-label">Total Views</span>
          </div>
          <div className="cse-engagement-stat">
            <span className="cse-engagement-value">892</span>
            <span className="cse-engagement-label">Completions</span>
          </div>
          <div className="cse-engagement-stat">
            <span className="cse-engagement-value">71%</span>
            <span className="cse-engagement-label">Completion Rate</span>
          </div>
        </div>
      </div>

      {/* Mock Stats - Performance */}
      <div className="cse-stats-section">
        <h4>Average Performance</h4>
        <div className="cse-performance-bars">
          <div className="cse-performance-item">
            <span className="cse-performance-label">Accuracy</span>
            <div className="cse-performance-bar">
              <div className="cse-performance-fill" style={{ width: '78%' }} />
            </div>
            <span className="cse-performance-value">78%</span>
          </div>
          <div className="cse-performance-item">
            <span className="cse-performance-label">Fluency</span>
            <div className="cse-performance-bar">
              <div className="cse-performance-fill" style={{ width: '65%' }} />
            </div>
            <span className="cse-performance-value">65%</span>
          </div>
          <div className="cse-performance-item">
            <span className="cse-performance-label">Pronunciation</span>
            <div className="cse-performance-bar">
              <div className="cse-performance-fill" style={{ width: '82%' }} />
            </div>
            <span className="cse-performance-value">82%</span>
          </div>
        </div>
      </div>

      {/* Time Stats */}
      <div className="cse-stats-section">
        <h4>Time Metrics</h4>
        <div className="cse-time-stats">
          <div className="cse-time-stat">
            <i className="ri-time-line" />
            <div>
              <span className="cse-time-value">12:34</span>
              <span className="cse-time-label">Avg. Duration</span>
            </div>
          </div>
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

      {/* Content Status */}
      <div className="cse-stats-section">
        <h4>Content Status</h4>
        <div className="cse-content-status">
          <div className={`cse-status-item ${lesson.introductionData ? 'complete' : 'incomplete'}`}>
            <i className={lesson.introductionData ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Introduction</span>
          </div>
          <div className={`cse-status-item ${lesson.learnData ? 'complete' : 'incomplete'}`}>
            <i className={lesson.learnData ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Learn Section</span>
          </div>
          <div className={`cse-status-item ${lesson.stepBData ? 'complete' : 'incomplete'}`}>
            <i className={lesson.stepBData ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Step B</span>
          </div>
          <div className={`cse-status-item ${lesson.applyData ? 'complete' : 'incomplete'}`}>
            <i className={lesson.applyData ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Apply Section</span>
          </div>
          <div className={`cse-status-item ${lesson.exerciseData ? 'complete' : 'incomplete'}`}>
            <i className={lesson.exerciseData ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
            <span>Exercise/Mission</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ADMIN ASSIGNMENT MODAL
// ============================================================================

function AssignmentModal({
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
      } catch (error) {
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
        const admin = admins.find(a => a.id === adminId);
        const name = admin ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.username : '';
        await onAssign(level, adminId, name);
      }
    } catch (error) {
      toast.error('Failed to update assignment');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="cse-modal-overlay" onClick={onClose}>
      <div className="cse-modal cse-modal-wide" onClick={e => e.stopPropagation()}>
        <div className="cse-modal-header">
          <h2><i className="ri-user-settings-line" /> Manage Level Assignments</h2>
          <button className="cse-modal-close" onClick={onClose}>
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="cse-modal-body">
          <p className="cse-assign-description">
            Assign admins to levels. Assigned admins are responsible for the level and all its chapters and lessons.
          </p>
          {loadingAdmins ? (
            <div className="cse-loading"><i className="ri-loader-4-line" /> Loading admins...</div>
          ) : (
            <div className="cse-assign-grid">
              {LEVELS.map(level => (
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
                    onChange={e => handleChange(level, (e.target as HTMLSelectElement).value)}
                    disabled={saving === level}
                  >
                    <option value="">— Unassigned —</option>
                    {admins.map(admin => (
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
          <button type="button" className="cse-btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AI STRUCTURE PREVIEW MODAL
// ============================================================================

function StructurePreviewModal({
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
      <div className="cse-modal cse-modal-wide" onClick={e => e.stopPropagation()}>
        <div className="cse-modal-header cse-modal-header-ai">
          <h2><i className="ri-magic-line" /> AI-Generated Structure — Level {preview.level}</h2>
          <button className="cse-modal-close" onClick={onReject} disabled={saving}>
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="cse-modal-body">
          {saving ? (
            <div className="cse-saving-overlay">
              <i className="ri-loader-4-line ri-spin" />
              <span>Saving structure...</span>
            </div>
          ) : (
            <>
              <p className="cse-ai-review-hint">Review and edit the generated structure. Click Accept to save.</p>

              {/* Main Topic */}
              <div className="cse-form-field">
                <label>Level Main Topic</label>
                <input
                  type="text"
                  value={preview.mainTopic}
                  onInput={e =>
                    onChange({ ...preview, mainTopic: (e.target as HTMLInputElement).value })
                  }
                />
              </div>

              {/* Chapters */}
              <div className="cse-ai-chapters-list">
                {preview.chapters.map((ch, idx) => (
                  <div className="cse-ai-chapter-card" key={ch.chapter}>
                    <div className="cse-ai-chapter-num">Chapter {ch.chapter}</div>
                    <div className="cse-form-field">
                      <label>Theme</label>
                      <input
                        type="text"
                        value={ch.theme}
                        onInput={e => {
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
                        onInput={e => {
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
          <button type="button" className="cse-btn-secondary" onClick={onReject} disabled={saving}>Discard</button>
          <button type="button" className="cse-btn-primary cse-btn-ai" onClick={handleAccept} disabled={saving}>
            {saving ? (
              <><i className="ri-loader-4-line ri-spin" /> Saving...</>
            ) : (
              <><i className="ri-check-line" /> Accept & Save</>
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

function LessonPreviewModal({
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
      <div className="cse-modal cse-modal-wide cse-modal-tall" onClick={e => e.stopPropagation()}>
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
              <span>Creating lessons...</span>
            </div>
          ) : (
            <>
              <p className="cse-ai-review-hint">
                Review and edit the generated lessons. Accepting will create lessons for all 3 skills
                (speaking, listening, reading). Existing lessons will be skipped.
              </p>

              <div className="cse-ai-lessons-list">
                {preview.lessons.map((lesson, idx) => (
                  <div className="cse-ai-lesson-card" key={lesson.lessonNumber}>
                    <div className="cse-ai-lesson-num">Lesson {lesson.lessonNumber}</div>
                    <div className="cse-form-row cse-form-row-2">
                      <div className="cse-form-field">
                        <label>Lesson Name</label>
                        <input
                          type="text"
                          value={lesson.lessonName}
                          onInput={e => {
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
                          onInput={e => {
                            const updated = [...preview.lessons];
                            updated[idx] = { ...lesson, goalTextEn: (e.target as HTMLInputElement).value };
                            onChange({ ...preview, lessons: updated });
                          }}
                        />
                      </div>
                    </div>
                    <div className="cse-form-field">
                      <label>Goal (Japanese)</label>
                      <input
                        type="text"
                        value={lesson.goalTextJp}
                        onInput={e => {
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
          <button type="button" className="cse-btn-secondary" onClick={onReject} disabled={saving}>Discard</button>
          <button type="button" className="cse-btn-primary cse-btn-ai" onClick={handleAccept} disabled={saving}>
            {saving ? (
              <><i className="ri-loader-4-line ri-spin" /> Creating...</>
            ) : (
              <><i className="ri-check-line" /> Accept & Create Lessons</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
