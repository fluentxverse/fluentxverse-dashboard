/**
 * DailyDispatchArchivePage
 * Displays articles for a specific month archive
 */
import { useState, useEffect } from 'preact/hooks';
import { useRoute, useLocation } from 'preact-iso';
import { getDispatchArticlesByMonth, getDispatchArchives, type ArchiveArticleItem, type ArchiveItem } from '../api/dailyDispatch.api';
import DailyDispatchLogo from '../assets/icons/daily-dispatch-logo.svg';
import './DailyDispatchPreviewPage.css';
import './DailyDispatchArchivePage.css';

export default function DailyDispatchArchivePage() {
  const { params } = useRoute();
  const location = useLocation();
  const [articles, setArticles] = useState<ArchiveArticleItem[]>([]);
  const [archives, setArchives] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Decode the month from URL params
  const month = params?.month ? decodeURIComponent(params.month) : '';

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

  useEffect(() => {
    if (month) {
      loadArticles(month);
    }
    loadArchives();
  }, [month]);

  const loadArticles = async (monthStr: string) => {
    try {
      setLoading(true);
      setError('');
      const data = await getDispatchArticlesByMonth(monthStr);
      setArticles(data);
    } catch (err) {
      console.error('Failed to load articles:', err);
      setError('Failed to load articles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadArchives = async () => {
    try {
      const archivesData = await getDispatchArchives();
      setArchives(archivesData);
    } catch (err) {
      console.error('Failed to load archives:', err);
    }
  };

  const handleArticleClick = (articleId: string) => {
    // Open article preview in new tab
    window.open(`/daily-dispatch/preview/${articleId}`, '_blank');
  };

  const handleArchiveClick = (archiveMonth: string) => {
    location.route(`/daily-dispatch/archives/${encodeURIComponent(archiveMonth)}`);
  };

  const handleCategoryClick = (category: string) => {
    // Navigate to category filter (if implemented) or just show all articles for that category
    // For now, just a placeholder
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="ddp-loading">
        <div className="ddp-loading-spinner" />
        <p>Loading articles...</p>
      </div>
    );
  }

  return (
    <div className="ddp-container">
      {/* Header Bar with Logo and Categories */}
      <nav className="ddp-header-bar no-print">
        <div className="ddp-header-bar-inner">
          <a href="/daily-dispatch" className="ddp-toolbar-brand" style={{ textDecoration: 'none' }}>
            <img src={DailyDispatchLogo} alt="Daily Dispatch" className="ddp-logo" />
            <span>Daily Dispatch</span>
          </a>
          <div className="ddp-categories-list">
            {CATEGORIES.map((cat) => (
              <span 
                key={cat} 
                className="ddp-category-item"
                onClick={() => handleCategoryClick(cat)}
                style={{ cursor: 'pointer' }}
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
        <div className="ddp-content dda-content">
          {/* Archive Header */}
          <header className="dda-header">
            <h1 className="dda-month-title">Month: <span>{month}</span></h1>
          </header>

          {/* Error Message */}
          {error && (
            <div className="dda-error">
              <i className="ri-error-warning-line" />
              <p>{error}</p>
            </div>
          )}

          {/* Article List */}
          {articles.length > 0 ? (
            <div className="dda-articles-list">
              {articles.map((article) => (
                <article 
                  key={article.id} 
                  className="dda-article-card"
                  onClick={() => handleArticleClick(article.id)}
                >
                  <h2 className="dda-article-title">{article.title}</h2>
                  <p className="dda-article-date">{formatDate(article.createdAt)}</p>
                  {article.excerpt && (
                    <p className="dda-article-excerpt">{article.excerpt}...</p>
                  )}
                  <p className="dda-article-category">
                    <span 
                      className="dda-article-category-tag"
                      onClick={(e) => { e.stopPropagation(); handleCategoryClick(article.category); }}
                    >
                      {article.category}
                    </span>
                  </p>
                </article>
              ))}
            </div>
          ) : (
            !error && (
              <div className="dda-no-articles">
                <i className="ri-article-line" />
                <p>No articles found for {month}</p>
              </div>
            )
          )}
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
              <input type="text" placeholder="search" />
              <button className="ddp-sidebar-search-btn">search</button>
            </div>
          </div>

          {/* Archives */}
          <div className="ddp-sidebar-section">
            <h3 className="ddp-sidebar-title">Archives</h3>
            {archives.length > 0 ? (
              <ul className="ddp-archives-list">
                {archives.map((archive, i) => (
                  <li key={i} className={archive.month === month ? 'active' : ''}>
                    <a 
                      href="#"
                      onClick={(e) => { e.preventDefault(); handleArchiveClick(archive.month); }}
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
