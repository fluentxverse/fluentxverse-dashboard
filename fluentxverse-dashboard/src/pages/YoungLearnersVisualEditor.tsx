/**
 * YoungLearnersVisualEditor
 * Visual editor for Young Learners lessons - edit content with drag-and-drop
 */
import { useState, useEffect, useRef } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import * as youngLearnersApi from '../api/youngLearners.api';
import type { YoungLearnersLesson, VocabularyWord, Song, SongLyric, Story, StoryPage, Activity, ActivityType, LessonTheme, AgeGroup } from '../api/youngLearners.api';
import { toast } from '../Components/Toast/Toast';
import './YoungLearnersVisualEditor.css';

// ============================================================================
// CONSTANTS
// ============================================================================

const MASCOTS = [
  { value: 'foxy', label: 'Foxy the Fox 🦊', emoji: '🦊', color: '#FF6B35' },
  { value: 'buddy', label: 'Buddy the Bear 🐻', emoji: '🐻', color: '#8B4513' },
  { value: 'sunny', label: 'Sunny the Sun ☀️', emoji: '☀️', color: '#FFD700' },
  { value: 'luna', label: 'Luna the Moon 🌙', emoji: '🌙', color: '#9370DB' },
  { value: 'pippa', label: 'Pippa the Penguin 🐧', emoji: '🐧', color: '#4169E1' },
  { value: 'ozzy', label: 'Ozzy the Owl 🦉', emoji: '🦉', color: '#6B8E23' },
];

const THEMES: { value: LessonTheme; label: string; emoji: string }[] = [
  { value: 'animals', label: 'Animals', emoji: '🐾' },
  { value: 'colors', label: 'Colors', emoji: '🎨' },
  { value: 'numbers', label: 'Numbers', emoji: '🔢' },
  { value: 'shapes', label: 'Shapes', emoji: '⭐' },
  { value: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦' },
  { value: 'food', label: 'Food', emoji: '🍎' },
  { value: 'weather', label: 'Weather', emoji: '🌤️' },
  { value: 'body', label: 'Body', emoji: '🖐️' },
  { value: 'clothes', label: 'Clothes', emoji: '👕' },
  { value: 'nature', label: 'Nature', emoji: '🌳' },
];

const AGE_GROUPS: { value: AgeGroup; label: string }[] = [
  { value: '3-5', label: '3-5 Years (Preschool)' },
  { value: '6-8', label: '6-8 Years (Early Elementary)' },
  { value: '9-12', label: '9-12 Years (Late Elementary)' },
];

const ACTIVITY_TYPES: { value: ActivityType; label: string; emoji: string }[] = [
  { value: 'coloring', label: 'Coloring', emoji: '🖍️' },
  { value: 'matching', label: 'Matching', emoji: '🔗' },
  { value: 'tracing', label: 'Tracing', emoji: '✏️' },
  { value: 'counting', label: 'Counting', emoji: '🔢' },
  { value: 'sorting', label: 'Sorting', emoji: '📦' },
  { value: 'singing', label: 'Singing', emoji: '🎵' },
  { value: 'story', label: 'Story Time', emoji: '📖' },
];

const BACKGROUND_COLORS = [
  '#FFF8DC', // Cornsilk
  '#E6F7FF', // Light Blue
  '#F0FFF0', // Honeydew
  '#FFF0F5', // Lavender Blush
  '#FFFACD', // Lemon Chiffon
  '#E0FFFF', // Light Cyan
  '#FFE4E1', // Misty Rose
  '#F5FFFA', // Mint Cream
];

// ============================================================================
// COMPONENTS
// ============================================================================

// Collapsible Section
interface CollapsibleSectionProps {
  title: string;
  icon: string;
  children: any;
  defaultOpen?: boolean;
  badge?: string;
}

const CollapsibleSection = ({ title, icon, children, defaultOpen = true, badge }: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className={`yl-editor-section ${isOpen ? 'open' : ''}`}>
      <div className="yl-section-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="yl-section-title">
          <i className={icon} />
          <span>{title}</span>
          {badge && <span className="yl-section-badge">{badge}</span>}
        </div>
        <i className={`ri-arrow-${isOpen ? 'up' : 'down'}-s-line`} />
      </div>
      {isOpen && <div className="yl-section-content">{children}</div>}
    </div>
  );
};

// Image Upload Component
interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  size?: 'small' | 'medium' | 'large';
}

const ImageUpload = ({ value, onChange, placeholder = 'Click to add image', size = 'medium' }: ImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const handleClick = () => {
    inputRef.current?.click();
  };
  
  const handleFileChange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      // For now, create a local URL. In production, upload to server
      const url = URL.createObjectURL(file);
      onChange(url);
      toast.success('Image added');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className={`yl-image-upload ${size}`} onClick={handleClick}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      {isUploading ? (
        <div className="yl-image-loading">
          <i className="ri-loader-4-line ri-spin" />
        </div>
      ) : value ? (
        <div className="yl-image-preview">
          <img src={value} alt="" />
          <button
            className="yl-image-remove"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
          >
            <i className="ri-close-line" />
          </button>
        </div>
      ) : (
        <div className="yl-image-placeholder">
          <i className="ri-image-add-line" />
          <span>{placeholder}</span>
        </div>
      )}
    </div>
  );
};

// Vocabulary Word Card
interface VocabularyCardProps {
  word: VocabularyWord;
  index: number;
  onChange: (word: VocabularyWord) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const VocabularyCard = ({ word, index, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: VocabularyCardProps) => {
  return (
    <div className="yl-vocab-card">
      <div className="yl-vocab-header">
        <span className="yl-vocab-number">{index + 1}</span>
        <div className="yl-vocab-actions">
          <button disabled={isFirst} onClick={onMoveUp} title="Move up">
            <i className="ri-arrow-up-s-line" />
          </button>
          <button disabled={isLast} onClick={onMoveDown} title="Move down">
            <i className="ri-arrow-down-s-line" />
          </button>
          <button onClick={onDelete} className="danger" title="Delete">
            <i className="ri-delete-bin-line" />
          </button>
        </div>
      </div>
      <div className="yl-vocab-content">
        <ImageUpload
          value={word.image}
          onChange={(url) => onChange({ ...word, image: url })}
          placeholder="Add image"
          size="medium"
        />
        <div className="yl-vocab-inputs">
          <div className="yl-input-group">
            <label>Word (English)</label>
            <input
              type="text"
              value={word.word}
              onChange={(e) => onChange({ ...word, word: (e.target as HTMLInputElement).value })}
              placeholder="e.g., Cat"
            />
          </div>
          <div className="yl-input-group">
            <label>Translation</label>
            <input
              type="text"
              value={word.translation}
              onChange={(e) => onChange({ ...word, translation: (e.target as HTMLInputElement).value })}
              placeholder="e.g., 猫"
            />
          </div>
          <div className="yl-input-group">
            <label>Audio URL (optional)</label>
            <input
              type="text"
              value={word.audio || ''}
              onChange={(e) => onChange({ ...word, audio: (e.target as HTMLInputElement).value || undefined })}
              placeholder="Audio file URL"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Song Lyric Row
interface SongLyricRowProps {
  lyric: SongLyric;
  index: number;
  onChange: (lyric: SongLyric) => void;
  onDelete: () => void;
}

const SongLyricRow = ({ lyric, index, onChange, onDelete }: SongLyricRowProps) => {
  return (
    <div className="yl-lyric-row">
      <span className="yl-lyric-number">{index + 1}</span>
      <input
        type="text"
        value={lyric.line}
        onChange={(e) => onChange({ ...lyric, line: (e.target as HTMLInputElement).value })}
        placeholder="Lyric line"
        className="yl-lyric-line"
      />
      <input
        type="text"
        value={lyric.translation || ''}
        onChange={(e) => onChange({ ...lyric, translation: (e.target as HTMLInputElement).value || undefined })}
        placeholder="Translation"
        className="yl-lyric-translation"
      />
      <button onClick={onDelete} className="yl-lyric-delete">
        <i className="ri-close-line" />
      </button>
    </div>
  );
};

// Story Page Card
interface StoryPageCardProps {
  page: StoryPage;
  index: number;
  onChange: (page: StoryPage) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const StoryPageCard = ({ page, index, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: StoryPageCardProps) => {
  return (
    <div className="yl-story-page">
      <div className="yl-page-header">
        <span className="yl-page-number">Page {index + 1}</span>
        <div className="yl-page-actions">
          <button disabled={isFirst} onClick={onMoveUp} title="Move up">
            <i className="ri-arrow-up-s-line" />
          </button>
          <button disabled={isLast} onClick={onMoveDown} title="Move down">
            <i className="ri-arrow-down-s-line" />
          </button>
          <button onClick={onDelete} className="danger" title="Delete">
            <i className="ri-delete-bin-line" />
          </button>
        </div>
      </div>
      <div className="yl-page-content">
        <ImageUpload
          value={page.image}
          onChange={(url) => onChange({ ...page, image: url })}
          placeholder="Page illustration"
          size="large"
        />
        <div className="yl-page-inputs">
          <div className="yl-input-group">
            <label>Story Text</label>
            <textarea
              value={page.text}
              onChange={(e) => onChange({ ...page, text: (e.target as HTMLTextAreaElement).value })}
              placeholder="Write the story text for this page..."
              rows={3}
            />
          </div>
          <div className="yl-input-group">
            <label>Translation (optional)</label>
            <textarea
              value={page.translation || ''}
              onChange={(e) => onChange({ ...page, translation: (e.target as HTMLTextAreaElement).value || undefined })}
              placeholder="Translation..."
              rows={2}
            />
          </div>
          <div className="yl-input-group">
            <label>Audio URL (optional)</label>
            <input
              type="text"
              value={page.audio || ''}
              onChange={(e) => onChange({ ...page, audio: (e.target as HTMLInputElement).value || undefined })}
              placeholder="Audio narration URL"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Activity Card
interface ActivityCardProps {
  activity: Activity;
  index: number;
  onChange: (activity: Activity) => void;
  onDelete: () => void;
}

const ActivityCard = ({ activity, index, onChange, onDelete }: ActivityCardProps) => {
  const activityType = ACTIVITY_TYPES.find(t => t.value === activity.type);
  
  return (
    <div className="yl-activity-card">
      <div className="yl-activity-header">
        <span className="yl-activity-emoji">{activityType?.emoji || '🎯'}</span>
        <span className="yl-activity-type">{activityType?.label || activity.type}</span>
        <button onClick={onDelete} className="yl-activity-delete" title="Delete activity">
          <i className="ri-delete-bin-line" />
        </button>
      </div>
      <div className="yl-activity-content">
        <div className="yl-input-group">
          <label>Activity Type</label>
          <select
            value={activity.type}
            onChange={(e) => onChange({ ...activity, type: (e.target as HTMLSelectElement).value as ActivityType })}
          >
            {ACTIVITY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
            ))}
          </select>
        </div>
        <div className="yl-input-group">
          <label>Activity Title</label>
          <input
            type="text"
            value={activity.title}
            onChange={(e) => onChange({ ...activity, title: (e.target as HTMLInputElement).value })}
            placeholder="e.g., Color the Animals"
          />
        </div>
        <div className="yl-input-group">
          <label>Instruction (English)</label>
          <textarea
            value={activity.instruction}
            onChange={(e) => onChange({ ...activity, instruction: (e.target as HTMLTextAreaElement).value })}
            placeholder="Describe what the student should do..."
            rows={2}
          />
        </div>
        <div className="yl-input-group">
          <label>Instruction (Japanese)</label>
          <textarea
            value={activity.instructionJp || ''}
            onChange={(e) => onChange({ ...activity, instructionJp: (e.target as HTMLTextAreaElement).value || undefined })}
            placeholder="Japanese translation of instruction..."
            rows={2}
          />
        </div>
        <div className="yl-input-group">
          <label>Activity Data (JSON)</label>
          <textarea
            value={JSON.stringify(activity.data || {}, null, 2)}
            onChange={(e) => {
              try {
                const data = JSON.parse((e.target as HTMLTextAreaElement).value);
                onChange({ ...activity, data });
              } catch {
                // Invalid JSON, don't update
              }
            }}
            placeholder='{"images": [], "options": []}'
            rows={4}
            className="yl-json-textarea"
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN EDITOR
// ============================================================================

export default function YoungLearnersVisualEditor() {
  const route = useRoute();
  const lessonId = route.params?.id;
  
  const [lesson, setLesson] = useState<YoungLearnersLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'vocabulary' | 'song' | 'story' | 'activities'>('settings');
  
  // Load lesson
  useEffect(() => {
    if (!lessonId) return;
    
    const loadLesson = async () => {
      setLoading(true);
      try {
        const result = await youngLearnersApi.getLesson(lessonId);
        if (result.success && result.lesson) {
          setLesson(result.lesson);
        } else {
          toast.error(result.error || 'Failed to load lesson');
        }
      } catch (error) {
        toast.error('Failed to load lesson');
      } finally {
        setLoading(false);
      }
    };
    
    loadLesson();
  }, [lessonId]);
  
  // Auto-save warning
  useEffect(() => {
    if (hasChanges) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [hasChanges]);
  
  // Update lesson helper
  const updateLesson = (updates: Partial<YoungLearnersLesson>) => {
    if (!lesson) return;
    setLesson({ ...lesson, ...updates });
    setHasChanges(true);
  };
  
  // Save lesson
  const handleSave = async () => {
    if (!lesson) return;
    
    setSaving(true);
    try {
      const result = await youngLearnersApi.updateLesson(lesson.id, {
        unitLabel: lesson.unitLabel,
        lessonTitle: lesson.lessonTitle,
        theme: lesson.theme,
        ageGroup: lesson.ageGroup,
        mascot: lesson.mascot,
        backgroundColor: lesson.backgroundColor,
        greeting: lesson.greeting,
        greetingJp: lesson.greetingJp,
        vocabularyWords: lesson.vocabularyWords,
        song: lesson.song,
        story: lesson.story,
        activities: lesson.activities,
      });
      
      if (result.success) {
        setHasChanges(false);
        toast.success('Lesson saved!');
      } else {
        toast.error(result.error || 'Failed to save lesson');
      }
    } catch (error) {
      toast.error('Failed to save lesson');
    } finally {
      setSaving(false);
    }
  };
  
  // Publish/Unpublish
  const handleTogglePublish = async () => {
    if (!lesson) return;
    
    try {
      if (lesson.status === 'published') {
        const result = await youngLearnersApi.unpublishLesson(lesson.id);
        if (result.success) {
          updateLesson({ status: 'draft' });
          toast.success('Lesson unpublished');
        } else {
          toast.error(result.error || 'Failed to unpublish');
        }
      } else {
        const result = await youngLearnersApi.publishLesson(lesson.id);
        if (result.success) {
          updateLesson({ status: 'published' });
          toast.success('Lesson published!');
        } else {
          toast.error(result.error || 'Failed to publish');
        }
      }
    } catch (error) {
      toast.error('Failed to change status');
    }
  };
  
  // Preview
  const handlePreview = () => {
    window.open(`/young-learners-preview/${lessonId}`, '_blank');
  };
  
  // Vocabulary helpers
  const addVocabularyWord = () => {
    if (!lesson) return;
    const newWord: VocabularyWord = {
      id: `vocab-${Date.now()}`,
      word: '',
      translation: '',
      image: '',
    };
    updateLesson({ vocabularyWords: [...lesson.vocabularyWords, newWord] });
  };
  
  const updateVocabularyWord = (index: number, word: VocabularyWord) => {
    if (!lesson) return;
    const words = [...lesson.vocabularyWords];
    words[index] = word;
    updateLesson({ vocabularyWords: words });
  };
  
  const deleteVocabularyWord = (index: number) => {
    if (!lesson) return;
    const words = lesson.vocabularyWords.filter((_, i) => i !== index);
    updateLesson({ vocabularyWords: words });
  };
  
  const moveVocabularyWord = (from: number, to: number) => {
    if (!lesson) return;
    const words = [...lesson.vocabularyWords];
    const [removed] = words.splice(from, 1);
    words.splice(to, 0, removed);
    updateLesson({ vocabularyWords: words });
  };
  
  // Song helpers
  const initSong = () => {
    updateLesson({
      song: {
        title: '',
        audioUrl: '',
        lyrics: [{ id: `lyric-${Date.now()}`, line: '' }],
      },
    });
  };
  
  const removeSong = () => {
    updateLesson({ song: null });
  };
  
  const addSongLyric = () => {
    if (!lesson?.song) return;
    const newLyric: SongLyric = {
      id: `lyric-${Date.now()}`,
      line: '',
    };
    updateLesson({
      song: {
        ...lesson.song,
        lyrics: [...lesson.song.lyrics, newLyric],
      },
    });
  };
  
  const updateSongLyric = (index: number, lyric: SongLyric) => {
    if (!lesson?.song) return;
    const lyrics = [...lesson.song.lyrics];
    lyrics[index] = lyric;
    updateLesson({
      song: { ...lesson.song, lyrics },
    });
  };
  
  const deleteSongLyric = (index: number) => {
    if (!lesson?.song) return;
    const lyrics = lesson.song.lyrics.filter((_, i) => i !== index);
    updateLesson({
      song: { ...lesson.song, lyrics },
    });
  };
  
  // Story helpers
  const initStory = () => {
    updateLesson({
      story: {
        title: '',
        pages: [{ id: `page-${Date.now()}`, image: '', text: '' }],
      },
    });
  };
  
  const removeStory = () => {
    updateLesson({ story: null });
  };
  
  const addStoryPage = () => {
    if (!lesson?.story) return;
    const newPage: StoryPage = {
      id: `page-${Date.now()}`,
      image: '',
      text: '',
    };
    updateLesson({
      story: {
        ...lesson.story,
        pages: [...lesson.story.pages, newPage],
      },
    });
  };
  
  const updateStoryPage = (index: number, page: StoryPage) => {
    if (!lesson?.story) return;
    const pages = [...lesson.story.pages];
    pages[index] = page;
    updateLesson({
      story: { ...lesson.story, pages },
    });
  };
  
  const deleteStoryPage = (index: number) => {
    if (!lesson?.story) return;
    const pages = lesson.story.pages.filter((_, i) => i !== index);
    updateLesson({
      story: { ...lesson.story, pages },
    });
  };
  
  const moveStoryPage = (from: number, to: number) => {
    if (!lesson?.story) return;
    const pages = [...lesson.story.pages];
    const [removed] = pages.splice(from, 1);
    pages.splice(to, 0, removed);
    updateLesson({
      story: { ...lesson.story, pages },
    });
  };
  
  // Activity helpers
  const addActivity = () => {
    if (!lesson) return;
    const newActivity: Activity = {
      id: `activity-${Date.now()}`,
      type: 'matching',
      title: '',
      instruction: '',
      data: {},
    };
    updateLesson({ activities: [...lesson.activities, newActivity] });
  };
  
  const updateActivity = (index: number, activity: Activity) => {
    if (!lesson) return;
    const activities = [...lesson.activities];
    activities[index] = activity;
    updateLesson({ activities });
  };
  
  const deleteActivity = (index: number) => {
    if (!lesson) return;
    const activities = lesson.activities.filter((_, i) => i !== index);
    updateLesson({ activities });
  };
  
  // Get mascot info
  const mascotInfo = MASCOTS.find(m => m.value === lesson?.mascot) || MASCOTS[0];
  const themeInfo = THEMES.find(t => t.value === lesson?.theme) || THEMES[0];
  
  if (loading) {
    return (
      <div className="yl-visual-editor">
        <div className="yl-loading">
          <div className="yl-loading-spinner" />
          <p>Loading lesson...</p>
        </div>
      </div>
    );
  }
  
  if (!lesson) {
    return (
      <div className="yl-visual-editor">
        <div className="yl-error">
          <i className="ri-error-warning-line" />
          <h2>Lesson Not Found</h2>
          <p>The requested lesson could not be found.</p>
          <button onClick={() => window.history.back()}>Go Back</button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="yl-visual-editor" style={{ backgroundColor: lesson.backgroundColor }}>
      {/* Header */}
      <header className="yl-editor-header">
        <div className="yl-header-left">
          <button className="yl-back-btn" onClick={() => window.history.back()}>
            <i className="ri-arrow-left-line" />
          </button>
          <div className="yl-header-info">
            <h1>
              <span className="yl-mascot-emoji">{mascotInfo.emoji}</span>
              {lesson.lessonTitle || 'Untitled Lesson'}
            </h1>
            <span className="yl-header-meta">
              Level {lesson.level} • Unit {lesson.unit} • Lesson {lesson.lessonNumber}
              <span className={`yl-status-badge ${lesson.status}`}>
                {lesson.status === 'published' ? '✓ Published' : '◉ Draft'}
              </span>
            </span>
          </div>
        </div>
        <div className="yl-header-actions">
          <button className="yl-btn secondary" onClick={handlePreview}>
            <i className="ri-eye-line" /> Preview
          </button>
          <button
            className={`yl-btn ${lesson.status === 'published' ? 'warning' : 'success'}`}
            onClick={handleTogglePublish}
          >
            <i className={lesson.status === 'published' ? 'ri-draft-line' : 'ri-check-double-line'} />
            {lesson.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
          <button
            className="yl-btn primary"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <>
                <i className="ri-loader-4-line ri-spin" /> Saving...
              </>
            ) : (
              <>
                <i className="ri-save-line" /> Save
                {hasChanges && <span className="yl-unsaved-dot" />}
              </>
            )}
          </button>
        </div>
      </header>
      
      {/* Tab Navigation */}
      <nav className="yl-editor-tabs">
        {(['settings', 'vocabulary', 'song', 'story', 'activities'] as const).map((tab) => (
          <button
            key={tab}
            className={`yl-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <i className={`ri-${
              tab === 'settings' ? 'settings-3' :
              tab === 'vocabulary' ? 'translate-2' :
              tab === 'song' ? 'music-2' :
              tab === 'story' ? 'book-read' :
              'gamepad'
            }-line`} />
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'vocabulary' && lesson.vocabularyWords.length > 0 && (
              <span className="yl-tab-badge">{lesson.vocabularyWords.length}</span>
            )}
            {tab === 'activities' && lesson.activities.length > 0 && (
              <span className="yl-tab-badge">{lesson.activities.length}</span>
            )}
          </button>
        ))}
      </nav>
      
      {/* Content Area */}
      <main className="yl-editor-content">
        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="yl-settings-panel">
            <CollapsibleSection title="Lesson Information" icon="ri-information-line">
              <div className="yl-form-grid">
                <div className="yl-input-group">
                  <label>Unit Label</label>
                  <input
                    type="text"
                    value={lesson.unitLabel}
                    onChange={(e) => updateLesson({ unitLabel: (e.target as HTMLInputElement).value })}
                    placeholder="e.g., Animals Around Us"
                  />
                </div>
                <div className="yl-input-group">
                  <label>Lesson Title</label>
                  <input
                    type="text"
                    value={lesson.lessonTitle}
                    onChange={(e) => updateLesson({ lessonTitle: (e.target as HTMLInputElement).value })}
                    placeholder="e.g., Farm Animals"
                  />
                </div>
                <div className="yl-input-group">
                  <label>Theme</label>
                  <select
                    value={lesson.theme}
                    onChange={(e) => updateLesson({ theme: (e.target as HTMLSelectElement).value as LessonTheme })}
                  >
                    {THEMES.map(t => (
                      <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="yl-input-group">
                  <label>Age Group</label>
                  <select
                    value={lesson.ageGroup}
                    onChange={(e) => updateLesson({ ageGroup: (e.target as HTMLSelectElement).value as AgeGroup })}
                  >
                    {AGE_GROUPS.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CollapsibleSection>
            
            <CollapsibleSection title="Mascot & Appearance" icon="ri-palette-line">
              <div className="yl-form-grid">
                <div className="yl-input-group">
                  <label>Mascot</label>
                  <div className="yl-mascot-grid">
                    {MASCOTS.map(m => (
                      <button
                        key={m.value}
                        className={`yl-mascot-btn ${lesson.mascot === m.value ? 'active' : ''}`}
                        onClick={() => updateLesson({ mascot: m.value })}
                        title={m.label}
                      >
                        <span className="yl-mascot-emoji-large">{m.emoji}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="yl-input-group">
                  <label>Background Color</label>
                  <div className="yl-color-grid">
                    {BACKGROUND_COLORS.map(color => (
                      <button
                        key={color}
                        className={`yl-color-btn ${lesson.backgroundColor === color ? 'active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => updateLesson({ backgroundColor: color })}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CollapsibleSection>
            
            <CollapsibleSection title="Greeting Message" icon="ri-chat-smile-3-line">
              <div className="yl-greeting-preview" style={{ backgroundColor: lesson.backgroundColor }}>
                <span className="yl-greeting-mascot">{mascotInfo.emoji}</span>
                <div className="yl-greeting-bubble">
                  <p>{lesson.greeting || 'Hello! Welcome to our lesson!'}</p>
                  {lesson.greetingJp && <p className="yl-greeting-jp">{lesson.greetingJp}</p>}
                </div>
              </div>
              <div className="yl-form-grid">
                <div className="yl-input-group">
                  <label>Greeting (English)</label>
                  <textarea
                    value={lesson.greeting}
                    onChange={(e) => updateLesson({ greeting: (e.target as HTMLTextAreaElement).value })}
                    placeholder="Hello! Welcome to our lesson about animals!"
                    rows={2}
                  />
                </div>
                <div className="yl-input-group">
                  <label>Greeting (Japanese)</label>
                  <textarea
                    value={lesson.greetingJp || ''}
                    onChange={(e) => updateLesson({ greetingJp: (e.target as HTMLTextAreaElement).value || undefined })}
                    placeholder="こんにちは！今日は動物について学びましょう！"
                    rows={2}
                  />
                </div>
              </div>
            </CollapsibleSection>
          </div>
        )}
        
        {/* Vocabulary Tab */}
        {activeTab === 'vocabulary' && (
          <div className="yl-vocabulary-panel">
            <div className="yl-panel-header">
              <h2>
                <i className="ri-translate-2-line" />
                Vocabulary Words
              </h2>
              <button className="yl-btn primary" onClick={addVocabularyWord}>
                <i className="ri-add-line" /> Add Word
              </button>
            </div>
            
            {lesson.vocabularyWords.length === 0 ? (
              <div className="yl-empty-state">
                <i className="ri-translate-2-line" />
                <h3>No vocabulary words yet</h3>
                <p>Add words with images and translations for young learners to practice.</p>
                <button className="yl-btn primary" onClick={addVocabularyWord}>
                  <i className="ri-add-line" /> Add First Word
                </button>
              </div>
            ) : (
              <div className="yl-vocab-grid">
                {lesson.vocabularyWords.map((word, index) => (
                  <VocabularyCard
                    key={word.id}
                    word={word}
                    index={index}
                    onChange={(w) => updateVocabularyWord(index, w)}
                    onDelete={() => deleteVocabularyWord(index)}
                    onMoveUp={() => moveVocabularyWord(index, index - 1)}
                    onMoveDown={() => moveVocabularyWord(index, index + 1)}
                    isFirst={index === 0}
                    isLast={index === lesson.vocabularyWords.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Song Tab */}
        {activeTab === 'song' && (
          <div className="yl-song-panel">
            <div className="yl-panel-header">
              <h2>
                <i className="ri-music-2-line" />
                Lesson Song
              </h2>
              {lesson.song ? (
                <button className="yl-btn danger" onClick={removeSong}>
                  <i className="ri-delete-bin-line" /> Remove Song
                </button>
              ) : (
                <button className="yl-btn primary" onClick={initSong}>
                  <i className="ri-add-line" /> Add Song
                </button>
              )}
            </div>
            
            {!lesson.song ? (
              <div className="yl-empty-state">
                <i className="ri-music-2-line" />
                <h3>No song added</h3>
                <p>Add a fun song with lyrics for young learners to sing along!</p>
                <button className="yl-btn primary" onClick={initSong}>
                  <i className="ri-add-line" /> Add Song
                </button>
              </div>
            ) : (
              <div className="yl-song-content">
                <div className="yl-form-grid">
                  <div className="yl-input-group">
                    <label>Song Title</label>
                    <input
                      type="text"
                      value={lesson.song.title}
                      onChange={(e) => updateLesson({
                        song: { ...lesson.song!, title: (e.target as HTMLInputElement).value }
                      })}
                      placeholder="e.g., Old MacDonald Had a Farm"
                    />
                  </div>
                  <div className="yl-input-group">
                    <label>Audio URL (optional)</label>
                    <input
                      type="text"
                      value={lesson.song.audioUrl || ''}
                      onChange={(e) => updateLesson({
                        song: { ...lesson.song!, audioUrl: (e.target as HTMLInputElement).value || undefined }
                      })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                
                <div className="yl-lyrics-section">
                  <div className="yl-lyrics-header">
                    <h3>Lyrics</h3>
                    <button className="yl-btn secondary small" onClick={addSongLyric}>
                      <i className="ri-add-line" /> Add Line
                    </button>
                  </div>
                  <div className="yl-lyrics-list">
                    {lesson.song.lyrics.map((lyric, index) => (
                      <SongLyricRow
                        key={lyric.id}
                        lyric={lyric}
                        index={index}
                        onChange={(l) => updateSongLyric(index, l)}
                        onDelete={() => deleteSongLyric(index)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Story Tab */}
        {activeTab === 'story' && (
          <div className="yl-story-panel">
            <div className="yl-panel-header">
              <h2>
                <i className="ri-book-read-line" />
                Story Time
              </h2>
              {lesson.story ? (
                <button className="yl-btn danger" onClick={removeStory}>
                  <i className="ri-delete-bin-line" /> Remove Story
                </button>
              ) : (
                <button className="yl-btn primary" onClick={initStory}>
                  <i className="ri-add-line" /> Add Story
                </button>
              )}
            </div>
            
            {!lesson.story ? (
              <div className="yl-empty-state">
                <i className="ri-book-read-line" />
                <h3>No story added</h3>
                <p>Add a short illustrated story for young learners to read together!</p>
                <button className="yl-btn primary" onClick={initStory}>
                  <i className="ri-add-line" /> Add Story
                </button>
              </div>
            ) : (
              <div className="yl-story-content">
                <div className="yl-input-group">
                  <label>Story Title</label>
                  <input
                    type="text"
                    value={lesson.story.title}
                    onChange={(e) => updateLesson({
                      story: { ...lesson.story!, title: (e.target as HTMLInputElement).value }
                    })}
                    placeholder="e.g., The Little Red Hen"
                  />
                </div>
                
                <div className="yl-pages-section">
                  <div className="yl-pages-header">
                    <h3>Story Pages ({lesson.story.pages.length})</h3>
                    <button className="yl-btn secondary small" onClick={addStoryPage}>
                      <i className="ri-add-line" /> Add Page
                    </button>
                  </div>
                  <div className="yl-pages-list">
                    {lesson.story.pages.map((page, index) => (
                      <StoryPageCard
                        key={page.id}
                        page={page}
                        index={index}
                        onChange={(p) => updateStoryPage(index, p)}
                        onDelete={() => deleteStoryPage(index)}
                        onMoveUp={() => moveStoryPage(index, index - 1)}
                        onMoveDown={() => moveStoryPage(index, index + 1)}
                        isFirst={index === 0}
                        isLast={index === lesson.story!.pages.length - 1}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Activities Tab */}
        {activeTab === 'activities' && (
          <div className="yl-activities-panel">
            <div className="yl-panel-header">
              <h2>
                <i className="ri-gamepad-line" />
                Activities
              </h2>
              <button className="yl-btn primary" onClick={addActivity}>
                <i className="ri-add-line" /> Add Activity
              </button>
            </div>
            
            {lesson.activities.length === 0 ? (
              <div className="yl-empty-state">
                <i className="ri-gamepad-line" />
                <h3>No activities yet</h3>
                <p>Add fun interactive activities like coloring, matching, or counting!</p>
                <button className="yl-btn primary" onClick={addActivity}>
                  <i className="ri-add-line" /> Add First Activity
                </button>
              </div>
            ) : (
              <div className="yl-activities-grid">
                {lesson.activities.map((activity, index) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    index={index}
                    onChange={(a) => updateActivity(index, a)}
                    onDelete={() => deleteActivity(index)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
