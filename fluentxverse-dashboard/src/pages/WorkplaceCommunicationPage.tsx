import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { createLesson, listLessonsByCourse, updateLessonHeader, type LessonMaterial } from '../api/lessonMaterial.api';
import { toast } from '../Components/Toast/Toast';
import { WORKPLACE_COMMUNICATION_COURSE, WORKPLACE_TEMPLATES, createWorkplaceTemplate, parseWorkplaceData, type WorkplaceCommunicationData, type WorkplaceLessonMode, type WorkplaceTranslation } from '../../../shared/workplaceCommunication';
import './WorkplaceCommunicationPage.css';

interface WorkplaceDraft {
  id?: string;
  level: number;
  chapter: number;
  lessonNumber: number;
  chapterName: string;
  lessonName: string;
  goalTextEn: string;
  goalTextJp: string;
  workplaceData: WorkplaceCommunicationData;
}

const modeLabel = (mode: WorkplaceLessonMode) => mode === 'prepare' ? 'Prepare' : 'Perform';

export default function WorkplaceCommunicationPage() {
  const location = useLocation();
  const [lessons, setLessons] = useState<LessonMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<WorkplaceLessonMode>('prepare');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<WorkplaceDraft | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [showTutorNotes, setShowTutorNotes] = useState(false);

  const loadLessons = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listLessonsByCourse(WORKPLACE_COMMUNICATION_COURSE);
      if (!Array.isArray(result)) throw new Error('Invalid lesson list');
      setLessons(result);
    } catch {
      setError('Could not load Workplace Communication lessons.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadLessons(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const newDraft = () => {
    const used = new Set(lessons.filter(lesson => lesson.level === 1 && lesson.chapter === 1).map(lesson => lesson.lessonNumber));
    const nextNumber = Array.from({ length: 10 }, (_, index) => index + 1).find(number => !used.has(number)) || 1;
    setDraft({ level: 1, chapter: 1, lessonNumber: nextNumber, chapterName: '', lessonName: '', goalTextEn: '', goalTextJp: '', workplaceData: createWorkplaceTemplate(mode) });
    setActiveSection(0);
    setPreview(false);
    setShowTutorNotes(false);
    setDirty(false);
  };

  const openLesson = (lesson: LessonMaterial) => {
    try {
      const data = parseWorkplaceData(lesson.workplaceData);
      setDraft({ id: lesson.id, level: lesson.level, chapter: lesson.chapter, lessonNumber: lesson.lessonNumber, chapterName: lesson.chapterName, lessonName: lesson.lessonName, goalTextEn: lesson.goalTextEn, goalTextJp: lesson.goalTextJp, workplaceData: data });
      setActiveSection(0);
      setPreview(false);
      setShowTutorNotes(false);
      setDirty(false);
    } catch { toast.error('This lesson has an unsupported template. Its content has not been changed.'); }
  };

  const updateDraft = (updates: Partial<WorkplaceDraft>) => {
    setDraft(current => current ? { ...current, ...updates } : current);
    setDirty(true);
  };

  const saveDraft = async (event: Event) => {
    event.preventDefault();
    if (!draft || saving) return;
    if (!draft.lessonName.trim() || !draft.goalTextEn.trim()) {
      toast.error('Add a lesson title and lesson objective.');
      return;
    }
    if (!Number.isInteger(draft.level) || draft.level < 1 || draft.level > 10
      || !Number.isInteger(draft.chapter) || draft.chapter < 1 || draft.chapter > 5
      || !Number.isInteger(draft.lessonNumber) || draft.lessonNumber < 1 || draft.lessonNumber > 10) {
      toast.error('Choose a valid level, chapter, and lesson number.');
      return;
    }
    setSaving(true);
    try {
      const payload = { lessonName: draft.lessonName.trim(), chapterName: draft.chapterName.trim(), goalTextEn: draft.goalTextEn.trim(), goalTextJp: draft.goalTextJp, workplaceData: parseWorkplaceData(draft.workplaceData) };
      const saved = draft.id
        ? await updateLessonHeader(draft.id, payload)
        : await createLesson({ ...payload, course: WORKPLACE_COMMUNICATION_COURSE, skill: 'speaking', level: draft.level, chapter: draft.chapter, lessonNumber: draft.lessonNumber });
      if (!saved?.id || !saved.workplaceData) throw new Error('The server did not confirm the saved template.');
      parseWorkplaceData(saved.workplaceData);
      setLessons(current => [...current.filter(lesson => lesson.id !== saved.id), saved]);
      setDraft(current => current ? { ...current, id: saved.id } : current);
      setDirty(false);
      toast.success('Workplace Communication draft saved.');
    } catch (failure: any) {
      toast.error(failure?.response?.data?.error || failure?.message || 'Could not save the draft.');
    } finally { setSaving(false); }
  };

  const closeDraft = () => {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    setDraft(null);
    setDirty(false);
    setPreview(false);
  };

  if (draft) {
    const template = WORKPLACE_TEMPLATES[draft.workplaceData.mode];
    const section = draft.workplaceData.sections[activeSection];
    const translated = draft.workplaceData.translationLanguage !== 'none';
    const translationLabel = draft.workplaceData.translationLanguage === 'ja' ? 'Japanese' : 'Korean';
    const updateSection = (field: 'content' | 'translation' | 'tutorNotes', value: string) => {
      updateDraft({ workplaceData: { ...draft.workplaceData, sections: draft.workplaceData.sections.map((item, index) => index === activeSection ? { ...item, [field]: value } : item) } });
    };
    return <div className="wc-page">
      <form onSubmit={saveDraft}>
        <header className="wc-header">
          <div><button className="wc-back" type="button" onClick={closeDraft} disabled={saving}><i aria-hidden="true" className="ri-arrow-left-line" /> All lessons</button><h1>Workplace Communication</h1><p>{modeLabel(draft.workplaceData.mode)} <span aria-hidden="true">/</span> {draft.lessonName || 'New lesson'} <span className="wc-status">{dirty ? 'Unsaved' : draft.id ? 'Saved' : 'Draft'}</span></p></div>
          <div className="wc-actions">
            <button type="button" onClick={() => setPreview(value => !value)} disabled={saving}><i aria-hidden="true" className={preview ? 'ri-edit-line' : 'ri-eye-line'} />{preview ? 'Edit' : 'Preview'}</button>
            <button type="submit" className="wc-primary" disabled={saving || (Boolean(draft.id) && !dirty)}><i aria-hidden="true" className="ri-save-line" />{saving ? 'Saving...' : 'Save draft'}</button>
          </div>
        </header>
        {preview ? <>
          <div className="wc-preview-controls"><label><input type="checkbox" checked={showTutorNotes} onChange={event => setShowTutorNotes(event.currentTarget.checked)} /> Facilitator notes</label><span>25 minutes</span></div>
          <article className="wc-preview">
            <h2>{draft.lessonName || 'Untitled lesson'}</h2><p className="wc-eyebrow">Lesson objective</p><p>{draft.goalTextEn || 'Objective not added'}</p>{translated && draft.goalTextJp && <p lang={draft.workplaceData.translationLanguage}>{draft.goalTextJp}</p>}
            {template.map((item, index) => <section key={item.id}><header><h3>{index + 1}. {item.heading}</h3><span>{item.minutes} min</span></header><p className="wc-text">{draft.workplaceData.sections[index].content || 'Content not added'}</p>{translated && <p className="wc-text wc-muted" lang={draft.workplaceData.translationLanguage}>{draft.workplaceData.sections[index].translation}</p>}{showTutorNotes && <aside><h4>Facilitator notes</h4><p className="wc-text">{draft.workplaceData.sections[index].tutorNotes || 'Notes not added'}</p></aside>}</section>)}
          </article>
        </> : <fieldset disabled={saving} className="wc-editor-fields">
          <div className="wc-metadata">
            <label className="wc-wide">Lesson title<input value={draft.lessonName} maxLength={200} required onInput={event => updateDraft({ lessonName: event.currentTarget.value })} /></label>
            <label>Level<input type="number" min={1} max={10} step={1} required disabled={Boolean(draft.id)} value={draft.level} onInput={event => updateDraft({ level: event.currentTarget.valueAsNumber })} /></label>
            <label>Chapter<input type="number" min={1} max={5} step={1} required disabled={Boolean(draft.id)} value={draft.chapter} onInput={event => updateDraft({ chapter: event.currentTarget.valueAsNumber })} /></label>
            <label>Lesson number<input type="number" min={1} max={10} step={1} required disabled={Boolean(draft.id)} value={draft.lessonNumber} onInput={event => updateDraft({ lessonNumber: event.currentTarget.valueAsNumber })} /></label>
            <label>Translation<select aria-label="Translation" value={draft.workplaceData.translationLanguage} onChange={event => updateDraft({ workplaceData: { ...draft.workplaceData, translationLanguage: event.currentTarget.value as WorkplaceTranslation } })}><option value="none">None</option><option value="ja">Japanese</option><option value="ko">Korean</option></select></label>
            <label className="wc-wide">Chapter title<input value={draft.chapterName} maxLength={200} onInput={event => updateDraft({ chapterName: event.currentTarget.value })} /></label>
            <label className="wc-wide">Lesson objective<textarea rows={2} required maxLength={1000} value={draft.goalTextEn} onInput={event => updateDraft({ goalTextEn: event.currentTarget.value })} /></label>
            {translated && <label className="wc-wide">Lesson objective ({translationLabel})<textarea rows={2} maxLength={1000} value={draft.goalTextJp} onInput={event => updateDraft({ goalTextJp: event.currentTarget.value })} /></label>}
          </div>
          <div className="wc-editor-layout">
            <nav className="wc-section-nav" aria-label="Lesson sections">{template.map((item, index) => <button type="button" key={item.id} aria-current={activeSection === index ? 'step' : undefined} onClick={() => setActiveSection(index)}><span>{index + 1}</span><span>{item.heading}</span><small>{item.minutes} min</small></button>)}</nav>
            <section className="wc-section-editor">
              <header><h2>{template[activeSection].heading}</h2><span>{template[activeSection].minutes} minutes</span></header>
              <div className="wc-content-fields"><div><label>Student material<textarea rows={12} maxLength={20000} value={section.content} onInput={event => updateSection('content', event.currentTarget.value)} /></label>{translated && <label>Student material ({translationLabel})<textarea rows={7} maxLength={20000} value={section.translation} onInput={event => updateSection('translation', event.currentTarget.value)} /></label>}</div><label>Facilitator notes<textarea rows={12} maxLength={20000} value={section.tutorNotes} onInput={event => updateSection('tutorNotes', event.currentTarget.value)} /></label></div>
            </section>
          </div>
        </fieldset>}
      </form>
    </div>;
  }

  const filtered = lessons.filter(lesson => lesson.workplaceData?.mode === mode && `${lesson.lessonName} ${lesson.chapterName}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="wc-page">
    <header className="wc-header"><div><button type="button" className="wc-back" onClick={() => location.route('/lesson-material-maker')}><i aria-hidden="true" className="ri-arrow-left-line" /> Material categories</button><h1>Workplace Communication</h1><p>Lesson library <span className="wc-status">{lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}</span></p></div><button type="button" className="wc-primary" onClick={newDraft} disabled={loading || Boolean(error)}><i aria-hidden="true" className="ri-add-line" />New {modeLabel(mode)} lesson</button></header>
    <div className="wc-library-toolbar"><div className="wc-modes" role="group" aria-label="Lesson format">{(['prepare', 'perform'] as const).map(value => <button type="button" aria-pressed={mode === value} onClick={() => setMode(value)} key={value}><i aria-hidden="true" className={value === 'prepare' ? 'ri-book-open-line' : 'ri-discuss-line'} />{modeLabel(value)}</button>)}</div><label className="wc-search"><i className="ri-search-line" aria-hidden="true" /><input type="search" aria-label="Search lessons" placeholder="Search lessons" value={search} onInput={event => setSearch(event.currentTarget.value)} /></label></div>
    <section className="wc-outline" aria-label={`${modeLabel(mode)} lesson structure`}><header><h2>{modeLabel(mode)} lesson structure</h2><span>25 minutes</span></header><ol>{WORKPLACE_TEMPLATES[mode].map(section => <li key={section.id}><span>{section.heading}</span><small>{section.minutes} min</small></li>)}</ol></section>
    {loading ? <p role="status" className="wc-empty">Loading lessons...</p> : error ? <div role="alert" className="wc-empty"><p>{error}</p><button type="button" onClick={loadLessons}><i aria-hidden="true" className="ri-refresh-line" />Retry</button></div> : filtered.length ? <div className="wc-table-scroll"><table className="wc-lesson-table"><thead><tr><th>Lesson</th><th>Level / chapter</th><th>Status</th><th>Updated</th><th><span className="wc-sr-only">Actions</span></th></tr></thead><tbody>{filtered.sort((left, right) => left.level - right.level || left.chapter - right.chapter || left.lessonNumber - right.lessonNumber).map(lesson => <tr key={lesson.id}><td><strong>{lesson.lessonName}</strong><small>Lesson {lesson.lessonNumber}{lesson.chapterName ? ` / ${lesson.chapterName}` : ''}</small></td><td>{lesson.level} / {lesson.chapter}</td><td><span className="wc-status">{lesson.status}</span></td><td>{new Date(lesson.updatedAt).toLocaleDateString()}</td><td><button type="button" onClick={() => openLesson(lesson)} aria-label={`Edit ${lesson.lessonName}`} title={`Edit ${lesson.lessonName}`}><i aria-hidden="true" className="ri-edit-line" /></button></td></tr>)}</tbody></table></div> : <div className="wc-empty"><i className="ri-draft-line" aria-hidden="true" /><h2>{search ? 'No matching lessons' : `No ${modeLabel(mode)} lessons yet`}</h2>{search ? <button type="button" onClick={() => setSearch('')}>Clear search</button> : <button type="button" onClick={newDraft}><i aria-hidden="true" className="ri-add-line" />Create {modeLabel(mode)} lesson</button>}</div>}
  </div>;
}
