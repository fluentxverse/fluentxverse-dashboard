/**
 * LessonMaterialMakerPage - Simplified Data-Driven Lesson Editor
 * Uses JSON data structure that LessonRenderer can display
 */
import { useState, useCallback } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type {
  LessonMaterial,
  LessonSection,
  TemplateInfo,
  SavedLesson,
  SectionType,
} from '../types/lesson.types';
import { createConversationalTemplate } from './templates/conversational.template';
import { toast } from '../Components/Toast/Toast';
import './LessonMaterialMakerPage.css';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'fxv_admin_lesson_material_draft_v3';
const SAVED_LESSONS_KEY = 'fxv_admin_saved_lessons_v2';

// Course templates
const COURSE_TEMPLATES: TemplateInfo[] = [
  {
    id: 'conversational-skills',
    name: 'Conversational Skills',
    course: 'Conversational Skills',
    category: 'Conversation',
    icon: '💬',
    description: 'Speaking, Listening, and Reading - New No-Code Editor',
    sections: 12,
    lastUpdated: '2026-01-12',
    status: 'published',
  },
  {
    id: 'daily-dispatch',
    name: 'Daily Dispatch',
    course: 'Daily Dispatch',
    category: 'Reading',
    icon: '📰',
    description: 'News articles with vocabulary, comprehension questions, and discussion topics',
    sections: 6,
    lastUpdated: '2026-01-17',
    status: 'published',
  },
  {
    id: 'young-learners',
    name: 'Young Learners',
    course: 'Young Learners',
    category: 'Kids',
    icon: '🧒',
    description: 'Fun activities for young English learners',
    sections: 10,
    lastUpdated: '2026-01-12',
    status: 'draft',
  },
  {
    id: 'business-english',
    name: 'Business English',
    course: 'Business English',
    category: 'Business',
    icon: '💼',
    description: 'Professional English for workplace',
    sections: 10,
    lastUpdated: '2026-01-12',
    status: 'draft',
  },
  {
    id: 'discussion-questions',
    name: 'Discussion Questions',
    course: 'Discussion Questions',
    category: 'Conversation',
    icon: '💡',
    description: '20 thought-provoking questions',
    sections: 1,
    lastUpdated: '2026-01-12',
    status: 'draft',
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LessonMaterialMakerPage() {
  const [view, setView] = useState<'templates' | 'editor' | 'preview'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);
  const [lessonData, setLessonData] = useState<LessonMaterial | null>(null);
  const [savedLessons, setSavedLessons] = useState<SavedLesson[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_LESSONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [activeSection, setActiveSection] = useState(0);
  const [previewMode, setPreviewMode] = useState<'tutor' | 'student'>('tutor');
  const location = useLocation();

  // Load template and create lesson data
  const handleSelectTemplate = useCallback((template: TemplateInfo) => {
    // Redirect to specialized editors
    if (template.id === 'conversational-skills') {
      location.route('/conversational-skills-editor');
      return;
    }
    if (template.id === 'daily-dispatch') {
      location.route('/daily-dispatch');
      return;
    }
    if (template.id === 'young-learners') {
      location.route('/young-learners-editor');
      return;
    }
    if (template.id === 'discussion-questions') {
      location.route('/discussion-questions-editor');
      return;
    }
    if (template.id === 'business-english') {
      location.route('/business-english-editor');
      return;
    }
    
    setSelectedTemplate(template);
    const data = createConversationalTemplate(); // For now, use conversational for all
    setLessonData(data);
    setView('editor');
    setActiveSection(0);
  }, []);

  // Save lesson
  const handleSave = useCallback(() => {
    if (!lessonData || !selectedTemplate) return;

    const lesson: SavedLesson = {
      id: `lesson-${Date.now()}`,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      level: 1,
      chapter: 1,
      lessonNumber: 1,
      goalName: lessonData.header.goalText,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      draft: lessonData,
    };

    const updated = [...savedLessons, lesson];
    setSavedLessons(updated);
    localStorage.setItem(SAVED_LESSONS_KEY, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lessonData));
    toast.success('Lesson saved!');
  }, [lessonData, selectedTemplate, savedLessons]);

  // Update section data
  const updateSection = useCallback((index: number, updates: Partial<LessonSection>) => {
    if (!lessonData) return;
    const newSections = [...lessonData.sections];
    newSections[index] = { ...newSections[index], ...updates };
    setLessonData({ ...lessonData, sections: newSections });
  }, [lessonData]);

  // Update header
  const updateHeader = useCallback((updates: Partial<LessonMaterial['header']>) => {
    if (!lessonData) return;
    setLessonData({ ...lessonData, header: { ...lessonData.header, ...updates } });
  }, [lessonData]);

  // Render based on view
  if (view === 'templates') {
    return (
      <TemplateSelector
        templates={COURSE_TEMPLATES}
        savedLessons={savedLessons}
        onSelect={handleSelectTemplate}
        onLoadLesson={(lesson) => {
          setLessonData(lesson.draft);
          setSelectedTemplate(COURSE_TEMPLATES.find(t => t.id === lesson.templateId) || null);
          setView('editor');
        }}
      />
    );
  }

  if (view === 'preview' && lessonData) {
    return (
      <LessonPreview
        data={lessonData}
        mode={previewMode}
        onBack={() => setView('editor')}
        onModeChange={setPreviewMode}
      />
    );
  }

  if (view === 'editor' && lessonData) {
    return (
      <LessonEditor
        data={lessonData}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onUpdateSection={updateSection}
        onUpdateHeader={updateHeader}
        onSave={handleSave}
        onPreview={() => setView('preview')}
        onBack={() => setView('templates')}
      />
    );
  }

  return <div>Loading...</div>;
}

// ============================================================================
// TEMPLATE SELECTOR
// ============================================================================

function TemplateSelector({
  templates,
  savedLessons,
  onSelect,
  onLoadLesson,
}: {
  templates: TemplateInfo[];
  savedLessons: SavedLesson[];
  onSelect: (t: TemplateInfo) => void;
  onLoadLesson: (l: SavedLesson) => void;
}) {
  const [tab, setTab] = useState<'templates' | 'saved'>('templates');

  return (
    <div className="lmm-container">
      {/* Page Header */}
      <div className="lmm-page-header">
        <div className="lmm-header-content">
          <div className="lmm-title-row">
            <div className="lmm-title-icon">
              <i className="ri-book-2-line" />
            </div>
            <div>
              <h1 className="lmm-title">Lesson Material Maker</h1>
              <p className="lmm-subtitle">Create and manage lesson templates</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="lmm-tabs">
        <button
          className={`lmm-tab ${tab === 'templates' ? 'active' : ''}`}
          onClick={() => setTab('templates')}
        >
          <i className="ri-file-copy-line" />
          Templates
        </button>
        <button
          className={`lmm-tab ${tab === 'saved' ? 'active' : ''}`}
          onClick={() => setTab('saved')}
        >
          <i className="ri-folder-line" />
          My Lessons
          {savedLessons.length > 0 && <span className="lmm-tab-badge">{savedLessons.length}</span>}
        </button>
      </div>

      {/* Templates Grid */}
      {tab === 'templates' && (
        <div className="lmm-templates-grid">
          {templates.map((t) => (
            <div
              key={t.id}
              className="lmm-template-card"
              onClick={() => {
                if (t.id === 'conversational-skills') {
                  window.location.href = '/conversational-skills-editor';
                } else if (t.id === 'daily-dispatch') {
                  window.location.href = '/daily-dispatch';
                } else if (t.id === 'business-english') {
                  window.location.href = '/business-english-editor';
                } else if (t.id === 'young-learners') {
                  window.location.href = '/young-learners-editor';
                } else if (t.id === 'discussion-questions') {
                  window.location.href = '/discussion-questions-editor';
                } else {
                  onSelect(t);
                }
              }}
            >
              <div className="lmm-template-icon">{t.icon}</div>
              <div className="lmm-template-content">
                <h3 className="lmm-template-name">{t.name}</h3>
                <p className="lmm-template-desc">{t.description}</p>
                <div className="lmm-template-meta">
                  <span className="lmm-template-sections">
                    <i className="ri-stack-line" />
                    {t.sections} sections
                  </span>
                  <span className="lmm-template-category">{t.category}</span>
                </div>
              </div>
              <div className="lmm-template-action">
                <i className="ri-arrow-right-line" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Saved Lessons Grid */}
      {tab === 'saved' && (
        <div className="lmm-lessons-container">
          {savedLessons.length === 0 ? (
            <div className="lmm-empty-state">
              <div className="lmm-empty-icon">
                <i className="ri-folder-open-line" />
              </div>
              <h3>No saved lessons yet</h3>
              <p>Select a template to create your first lesson</p>
              <button className="lmm-empty-btn" onClick={() => setTab('templates')}>
                <i className="ri-add-line" />
                Browse Templates
              </button>
            </div>
          ) : (
            <div className="lmm-lessons-grid">
              {savedLessons.map((lesson) => (
                <div key={lesson.id} className="lmm-lesson-card" onClick={() => onLoadLesson(lesson)}>
                  <div className="lmm-lesson-header">
                    <span className={`lmm-lesson-status ${lesson.status}`}>
                      {lesson.status === 'draft' ? 'Draft' : 'Published'}
                    </span>
                    <span className="lmm-lesson-date">
                      {new Date(lesson.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="lmm-lesson-title">{lesson.goalName || 'Untitled Lesson'}</h3>
                  <p className="lmm-lesson-meta">
                    Level {lesson.level} • Chapter {lesson.chapter} • Lesson {lesson.lessonNumber}
                  </p>
                  <div className="lmm-lesson-footer">
                    <span className="lmm-lesson-template">
                      <i className="ri-file-copy-line" />
                      {lesson.templateName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LESSON EDITOR
// ============================================================================

function LessonEditor({
  data,
  activeSection,
  onSectionChange,
  onUpdateSection,
  onUpdateHeader,
  onSave,
  onPreview,
  onBack,
}: {
  data: LessonMaterial;
  activeSection: number;
  onSectionChange: (i: number) => void;
  onUpdateSection: (i: number, u: Partial<LessonSection>) => void;
  onUpdateHeader: (u: Partial<LessonMaterial['header']>) => void;
  onSave: () => void;
  onPreview: () => void;
  onBack: () => void;
}) {
  const section = data.sections[activeSection];

  return (
    <div className="lmm-editor">
      {/* Toolbar */}
      <div className="lmm-toolbar">
        <button className="lmm-btn-back" onClick={onBack}>
          <i className="ri-arrow-left-line" />
          Back
        </button>
        <div className="lmm-toolbar-title">
          <span className="lmm-toolbar-badge">{data.header.levelBadge}</span>
          <h2>{data.header.lessonLabel}</h2>
        </div>
        <div className="lmm-toolbar-actions">
          <button className="lmm-btn lmm-btn-secondary" onClick={onPreview}>
            <i className="ri-eye-line" />
            Preview
          </button>
          <button className="lmm-btn lmm-btn-primary" onClick={onSave}>
            <i className="ri-save-line" />
            Save
          </button>
        </div>
      </div>

      <div className="lmm-editor-layout">
        {/* Section Navigation */}
        <aside className="lmm-sidebar">
          <div className="lmm-sidebar-header">
            <h3>Sections</h3>
            <span className="lmm-sidebar-count">{data.sections.length}</span>
          </div>
          <div className="lmm-section-list">
            {data.sections.map((s, i) => (
              <button
                key={s.id}
                className={`lmm-section-btn ${i === activeSection ? 'active' : ''}`}
                onClick={() => onSectionChange(i)}
              >
                <span className="lmm-section-num">{s.sectionNumber}</span>
                <span className="lmm-section-name">{s.sectionTitle || s.stepTitle || s.sectionType}</span>
                <span className="lmm-section-type-badge">{s.sectionType}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Editor Panel */}
        <main className="lmm-main">
          {/* Header Editor (only show for first section) */}
          {activeSection === 0 && (
            <HeaderEditor header={data.header} onUpdate={onUpdateHeader} />
          )}

          {/* Section Editor */}
          <SectionEditor
            section={section}
            onUpdate={(updates) => onUpdateSection(activeSection, updates)}
          />
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// HEADER EDITOR
// ============================================================================

function HeaderEditor({
  header,
  onUpdate,
}: {
  header: LessonMaterial['header'];
  onUpdate: (u: Partial<LessonMaterial['header']>) => void;
}) {
  return (
    <div className="lmm-card">
      <div className="lmm-card-header">
        <i className="ri-layout-top-line" />
        <h3>Lesson Header</h3>
      </div>
      <div className="lmm-form-grid">
        <div className="lmm-form-field">
          <label>Level Badge</label>
          <input value={header.levelBadge} onChange={(e) => onUpdate({ levelBadge: (e.target as HTMLInputElement).value })} />
        </div>
        <div className="lmm-form-field">
          <label>Chapter Label</label>
          <input value={header.chapterLabel} onChange={(e) => onUpdate({ chapterLabel: (e.target as HTMLInputElement).value })} />
        </div>
        <div className="lmm-form-field">
          <label>Lesson Label</label>
          <input value={header.lessonLabel} onChange={(e) => onUpdate({ lessonLabel: (e.target as HTMLInputElement).value })} />
        </div>
        <div className="lmm-form-field">
          <label>Goal (English)</label>
          <input value={header.goalText} onChange={(e) => onUpdate({ goalText: (e.target as HTMLInputElement).value })} />
        </div>
        <div className="lmm-form-field">
          <label>Goal (Japanese)</label>
          <input value={header.goalSubtext} onChange={(e) => onUpdate({ goalSubtext: (e.target as HTMLInputElement).value })} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION EDITOR - Routes to correct editor based on type
// ============================================================================

function SectionEditor({
  section,
  onUpdate,
}: {
  section: LessonSection;
  onUpdate: (u: Partial<LessonSection>) => void;
}) {
  return (
    <div className="lmm-card">
      <div className="lmm-card-header">
        <i className="ri-file-text-line" />
        <h3>{section.sectionTitle || section.stepTitle || 'Section'}</h3>
        <span className="lmm-type-badge">{section.sectionType}</span>
      </div>

      {/* Common fields */}
      <div className="lmm-form-row">
        <div className="lmm-form-field">
          <label>Section Title</label>
          <input value={section.sectionTitle || ''} onChange={(e) => onUpdate({ sectionTitle: (e.target as HTMLInputElement).value })} />
        </div>
        <div className="lmm-form-field">
          <label>Step Title</label>
          <input value={section.stepTitle || ''} onChange={(e) => onUpdate({ stepTitle: (e.target as HTMLInputElement).value })} />
        </div>
      </div>

      {/* Type-specific editor */}
      {renderSectionTypeEditor(section, onUpdate)}
    </div>
  );
}

function renderSectionTypeEditor(
  section: LessonSection,
  onUpdate: (u: Partial<LessonSection>) => void
) {
  switch (section.sectionType) {
    case 'introduce':
      return <IntroduceEditor section={section} onUpdate={onUpdate} />;
    case 'vocabulary':
      return <VocabularyEditor section={section} onUpdate={onUpdate} />;
    case 'grammar':
      return <GrammarEditor section={section} onUpdate={onUpdate} />;
    case 'dialogue':
      return <DialogueEditor section={section} onUpdate={onUpdate} />;
    case 'practice':
      return <PracticeEditor section={section} onUpdate={onUpdate} />;
    case 'challenge':
    case 'challenge2':
      return <ChallengeEditor section={section} onUpdate={onUpdate} />;
    default:
      return <GenericEditor section={section} onUpdate={onUpdate} />;
  }
}

// ============================================================================
// SECTION TYPE EDITORS
// ============================================================================

function IntroduceEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  return (
    <div className="lm-form-group">
      <label>
        Explanation (English)
        <textarea value={section.explanationEn || ''} onChange={(e) => onUpdate({ explanationEn: (e.target as HTMLTextAreaElement).value })} rows={3} />
      </label>
      <label>
        Explanation (Japanese)
        <textarea value={section.explanationJp || ''} onChange={(e) => onUpdate({ explanationJp: (e.target as HTMLTextAreaElement).value })} rows={3} />
      </label>
      <label>
        Important Note
        <textarea value={section.importantNote || ''} onChange={(e) => onUpdate({ importantNote: (e.target as HTMLTextAreaElement).value })} rows={2} />
      </label>
    </div>
  );
}

function VocabularyEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  const vocabCards = section.vocabCards || [];

  const updateCard = (index: number, field: string, value: string) => {
    const newCards = [...vocabCards];
    newCards[index] = { ...newCards[index], [field]: value };
    onUpdate({ vocabCards: newCards });
  };

  const addCard = () => {
    onUpdate({
      vocabCards: [...vocabCards, { id: `vocab-${Date.now()}`, image: '', wordEn: '', wordJp: '' }],
    });
  };

  return (
    <div className="lm-form-group">
      <label>
        Instruction (English)
        <input value={section.instructionEn || ''} onChange={(e) => onUpdate({ instructionEn: (e.target as HTMLInputElement).value })} />
      </label>
      <label>
        Instruction (Japanese)
        <input value={section.instructionJp || ''} onChange={(e) => onUpdate({ instructionJp: (e.target as HTMLInputElement).value })} />
      </label>

      <h4>Vocabulary Cards</h4>
      <div className="lm-vocab-list">
        {vocabCards.map((card, i) => (
          <div key={card.id} className="lm-vocab-item">
            <input placeholder="English" value={card.wordEn} onChange={(e) => updateCard(i, 'wordEn', (e.target as HTMLInputElement).value)} />
            <input placeholder="Japanese" value={card.wordJp} onChange={(e) => updateCard(i, 'wordJp', (e.target as HTMLInputElement).value)} />
          </div>
        ))}
        <button className="lm-btn-add" onClick={addCard}>+ Add Word</button>
      </div>
    </div>
  );
}

function GrammarEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  return (
    <div className="lm-form-group">
      <label>
        Grammar Tip (English)
        <textarea value={section.instructionEn || ''} onChange={(e) => onUpdate({ instructionEn: (e.target as HTMLTextAreaElement).value })} rows={2} />
      </label>
      <label>
        Grammar Tip (Japanese)
        <textarea value={section.instructionJp || ''} onChange={(e) => onUpdate({ instructionJp: (e.target as HTMLTextAreaElement).value })} rows={2} />
      </label>
      <p className="lm-hint">Grammar rules can be edited in JSON mode for complex structures.</p>
    </div>
  );
}

function DialogueEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  const lines = section.dialogueLines || [];

  const updateLine = (index: number, field: string, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    onUpdate({ dialogueLines: newLines });
  };

  const addLine = () => {
    onUpdate({
      dialogueLines: [...lines, { id: `line-${Date.now()}`, speaker: '', lineEn: '' }],
    });
  };

  return (
    <div className="lm-form-group">
      <label>
        Situation (English)
        <textarea value={section.instructionEn || ''} onChange={(e) => onUpdate({ instructionEn: (e.target as HTMLTextAreaElement).value })} rows={2} />
      </label>

      <h4>Dialogue Lines</h4>
      <div className="lm-dialogue-list">
        {lines.map((line, i) => (
          <div key={line.id} className="lm-dialogue-item">
            <input placeholder="Speaker" value={line.speaker} onChange={(e) => updateLine(i, 'speaker', (e.target as HTMLInputElement).value)} className="lm-speaker" />
            <input placeholder="Line" value={line.lineEn} onChange={(e) => updateLine(i, 'lineEn', (e.target as HTMLInputElement).value)} className="lm-line" />
          </div>
        ))}
        <button className="lm-btn-add" onClick={addLine}>+ Add Line</button>
      </div>
    </div>
  );
}

function PracticeEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  const items = section.practiceItems || [];

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onUpdate({ practiceItems: newItems });
  };

  const addItem = () => {
    onUpdate({
      practiceItems: [...items, { id: `item-${Date.now()}`, question: '', answer: '' }],
    });
  };

  return (
    <div className="lm-form-group">
      <label>
        Instruction (English)
        <input value={section.instructionEn || ''} onChange={(e) => onUpdate({ instructionEn: (e.target as HTMLInputElement).value })} />
      </label>
      <label>
        Example
        <input value={section.practiceExample || ''} onChange={(e) => onUpdate({ practiceExample: (e.target as HTMLInputElement).value })} />
      </label>
      <label>
        Example Answer
        <input value={section.practiceExampleAnswer || ''} onChange={(e) => onUpdate({ practiceExampleAnswer: (e.target as HTMLInputElement).value })} />
      </label>

      <h4>Practice Items</h4>
      <div className="lm-practice-list">
        {items.map((item, i) => (
          <div key={item.id} className="lm-practice-item">
            <input placeholder="Question" value={item.question} onChange={(e) => updateItem(i, 'question', (e.target as HTMLInputElement).value)} />
            <input placeholder="Answer" value={item.answer} onChange={(e) => updateItem(i, 'answer', (e.target as HTMLInputElement).value)} />
          </div>
        ))}
        <button className="lm-btn-add" onClick={addItem}>+ Add Item</button>
      </div>
    </div>
  );
}

function ChallengeEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  return (
    <div className="lm-form-group">
      <label>
        Challenge Title
        <input value={section.challengeTitle || ''} onChange={(e) => onUpdate({ challengeTitle: (e.target as HTMLInputElement).value })} />
      </label>
      <label>
        Situation (English)
        <textarea value={section.situationEn || ''} onChange={(e) => onUpdate({ situationEn: (e.target as HTMLTextAreaElement).value })} rows={3} />
      </label>
      <label>
        Situation (Japanese)
        <textarea value={section.situationJp || ''} onChange={(e) => onUpdate({ situationJp: (e.target as HTMLTextAreaElement).value })} rows={3} />
      </label>
    </div>
  );
}

function GenericEditor({ section, onUpdate }: { section: LessonSection; onUpdate: (u: Partial<LessonSection>) => void }) {
  return (
    <div className="lm-form-group">
      <label>
        Explanation (English)
        <textarea value={section.explanationEn || ''} onChange={(e) => onUpdate({ explanationEn: (e.target as HTMLTextAreaElement).value })} rows={3} />
      </label>
      <label>
        Explanation (Japanese)
        <textarea value={section.explanationJp || ''} onChange={(e) => onUpdate({ explanationJp: (e.target as HTMLTextAreaElement).value })} rows={3} />
      </label>
    </div>
  );
}

// ============================================================================
// LESSON PREVIEW
// ============================================================================

function LessonPreview({
  data,
  mode,
  onBack,
  onModeChange,
}: {
  data: LessonMaterial;
  mode: 'tutor' | 'student';
  onBack: () => void;
  onModeChange: (m: 'tutor' | 'student') => void;
}) {
  const [activeSection, setActiveSection] = useState(0);
  const sections = mode === 'student' ? data.sections.filter(s => s.sectionType !== 'feedback') : data.sections;
  const section = sections[activeSection];

  return (
    <div className="lmm-preview">
      <div className="lmm-preview-toolbar">
        <button className="lmm-btn-back" onClick={onBack}>
          <i className="ri-arrow-left-line" />
          Back to Editor
        </button>
        <div className="lmm-mode-toggle">
          <button className={`lmm-mode-btn ${mode === 'tutor' ? 'active' : ''}`} onClick={() => onModeChange('tutor')}>
            <i className="ri-user-voice-line" />
            Tutor View
          </button>
          <button className={`lmm-mode-btn ${mode === 'student' ? 'active' : ''}`} onClick={() => onModeChange('student')}>
            <i className="ri-user-line" />
            Student View
          </button>
        </div>
      </div>

      {/* Header Preview */}
      <header className="lmm-preview-header" style={{ background: data.header.overlayColor }}>
        <span className="lmm-preview-badge">{data.header.levelBadge}</span>
        <p className="lmm-preview-chapter">{data.header.chapterLabel}</p>
        <h1 className="lmm-preview-title">{data.header.lessonLabel}</h1>
        <div className="lmm-preview-goal">
          <p>{data.header.goalText}</p>
          <p className="lmm-preview-subtext">{data.header.goalSubtext}</p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="lmm-preview-nav">
        {sections.map((s, i) => (
          <button key={s.id} className={`lmm-nav-btn ${i === activeSection ? 'active' : ''}`} onClick={() => setActiveSection(i)}>
            {s.sectionNumber}. {s.sectionTitle || s.stepTitle || s.sectionType}
          </button>
        ))}
      </nav>

      {/* Section Preview */}
      <div className="lmm-preview-content">
        <PreviewSection section={section} mode={mode} />
      </div>
    </div>
  );
}

function PreviewSection({ section, mode }: { section: LessonSection; mode: 'tutor' | 'student' }) {
  return (
    <div className={`lmm-section lmm-section-${section.sectionType}`}>
      {section.sectionTitle && <h2 className="lmm-section-title">{section.sectionTitle}</h2>}
      {section.stepTitle && <h3 className="lmm-section-step">{section.stepTitle}</h3>}
      {section.instructionEn && <p className="lmm-instruction">{section.instructionEn}</p>}
      {section.instructionJp && <p className="lmm-instruction-jp">{section.instructionJp}</p>}
      {section.explanationEn && <p className="lmm-explanation">{section.explanationEn}</p>}
      {section.explanationJp && <p className="lmm-explanation-jp">{section.explanationJp}</p>}

      {/* Vocab cards */}
      {section.vocabCards && (
        <div className="lmm-vocab-grid">
          {section.vocabCards.map(c => (
            <div key={c.id} className="lmm-vocab-card">
              <span className="lmm-vocab-en">{c.wordEn}</span>
              <span className="lmm-vocab-jp">{c.wordJp}</span>
            </div>
          ))}
        </div>
      )}

      {/* Dialogue */}
      {section.dialogueLines && (
        <div className="lmm-dialogue">
          {section.dialogueLines.map(l => (
            <div key={l.id} className="lmm-dialogue-line">
              <span className="lmm-speaker">{l.speaker}</span>
              <span className="lmm-line-text">{l.lineEn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Practice items */}
      {section.practiceItems && (
        <ol className="lmm-practice-list">
          {section.practiceItems.map(p => (
            <li key={p.id} className="lmm-practice-item">
              <p className="lmm-practice-question">{p.question}</p>
              {mode === 'tutor' && <p className="lmm-practice-answer">→ {p.answer}</p>}
            </li>
          ))}
        </ol>
      )}

      {/* Challenge */}
      {section.situationEn && (
        <div className="lmm-situation">
          <p>{section.situationEn}</p>
          {section.situationJp && <p className="lmm-situation-jp">{section.situationJp}</p>}
        </div>
      )}

      {/* Tutor sidebar steps */}
      {mode === 'tutor' && section.lessonGoalSteps && (
        <aside className="lmm-tutor-sidebar">
          <h4>{section.lessonGoalTitle || 'Tutor Steps'}</h4>
          <ol className="lmm-step-list">
            {section.lessonGoalSteps.map((step, i) => (
              <li key={step.id} className="lmm-step-item">
                {step.instruction && <p className="lmm-step-instruction">{step.instruction}</p>}
                {step.scriptLine && <p className="lmm-step-script">"{step.scriptLine}"</p>}
                {step.tipText && <p className="lmm-step-tip">💡 {step.tipText}</p>}
              </li>
            ))}
          </ol>
        </aside>
      )}
    </div>
  );
}
