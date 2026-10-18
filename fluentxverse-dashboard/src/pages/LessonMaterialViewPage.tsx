import { useEffect, useMemo, useState } from 'preact/hooks';
import './LessonMaterialViewPage.css';

type LessonObjective = { id: string; text: string };

type VocabularyItem = {
  id: string;
  term: string;
  meaning: string;
  example: string;
};

type GrammarItem = {
  id: string;
  point: string;
  example: string;
};

type LessonMaterialDraft = {
  version: 1;
  meta: {
    title: string;
    level: string;
    durationMinutes: number;
    topic: string;
  };
  objectives: LessonObjective[];
  warmup: string;
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
  practice: string;
  production: string;
  homework: string;
  teacherNotes: string;
};

const STORAGE_KEY = 'fxv_admin_lesson_material_draft_v1';

const createBlankDraft = (): LessonMaterialDraft => ({
  version: 1,
  meta: {
    title: 'Untitled Lesson',
    level: 'A1',
    durationMinutes: 50,
    topic: '',
  },
  objectives: [],
  warmup: '',
  vocabulary: [],
  grammar: [],
  practice: '',
  production: '',
  homework: '',
  teacherNotes: '',
});

export default function LessonMaterialViewPage() {
  const [draft, setDraft] = useState<LessonMaterialDraft>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createBlankDraft();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return createBlankDraft();
      return parsed as LessonMaterialDraft;
    } catch {
      return createBlankDraft();
    }
  });

  useEffect(() => {
    document.title = `${draft.meta.title || 'Lesson'} | Lesson View`;
  }, [draft.meta.title]);

  // Keep this view in sync if the editor is open
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        if (!e.newValue) {
          setDraft(createBlankDraft());
          return;
        }
        const parsed = JSON.parse(e.newValue);
        if (!parsed || parsed.version !== 1) return;
        setDraft(parsed as LessonMaterialDraft);
      } catch {
        // ignore
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const objectives = useMemo(() => draft.objectives.filter(o => o.text.trim()), [draft.objectives]);
  const vocab = useMemo(
    () => draft.vocabulary.filter(v => v.term.trim() || v.meaning.trim() || v.example.trim()),
    [draft.vocabulary]
  );
  const grammar = useMemo(
    () => draft.grammar.filter(g => g.point.trim() || g.example.trim()),
    [draft.grammar]
  );

  return (
    <div className="lesson-view">
      <div className="lesson-view-sheet">
        <header className="lesson-view-header">
          <div>
            <h1 className="lesson-view-title">{draft.meta.title || 'Untitled Lesson'}</h1>
            <div className="lesson-view-meta">
              <span className="chip"><i className="ri-bar-chart-2-line" /> {draft.meta.level}</span>
              <span className="chip"><i className="ri-time-line" /> {draft.meta.durationMinutes} min</span>
              {draft.meta.topic?.trim() && (
                <span className="chip"><i className="ri-price-tag-3-line" /> {draft.meta.topic}</span>
              )}
            </div>
          </div>
        </header>

        <section className="lesson-view-section">
          <h2>Objectives</h2>
          <ul>
            {objectives.map(o => <li key={o.id}>{o.text}</li>)}
            {objectives.length === 0 && <li className="muted">—</li>}
          </ul>
        </section>

        <section className="lesson-view-section">
          <h2>Warm-up</h2>
          <p className={draft.warmup.trim() ? '' : 'muted'}>{draft.warmup.trim() || '—'}</p>
        </section>

        <section className="lesson-view-section">
          <h2>Vocabulary</h2>
          <div className="table">
            <div className="table-head">
              <span>Term</span>
              <span>Meaning</span>
              <span>Example</span>
            </div>
            {vocab.map(v => (
              <div key={v.id} className="table-row">
                <span>{v.term || '—'}</span>
                <span>{v.meaning || '—'}</span>
                <span>{v.example || '—'}</span>
              </div>
            ))}
            {vocab.length === 0 && (
              <div className="table-row muted">
                <span>—</span><span>—</span><span>—</span>
              </div>
            )}
          </div>
        </section>

        <section className="lesson-view-section">
          <h2>Grammar</h2>
          <div className="table two">
            <div className="table-head two">
              <span>Point</span>
              <span>Example</span>
            </div>
            {grammar.map(g => (
              <div key={g.id} className="table-row two">
                <span>{g.point || '—'}</span>
                <span>{g.example || '—'}</span>
              </div>
            ))}
            {grammar.length === 0 && (
              <div className="table-row two muted">
                <span>—</span><span>—</span>
              </div>
            )}
          </div>
        </section>

        <section className="lesson-view-section">
          <h2>Practice</h2>
          <p className={draft.practice.trim() ? '' : 'muted'}>{draft.practice.trim() || '—'}</p>
        </section>

        <section className="lesson-view-section">
          <h2>Production</h2>
          <p className={draft.production.trim() ? '' : 'muted'}>{draft.production.trim() || '—'}</p>
        </section>

        <section className="lesson-view-section">
          <h2>Homework</h2>
          <p className={draft.homework.trim() ? '' : 'muted'}>{draft.homework.trim() || '—'}</p>
        </section>

        <section className="lesson-view-section">
          <h2>Teacher Notes</h2>
          <p className={draft.teacherNotes.trim() ? '' : 'muted'}>{draft.teacherNotes.trim() || '—'}</p>
        </section>
      </div>
    </div>
  );
}
