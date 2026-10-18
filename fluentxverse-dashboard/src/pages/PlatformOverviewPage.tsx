import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { AdminArt } from '../components/AdminArt';
import { filterGuide, guideChapters, guideGlossary, guideReadingMinutes, guideReferences, guideReviewedOn, type GuideBlock, type GuideTopic } from '../content/platformGuide';
import './PlatformOverviewPage.css';

function ReadingBlock({ block }: { block: GuideBlock }) {
  if (block.kind === 'paragraph') return <p>{block.text}</p>;
  if (block.kind === 'heading') return <h3>{block.text}</h3>;
  if (block.kind === 'note') return <aside class="guide-note"><strong>{block.title}</strong><p>{block.text}</p></aside>;
  if (block.kind === 'table') return <div class="guide-table-scroll" tabIndex={0} role="region" aria-label={block.headings.join(', ')}><table><thead><tr>{block.headings.map(heading => <th key={heading} scope="col">{heading}</th>)}</tr></thead><tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => column === 0 ? <th key={column} scope="row">{cell}</th> : <td key={column} data-label={block.headings[column]}>{cell}</td>)}</tr>)}</tbody></table></div>;
  if (block.kind === 'steps') return <ol class="guide-steps">{block.items.map(item => <li key={item}>{item}</li>)}</ol>;
  return <ul>{block.items.map(item => <li key={item}>{item}</li>)}</ul>;
}

const topics: Array<GuideTopic | 'All'> = ['All', 'Business', 'Operations', 'Technology', 'Privacy'];

export default function PlatformOverviewPage() {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<GuideTopic | 'All'>('All');
  const [active, setActive] = useState('business-model');
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const article = useRef<HTMLElement>(null);
  const chapters = useMemo(() => filterGuide(query, topic), [query, topic]);
  const filtering = Boolean(query.trim()) || topic !== 'All';
  const showReferences = !query.trim() && (!filtering || topic === 'Technology');
  const glossaryWords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const glossary = guideGlossary.filter(entry => glossaryWords.every(word => entry.join(' ').toLowerCase().includes(word)));

  const jump = (id: string) => {
    const element = document.getElementById(`guide-${id}`);
    if (!element) return;
    setActive(id); setChaptersOpen(false);
    history.replaceState(history.state, '', `${location.pathname}${location.search}#guide-${id}`);
    element.scrollIntoView({ block: 'start', behavior: 'auto' });
    element.focus({ preventScroll: true });
  };

  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Platform Guide | FluentXVerse Administration';
    const id = location.hash.replace(/^#guide-/, '');
    if (id && [...guideChapters.map(chapter => chapter.id), 'glossary', 'references'].includes(id)) requestAnimationFrame(() => jump(id));
    return () => { document.title = originalTitle; };
  }, []);

  useEffect(() => {
    if (!article.current) return;
    const sections = Array.from(article.current.querySelectorAll<HTMLElement>('.guide-chapter'));
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id.replace(/^guide-/, ''));
    }, { rootMargin: '-90px 0px -65% 0px', threshold: 0 });
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [chapters, query]);

  const clear = () => { setQuery(''); setTopic('All'); };
  const chapterLink = (id: string, label: string, number?: number) => <a href={`#guide-${id}`} aria-current={active === id ? 'location' : undefined} onClick={event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault(); jump(id);
  }}>{number ? <span>{String(number).padStart(2, '0')}</span> : <i class={id === 'glossary' ? 'ri-book-open-line' : 'ri-links-line'} aria-hidden="true" />}{label}</a>;

  return <div class="platform-guide">
    <header class="guide-header">
      <div class="guide-title"><AdminArt name="training" /><div><span class="guide-eyebrow">FluentXVerse / Internal reading</span><h1>Platform Guide</h1><p>The business, the technology, and how everything works together.</p></div></div>
      <button type="button" class="guide-print" onClick={() => window.print()} title="Print the current reading view"><i class="ri-printer-line" aria-hidden="true" />Print</button>
    </header>
    <div class="guide-meta"><span>{guideChapters.length} chapters</span><span>{guideReadingMinutes} min read</span><span>Code reviewed <time dateTime={guideReviewedOn}>October 13, 2026</time></span></div>
    <div class="guide-introduction">
      <p>Our product is a useful English lesson. The apps coordinate people, appointments, learning material, and follow-up. AI helps with selected tasks; privacy technology can verify specific claims without publishing all the information behind them.</p>
      <p class="guide-scope"><i class="ri-information-line" aria-hidden="true" /><span>This is an internal orientation, not a live deployment report. Implemented workflows, gated pilots, and future work are identified separately. Current agreements and approved operating rules take precedence.</span></p>
    </div>
    <div class="guide-tools">
      <div class="guide-search"><i class="ri-search-line" aria-hidden="true" /><input type="search" aria-label="Search the platform guide" placeholder="Search a topic or question" value={query} onInput={event => setQuery(event.currentTarget.value)} />{query && <button type="button" aria-label="Clear search" title="Clear search" onClick={() => setQuery('')}><i class="ri-close-line" aria-hidden="true" /></button>}</div>
      <div class="guide-topic-tabs" role="group" aria-label="Reading topics">{topics.map(value => <button key={value} type="button" aria-pressed={topic === value} onClick={() => setTopic(value)}>{value}</button>)}</div>
    </div>
    {filtering && <div class="guide-results" role="status"><span>{chapters.length} of {guideChapters.length} chapters{query.trim() ? ` matching "${query.trim()}"` : ` in ${topic}`}</span><button type="button" onClick={clear}><i class="ri-filter-off-line" aria-hidden="true" />Show full guide</button></div>}
    <div class="guide-layout">
      <aside class={`guide-navigation ${chaptersOpen ? 'expanded' : ''}`}>
        <button type="button" class="guide-chapters-toggle" aria-expanded={chaptersOpen} aria-controls="guide-chapter-list" onClick={() => setChaptersOpen(value => !value)}>Chapters<i class={chaptersOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} aria-hidden="true" /></button>
        <div id="guide-chapter-list"><h2>In this guide</h2><nav aria-label="Guide chapters">{chapters.map(chapter => <div key={chapter.id}>{chapterLink(chapter.id, chapter.title, guideChapters.indexOf(chapter) + 1)}</div>)}{glossary.length > 0 && chapterLink('glossary', 'Plain-language glossary')}{showReferences && chapterLink('references', 'Further reading')}</nav><p class="guide-navigation-footnote">Business first. Technology explained in context.</p></div>
      </aside>
      <article ref={article} class="guide-reading" aria-label="FluentXVerse platform guide">
        {!chapters.length && !glossary.length ? <section class="guide-no-results"><AdminArt name="training" /><h2>No matching topics</h2><p>Nothing matches this search and topic combination.</p><button type="button" onClick={clear}>Show full guide</button></section> : null}
        {chapters.map(chapter => <section key={chapter.id} class="guide-chapter" id={`guide-${chapter.id}`} tabIndex={-1} aria-labelledby={`heading-${chapter.id}`} data-topic={chapter.topic}>
          <header class="guide-chapter-header"><AdminArt name={chapter.art} /><div><span class={`guide-chapter-category ${chapter.topic.toLowerCase()}`}>Chapter {String(guideChapters.indexOf(chapter) + 1).padStart(2, '0')} / {chapter.topic}</span><h2 id={`heading-${chapter.id}`}>{chapter.title}</h2><p>{chapter.summary}</p></div></header>
          <div class="guide-prose">{chapter.blocks.map((block, index) => <ReadingBlock key={index} block={block} />)}</div>
        </section>)}
        {glossary.length > 0 && <section class="guide-chapter" id="guide-glossary" tabIndex={-1} aria-labelledby="heading-glossary"><header class="guide-chapter-header"><AdminArt name="training" /><div><span class="guide-chapter-category">Reference</span><h2 id="heading-glossary">Plain-language glossary</h2><p>The terms you will encounter in product and operating discussions.</p></div></header><dl class="guide-glossary">{glossary.map(([term, meaning]) => <div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl></section>}
        {showReferences && <section class="guide-chapter" id="guide-references" tabIndex={-1} aria-labelledby="heading-references"><header class="guide-chapter-header"><AdminArt name="home" /><div><span class="guide-chapter-category">Reference</span><h2 id="heading-references">Further reading</h2><p>Primary documentation for the underlying technology, not endorsements of FluentXVerse.</p></div></header><ul class="guide-references">{guideReferences.map(reference => <li key={reference.href}><a href={reference.href} target="_blank" rel="noopener noreferrer">{reference.title}<i class="ri-external-link-line" aria-hidden="true" /></a><p>{reference.detail}</p></li>)}</ul><p class="guide-source-note">The platform-specific explanation is based on the current application policies and internal records for lesson operations, compensation, call infrastructure, trial booking, private screening, lesson passes, anonymous reviews, and review tallies. It does not expose customer records, private credentials, or wallet secrets.</p></section>}
        <footer class="guide-footer"><span>FluentXVerse / Platform Guide</span><button type="button" onClick={() => { document.querySelector('.guide-header')?.scrollIntoView(); }}><i class="ri-arrow-up-line" aria-hidden="true" />Back to top</button></footer>
      </article>
    </div>
  </div>;
}
