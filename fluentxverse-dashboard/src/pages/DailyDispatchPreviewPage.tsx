/**
 * DailyDispatchPreviewPage
 * Full-page standalone preview renderer for Daily Dispatch news article lessons
 * Opens in a new tab for distraction-free viewing
 */
import { useState, useEffect } from 'preact/hooks';
import { useRoute, useLocation } from 'preact-iso';
import { getDispatchArticle, getDispatchArchives, type ArchiveItem } from '../api/dailyDispatch.api';
import type { StoredLesson, DailyDispatchFormState } from '../types/dailyDispatch.types';
import { mapStoredLessonToFormState } from '../types/dailyDispatch.types';
import DailyDispatchLogo from '../assets/icons/daily-dispatch-logo.svg';
import './DailyDispatchPreviewPage.css';

export default function DailyDispatchPreviewPage() {
  const { params } = useRoute();
  const location = useLocation();
  const [data, setData] = useState<DailyDispatchFormState | null>(null);
  const [articleCreatedAt, setArticleCreatedAt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fontSize, setFontSize] = useState<'S' | 'M' | 'L'>('M');
  const [searchQuery, setSearchQuery] = useState('');
  const [archives, setArchives] = useState<ArchiveItem[]>([]);

  const id = params?.id;

  useEffect(() => {
    // Load archives
    loadArchives();
    
    if (id) {
      // Check sessionStorage for unsaved preview data (for previewing before save)
      const storedData = sessionStorage.getItem(`dispatch-preview-${id}`);
      if (storedData) {
        try {
          setData(JSON.parse(storedData));
          setLoading(false);
          return;
        } catch (e) {
          console.error('Failed to parse preview data:', e);
        }
      }
      loadArticle(id);
    }
  }, [id]);

  const loadArchives = async () => {
    try {
      const archivesData = await getDispatchArchives();
      setArchives(archivesData);
    } catch (err) {
      console.error('Failed to load archives:', err);
      // Keep empty array on error
    }
  };

  const loadArticle = async (articleId: string) => {
    try {
      setLoading(true);
      const article = await getDispatchArticle(articleId);
      setData(mapStoredLessonToFormState(article));
      setArticleCreatedAt(article.createdAt);
    } catch (err) {
      console.error('Failed to load article:', err);
      setError('Failed to load article. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Date not set';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    window.close();
  };

  if (loading) {
    return (
      <div className="ddp-loading">
        <div className="ddp-loading-spinner" />
        <p>Loading article...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ddp-error">
        <i className="ri-error-warning-line" />
        <h2>Error</h2>
        <p>{error || 'Article not found'}</p>
        <button className="ddp-btn" onClick={handleClose}>Close</button>
      </div>
    );
  }

  const CATEGORIES = [
    'Technology',
    'Business',
    'Science',
    'Entertainment',
    'Sports',
    'Health & Wellness',
    'Environment',
    'Lifestyle',
    'Education',
  ];

  return (
    <div className={`ddp-container ddp-font-${fontSize.toLowerCase()}`}>
      {/* Header Bar with Logo and Categories */}
      <nav className="ddp-header-bar no-print">
        <div className="ddp-header-bar-inner">
          <div className="ddp-toolbar-brand">
            <img src={DailyDispatchLogo} alt="Daily Dispatch" className="ddp-logo" />
            <span>Daily Dispatch</span>
          </div>
          <div className="ddp-categories-list">
            {CATEGORIES.map((cat) => (
              <span 
                key={cat} 
                className={`ddp-category-item ${data.category === cat ? 'active' : ''}`}
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Layout with Content and Sidebar */}
      <div className="ddp-layout">
        {/* Main Content */}
        <div className="ddp-content">
          {/* Newspaper Header */}
          <header className="ddp-header">
            <div className="ddp-header-line" />
            <h1 className="ddp-title">{data.title || 'Untitled Article'}</h1>
            <div className="ddp-header-line" />
            <div className="ddp-meta">
            <span className="ddp-date">
              <i className="ri-calendar-line" />
              {formatDate(articleCreatedAt)}
            </span>
            <span className="ddp-divider">|</span>
            <span className="ddp-topic">
              <i className="ri-price-tag-3-line" />
              {data.topic || 'Topic not set'}
            </span>
            <span className="ddp-divider">|</span>
            <span className="ddp-category">
              <i className="ri-folder-line" />
              {data.category || 'Uncategorized'}
            </span>
          </div>
        </header>

        {/* Conversation Starters */}
        <section className="ddp-section">
          <div className="ddp-section-header">
            <div className="ddp-section-line" />
            <h2>CONVERSATION STARTERS</h2>
            <div className="ddp-section-line" />
          </div>
          <p className="ddp-instruction">Ask the student these warm-up questions to introduce the topic:</p>
          <ul className="ddp-list ddp-indent">
            {data.warmUpQuestions.filter(q => q.trim()).map((q, i) => (
              <li key={i}>{q}</li>
            ))}
            {data.warmUpQuestions.filter(q => q.trim()).length === 0 && (
              <li className="ddp-empty">No warm-up questions added</li>
            )}
          </ul>
        </section>

        {/* Key Vocabulary */}
        <section className="ddp-section">
          <div className="ddp-section-header">
            <div className="ddp-section-line" />
            <h2>KEY VOCABULARY</h2>
            <div className="ddp-section-line" />
          </div>
          <p className="ddp-instruction">Have the student read each word aloud, explain its meaning, and practice using it in a sentence:</p>
          <div className="ddp-vocabulary">
            {data.vocabulary.filter(v => v.word.trim()).map((vocab, i) => (
              <div key={i} className="ddp-vocab-item">
                <div className="ddp-vocab-header">
                  <span className="ddp-vocab-word">{vocab.word}</span>
                  {vocab.pronunciation && (
                    <span className="ddp-vocab-pronunciation">{vocab.pronunciation}</span>
                  )}
                  {vocab.partOfSpeech && (
                    <span className="ddp-vocab-pos">({vocab.partOfSpeech})</span>
                  )}
                </div>
                <div className="ddp-vocab-body">
                  <p><strong>Meaning:</strong> {vocab.definition}</p>
                  {vocab.exampleSentence && (
                    <p><strong>Usage:</strong> {vocab.exampleSentence}</p>
                  )}
                  {vocab.additionalInfo && (
                    <p><strong>Note:</strong> {vocab.additionalInfo}</p>
                  )}
                </div>
              </div>
            ))}
            {data.vocabulary.filter(v => v.word.trim()).length === 0 && (
              <p className="ddp-empty">No vocabulary words added</p>
            )}
          </div>
        </section>

        {/* Reading Passage */}
        <section className="ddp-section">
          <div className="ddp-section-header">
            <div className="ddp-section-line" />
            <h2>READING PASSAGE</h2>
            <div className="ddp-section-line" />
          </div>
          <p className="ddp-instruction">Have the student read the article aloud. Pause after each comprehension question to discuss:</p>
          <article className="ddp-article">
            {data.articleContent.paragraphs.filter(p => p.text.trim()).map((para) => (
              <div key={para.id} className="ddp-paragraph">
                <p>{para.text}</p>
                {para.comprehensionQuestion && (
                  <div className="ddp-qa">
                    <p className="ddp-question">
                      <span className="ddp-qa-label">Q:</span> {para.comprehensionQuestion.question}
                    </p>
                    <p className="ddp-answer">
                      <span className="ddp-qa-label">A:</span> {para.comprehensionQuestion.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {data.articleContent.paragraphs.filter(p => p.text.trim()).length === 0 && (
              <p className="ddp-empty">No article content added</p>
            )}
          </article>
          {data.articleContent.source && (
            <p className="ddp-source">
              <i className="ri-links-line" />
              This article was provided by {data.articleContent.source}.
            </p>
          )}
        </section>

        {/* Comprehension Check */}
        {data.summaryQuestion && (
          <section className="ddp-section">
            <div className="ddp-section-header">
              <div className="ddp-section-line" />
              <h2>COMPREHENSION CHECK</h2>
              <div className="ddp-section-line" />
            </div>
            <p className="ddp-instruction">Ask the student to summarize the article by answering this question:</p>
            <div className="ddp-comprehension">
              <p className="ddp-summary-question">{data.summaryQuestion}</p>
            </div>
          </section>
        )}

        {/* Discussion Topics */}
        <section className="ddp-section">
          <div className="ddp-section-header">
            <div className="ddp-section-line" />
            <h2>DISCUSSION TOPICS</h2>
            <div className="ddp-section-line" />
          </div>
          <p className="ddp-instruction">Guide the student through these discussion questions to practice expressing opinions:</p>
          
          {data.discussionA.topic && (
            <div className="ddp-discussion">
              <h3>
                <span className="ddp-discussion-badge">A</span>
                {data.discussionA.topic}
              </h3>
              <ul className="ddp-discussion-list">
                {data.discussionA.questions.filter(q => q.trim()).map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {data.discussionB.topic && (
            <div className="ddp-discussion">
              <h3>
                <span className="ddp-discussion-badge">B</span>
                {data.discussionB.topic}
              </h3>
              <ul className="ddp-discussion-list">
                {data.discussionB.questions.filter(q => q.trim()).map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {!data.discussionA.topic && !data.discussionB.topic && (
            <p className="ddp-empty">No discussion topics added</p>
          )}
        </section>

        {/* Footer */}
        <footer className="ddp-footer">
          <div className="ddp-footer-line" />
          <p>FluentXVerse Daily Dispatch</p>
        </footer>
        </div>

        {/* Sidebar */}
        <aside className="ddp-sidebar no-print">
          {/* Search */}
          <div className="ddp-sidebar-section">
            <h3 className="ddp-sidebar-title">
              <span>Search</span>
              <span className="ddp-sidebar-subtitle">Search by title</span>
            </h3>
            <div className="ddp-sidebar-search">
              <input
                type="text"
                placeholder="search"
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              />
              <button className="ddp-sidebar-search-btn">search</button>
            </div>
          </div>

          {/* Font Size */}
          <div className="ddp-sidebar-section">
            <h3 className="ddp-sidebar-title">
              <span>Font</span>
              <span className="ddp-sidebar-subtitle">size</span>
            </h3>
            <div className="ddp-font-size-btns">
              {(['S', 'M', 'L'] as const).map((size) => (
                <button
                  key={size}
                  className={`ddp-font-size-btn ${fontSize === size ? 'active' : ''}`}
                  onClick={() => setFontSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Archives */}
          <div className="ddp-sidebar-section">
            <h3 className="ddp-sidebar-title">Archives</h3>
            {archives.length > 0 ? (
              <ul className="ddp-archives-list">
                {archives.map((archive, i) => (
                  <li key={i}>
                    <a 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        location.route(`/daily-dispatch/archives/${encodeURIComponent(archive.month)}`);
                      }}
                    >
                      {archive.month}
                    </a>
                    <span className="ddp-archive-count">({archive.count})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ddp-sidebar-empty">No archives yet</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
