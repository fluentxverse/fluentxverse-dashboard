/**
 * YoungLearnersPreview
 * Preview page for Young Learners lessons - shows the lesson as students will see it
 */
import { useState, useEffect, useRef } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import * as youngLearnersApi from '../api/youngLearners.api';
import type { YoungLearnersLesson, VocabularyWord, Song, Story, Activity } from '../api/youngLearners.api';
import { toast } from '../Components/Toast/Toast';
import './YoungLearnersPreview.css';

// ============================================================================
// CONSTANTS
// ============================================================================

const MASCOTS: Record<string, { emoji: string; color: string }> = {
  foxy: { emoji: '🦊', color: '#FF6B35' },
  buddy: { emoji: '🐻', color: '#8B4513' },
  sunny: { emoji: '☀️', color: '#FFD700' },
  luna: { emoji: '🌙', color: '#9370DB' },
  pippa: { emoji: '🐧', color: '#4169E1' },
  ozzy: { emoji: '🦉', color: '#6B8E23' },
};

const ACTIVITY_EMOJIS: Record<string, string> = {
  coloring: '🖍️',
  matching: '🔗',
  tracing: '✏️',
  counting: '🔢',
  sorting: '📦',
  singing: '🎵',
  story: '📖',
};

// ============================================================================
// COMPONENTS
// ============================================================================

// Vocabulary Card Component
interface VocabCardProps {
  word: VocabularyWord;
  index: number;
  onPlayAudio?: () => void;
}

const VocabCard = ({ word, index, onPlayAudio }: VocabCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  
  return (
    <div
      className={`yl-preview-vocab-card ${isFlipped ? 'flipped' : ''}`}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className="yl-card-inner">
        <div className="yl-card-front">
          {word.image ? (
            <img src={word.image} alt={word.word} className="yl-vocab-image" />
          ) : (
            <div className="yl-vocab-placeholder">
              <span>🖼️</span>
            </div>
          )}
          <h3 className="yl-vocab-word">{word.word}</h3>
          {word.audio && (
            <button
              className="yl-audio-btn"
              onClick={(e) => {
                e.stopPropagation();
                onPlayAudio?.();
              }}
            >
              🔊
            </button>
          )}
        </div>
        <div className="yl-card-back">
          <span className="yl-vocab-translation">{word.translation}</span>
          <span className="yl-flip-hint">Tap to flip back</span>
        </div>
      </div>
    </div>
  );
};

// Song Section Component
interface SongSectionProps {
  song: Song;
}

const SongSection = ({ song }: SongSectionProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLine, setCurrentLine] = useState(0);
  
  return (
    <div className="yl-preview-song">
      <div className="yl-song-header">
        <span className="yl-song-icon">🎵</span>
        <h2>{song.title || 'Sing Along!'}</h2>
        {song.audioUrl && (
          <button
            className={`yl-play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
        )}
      </div>
      <div className="yl-lyrics-container">
        {song.lyrics.map((lyric, index) => (
          <div
            key={lyric.id}
            className={`yl-lyric-line ${index === currentLine ? 'active' : ''}`}
          >
            <span className="yl-lyric-text">{lyric.line}</span>
            {lyric.translation && (
              <span className="yl-lyric-translation">{lyric.translation}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Story Section Component
interface StorySectionProps {
  story: Story;
}

const StorySection = ({ story }: StorySectionProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const page = story.pages[currentPage];
  
  const goToPage = (index: number) => {
    if (index >= 0 && index < story.pages.length) {
      setCurrentPage(index);
    }
  };
  
  return (
    <div className="yl-preview-story">
      <div className="yl-story-header">
        <span className="yl-story-icon">📖</span>
        <h2>{story.title || 'Story Time!'}</h2>
      </div>
      
      <div className="yl-story-book">
        <div className="yl-story-page">
          {page?.image && (
            <img src={page.image} alt="" className="yl-story-illustration" />
          )}
          <div className="yl-story-text-container">
            <p className="yl-story-text">{page?.text}</p>
            {page?.translation && (
              <p className="yl-story-translation">{page.translation}</p>
            )}
          </div>
        </div>
        
        <div className="yl-story-navigation">
          <button
            className="yl-nav-btn"
            disabled={currentPage === 0}
            onClick={() => goToPage(currentPage - 1)}
          >
            ← Previous
          </button>
          <span className="yl-page-indicator">
            {currentPage + 1} / {story.pages.length}
          </span>
          <button
            className="yl-nav-btn"
            disabled={currentPage === story.pages.length - 1}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};

// Activity Section Component
interface ActivitySectionProps {
  activity: Activity;
  index: number;
}

const ActivitySection = ({ activity, index }: ActivitySectionProps) => {
  const emoji = ACTIVITY_EMOJIS[activity.type] || '🎯';
  
  return (
    <div className="yl-preview-activity">
      <div className="yl-activity-header">
        <span className="yl-activity-icon">{emoji}</span>
        <div className="yl-activity-info">
          <h3>{activity.title || `Activity ${index + 1}`}</h3>
          <span className="yl-activity-type">{activity.type}</span>
        </div>
      </div>
      <div className="yl-activity-instruction">
        <p>{activity.instruction}</p>
        {activity.instructionJp && (
          <p className="yl-instruction-jp">{activity.instructionJp}</p>
        )}
      </div>
      <div className="yl-activity-placeholder">
        <span>{emoji}</span>
        <p>Interactive activity will appear here</p>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN PREVIEW
// ============================================================================

export default function YoungLearnersPreview() {
  const route = useRoute();
  const lessonId = route.params?.id;
  
  const [lesson, setLesson] = useState<YoungLearnersLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'welcome' | 'vocabulary' | 'song' | 'story' | 'activities'>('welcome');
  
  // Load lesson
  useEffect(() => {
    if (!lessonId) return;
    
    const loadLesson = async () => {
      setLoading(true);
      try {
        // Try public endpoint first, then private
        let result = await youngLearnersApi.getPublicLesson(lessonId);
        if (!result.success || !result.lesson) {
          result = await youngLearnersApi.getLesson(lessonId);
        }
        
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
  
  // Get mascot info
  const mascot = lesson ? MASCOTS[lesson.mascot] || MASCOTS.foxy : MASCOTS.foxy;
  
  // Check which sections are available
  const hasVocabulary = lesson && lesson.vocabularyWords.length > 0;
  const hasSong = lesson?.song && lesson.song.lyrics.length > 0;
  const hasStory = lesson?.story && lesson.story.pages.length > 0;
  const hasActivities = lesson && lesson.activities.length > 0;
  
  if (loading) {
    return (
      <div className="yl-preview" style={{ backgroundColor: '#FFF8DC' }}>
        <div className="yl-preview-loading">
          <div className="yl-bounce">🦊</div>
          <p>Loading lesson...</p>
        </div>
      </div>
    );
  }
  
  if (!lesson) {
    return (
      <div className="yl-preview" style={{ backgroundColor: '#FFF8DC' }}>
        <div className="yl-preview-error">
          <span className="yl-error-icon">😢</span>
          <h2>Oops! Lesson not found</h2>
          <p>This lesson might not be available yet.</p>
          <button onClick={() => window.history.back()}>Go Back</button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="yl-preview" style={{ backgroundColor: lesson.backgroundColor || '#FFF8DC' }}>
      {/* Header */}
      <header className="yl-preview-header">
        <button className="yl-close-btn" onClick={() => window.close()}>
          <i className="ri-close-line" />
        </button>
        <div className="yl-lesson-info">
          <span className="yl-level-badge">Level {lesson.level}</span>
          <h1>{lesson.lessonTitle}</h1>
          <span className="yl-unit-label">{lesson.unitLabel}</span>
        </div>
        <div className="yl-header-mascot">
          {mascot.emoji}
        </div>
      </header>
      
      {/* Navigation Pills */}
      <nav className="yl-preview-nav">
        <button
          className={`yl-nav-pill ${activeSection === 'welcome' ? 'active' : ''}`}
          onClick={() => setActiveSection('welcome')}
        >
          👋 Welcome
        </button>
        {hasVocabulary && (
          <button
            className={`yl-nav-pill ${activeSection === 'vocabulary' ? 'active' : ''}`}
            onClick={() => setActiveSection('vocabulary')}
          >
            📚 Words
          </button>
        )}
        {hasSong && (
          <button
            className={`yl-nav-pill ${activeSection === 'song' ? 'active' : ''}`}
            onClick={() => setActiveSection('song')}
          >
            🎵 Song
          </button>
        )}
        {hasStory && (
          <button
            className={`yl-nav-pill ${activeSection === 'story' ? 'active' : ''}`}
            onClick={() => setActiveSection('story')}
          >
            📖 Story
          </button>
        )}
        {hasActivities && (
          <button
            className={`yl-nav-pill ${activeSection === 'activities' ? 'active' : ''}`}
            onClick={() => setActiveSection('activities')}
          >
            🎮 Activities
          </button>
        )}
      </nav>
      
      {/* Content */}
      <main className="yl-preview-content">
        {/* Welcome Section */}
        {activeSection === 'welcome' && (
          <section className="yl-welcome-section">
            <div className="yl-mascot-greeting">
              <div className="yl-mascot-large">
                {mascot.emoji}
              </div>
              <div className="yl-speech-bubble">
                <p className="yl-greeting-text">{lesson.greeting || 'Hello! Welcome to our lesson!'}</p>
                {lesson.greetingJp && (
                  <p className="yl-greeting-jp">{lesson.greetingJp}</p>
                )}
              </div>
            </div>
            
            <div className="yl-lesson-overview">
              <h2>Today's Lesson</h2>
              <div className="yl-overview-cards">
                {hasVocabulary && (
                  <div className="yl-overview-card" onClick={() => setActiveSection('vocabulary')}>
                    <span className="yl-card-icon">📚</span>
                    <span className="yl-card-label">Learn {lesson.vocabularyWords.length} words</span>
                  </div>
                )}
                {hasSong && (
                  <div className="yl-overview-card" onClick={() => setActiveSection('song')}>
                    <span className="yl-card-icon">🎵</span>
                    <span className="yl-card-label">Sing a song</span>
                  </div>
                )}
                {hasStory && (
                  <div className="yl-overview-card" onClick={() => setActiveSection('story')}>
                    <span className="yl-card-icon">📖</span>
                    <span className="yl-card-label">Read a story</span>
                  </div>
                )}
                {hasActivities && (
                  <div className="yl-overview-card" onClick={() => setActiveSection('activities')}>
                    <span className="yl-card-icon">🎮</span>
                    <span className="yl-card-label">{lesson.activities.length} activities</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
        
        {/* Vocabulary Section */}
        {activeSection === 'vocabulary' && hasVocabulary && (
          <section className="yl-vocabulary-section">
            <div className="yl-section-header">
              <h2>📚 Let's Learn New Words!</h2>
              <p>Tap a card to see the translation</p>
            </div>
            <div className="yl-vocab-grid">
              {lesson.vocabularyWords.map((word, index) => (
                <VocabCard
                  key={word.id}
                  word={word}
                  index={index}
                  onPlayAudio={() => {
                    if (word.audio) {
                      const audio = new Audio(word.audio);
                      audio.play().catch(() => {});
                    }
                  }}
                />
              ))}
            </div>
          </section>
        )}
        
        {/* Song Section */}
        {activeSection === 'song' && hasSong && (
          <section className="yl-song-section">
            <SongSection song={lesson.song!} />
          </section>
        )}
        
        {/* Story Section */}
        {activeSection === 'story' && hasStory && (
          <section className="yl-story-section">
            <StorySection story={lesson.story!} />
          </section>
        )}
        
        {/* Activities Section */}
        {activeSection === 'activities' && hasActivities && (
          <section className="yl-activities-section">
            <div className="yl-section-header">
              <h2>🎮 Fun Activities!</h2>
              <p>Let's practice what we learned</p>
            </div>
            <div className="yl-activities-list">
              {lesson.activities.map((activity, index) => (
                <ActivitySection
                  key={activity.id}
                  activity={activity}
                  index={index}
                />
              ))}
            </div>
          </section>
        )}
      </main>
      
      {/* Progress Indicator */}
      <footer className="yl-preview-footer">
        <div className="yl-progress-dots">
          <span className={`yl-dot ${activeSection === 'welcome' ? 'active' : ''}`} />
          {hasVocabulary && <span className={`yl-dot ${activeSection === 'vocabulary' ? 'active' : ''}`} />}
          {hasSong && <span className={`yl-dot ${activeSection === 'song' ? 'active' : ''}`} />}
          {hasStory && <span className={`yl-dot ${activeSection === 'story' ? 'active' : ''}`} />}
          {hasActivities && <span className={`yl-dot ${activeSection === 'activities' ? 'active' : ''}`} />}
        </div>
      </footer>
    </div>
  );
}
