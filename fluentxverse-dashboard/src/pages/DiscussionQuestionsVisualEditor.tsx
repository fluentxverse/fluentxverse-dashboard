/**
 * DiscussionQuestionsVisualEditor
 * Fullscreen visual editor for a single Discussion Questions topic.
 * Identical layout to ConversationalSkillsVisualEditor — same toolbar, same
 * light canvas, same white-card section style — but with a single section
 * that lists 20 discussion questions.
 */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { getLessonById, updateLessonHeader, type LessonMaterial } from '../api/lessonMaterial.api';
import { TutorGuide, type UniversalTutorStep } from '../components/TutorGuideStep';
import { DQAIGenerator } from '../components/DQAIGenerator';
import { toast } from '../Components/Toast/Toast';
import './ConversationalSkillsVisualEditor.css';
import '../components/TutorGuideStep.css';

// ============================================================================
// TYPES
// ============================================================================

interface DiscussionQuestion {
  id: string;
  number: number;
  question: string;
}

interface TutorStep {
  instruction: string;
  script: string | null;
  tip: string | null;
}

interface DiscussionQuestionsData {
  topicTitle: string;
  topicDescription: string;
  questions: DiscussionQuestion[];
  tutorDuration: string;
  tutorSteps: TutorStep[];
  backgroundImage?: string;
  overlayColor?: string;
  feedbackData?: DQFeedbackSectionData;
}

// ── Feedback section types ──────────────────────────────────────────────────

interface FeedbackExample {
  youSaid: string;
  correction: string;
  correctionLabel: string;
}

interface FeedbackCategory {
  id: string;
  title: string;
  titleJp: string;
  focusOn: string;
  exampleFeedbackItems: string[];
  vocabularyExample?: string;
  examples: FeedbackExample[];
}

interface RubricLevel {
  score: number;
  label: string;
  description: string;
}

interface DQFeedbackTutorStep {
  instruction: string;
  scripts?: { text: string }[];
  prompts?: { text: string }[];
  tips?: { text: string }[];
}

interface DQFeedbackSectionData {
  sectionNumber: number;
  sectionTitle: string;
  duration: string;
  goal: string;
  goalJp: string;
  rubricTitle: string;
  rubricLevels: RubricLevel[];
  personalizedFeedbackTitle: string;
  tutorSteps: DQFeedbackTutorStep[];
  rememberNote: string;
  feedbackGuideTitle: string;
  categories: FeedbackCategory[];
}

const DEFAULT_DQ_FEEDBACK_DATA: DQFeedbackSectionData = {
  sectionNumber: 2,
  sectionTitle: 'FEEDBACK',
  duration: '2 minutes',
  goal: 'I can discuss the topic confidently using a variety of vocabulary.',
  goalJp: 'さまざまな語彙を使ってトピックについて自信を持って話し合うことができる。',
  rubricTitle: 'LESSON GOAL ACHIEVEMENT',
  rubricLevels: [
    { score: 4, label: 'Very Good', description: 'Could complete the task with ease' },
    { score: 3, label: 'Good', description: 'Could complete the task with some clarifications' },
    { score: 2, label: 'Fair', description: 'Could complete the task with additional instructions' },
    { score: 1, label: 'Poor', description: 'Could somehow complete the task with difficulty' },
  ],
  personalizedFeedbackTitle: 'PERSONALIZED FEEDBACK',
  feedbackGuideTitle: 'PERSONALIZED FEEDBACK GUIDE',
  rememberNote: 'Effective feedback is specific to the student\'s actual performance.\n\nUse this template to give the student feedback.',
  tutorSteps: [
    { instruction: 'Introduce Feedback.', scripts: [{ text: '"Okay, now let\'s do Feedback."' }] },
    { instruction: 'Have the student read the lesson goal.' },
    { instruction: 'Ask if they achieved the lesson goal.', scripts: [{ text: '"Did you achieve the lesson goal?"' }] },
    { instruction: 'Give the student a score for their lesson goal achievement using the rubric.', tips: [{ text: 'Base your score on how well they answered the discussion questions.' }] },
    { instruction: 'Give feedback on the student\'s content, accuracy, and fluency using the template below.', tips: [{ text: 'Refer to the Personalized Feedback Guide for more information.' }] },
    { instruction: 'Wrap up the lesson.', scripts: [{ text: '"You did a great job! Thank you very much for today."' }] },
  ],
  categories: [
    {
      id: 'content',
      title: 'CONTENT & IDEAS',
      titleJp: '内容と考え\n意見を明確に表現し、理由や具体例で補強できるか',
      focusOn: 'the ability to express clear opinions, support them with reasons and examples, and develop ideas beyond one-sentence answers',
      exampleFeedbackItems: ['depth of response', 'use of reasons and examples', 'ability to expand on ideas'],
      examples: [
        { youSaid: 'I like traveling.', correction: 'I like traveling because I enjoy learning about different cultures. For example, last year I visited Thailand and tried many local dishes.', correctionLabel: 'Correct:' },
        { youSaid: 'I think it\'s good.', correction: 'I think it\'s a good idea because it helps people save money. Also, it\'s better for the environment.', correctionLabel: 'Correct:' },
      ],
    },
    {
      id: 'accuracy',
      title: 'ACCURACY',
      titleJp: '正確さ\n文法や語彙が正しく使えているかどうか',
      focusOn: 'the ability to use grammar and vocabulary correctly when expressing opinions',
      exampleFeedbackItems: ['grammar mistakes', 'word choice errors'],
      examples: [
        { youSaid: 'I GO to the park yesterday.', correction: 'I WENT to the park yesterday.', correctionLabel: 'Correct:' },
        { youSaid: 'I\'m AGREE with that opinion.', correction: 'I AGREE with that opinion.', correctionLabel: 'Correct:' },
      ],
    },
    {
      id: 'interaction',
      title: 'FLUENCY & INTERACTION',
      titleJp: '流暢さと対話力\n円滑に話し、会話に自然に参加できるかどうか',
      focusOn: 'the ability to speak smoothly, use discourse markers (however, for example, on the other hand), and engage naturally in the discussion',
      exampleFeedbackItems: ['unnaturally long pauses', 'use of fillers (etto..., ano..., um...)', 'use of discourse markers', 'ability to expand answers'],
      examples: [
        { youSaid: 'I think... etto... it\'s good. ... Yes.', correction: 'I think it\'s a good idea. For example, it can help people save time.', correctionLabel: 'Correct:' },
        { youSaid: 'Yes. I agree.', correction: 'Yes, I agree. On the other hand, some people might think it\'s too expensive.', correctionLabel: 'Correct:' },
      ],
    },
  ],
};

const DEFAULT_TUTOR_STEPS: TutorStep[] = [
  { instruction: 'Introduce the discussion topic.', script: '"Today we\'re going to talk about [topic]. Let me explain what we\'ll discuss."', tip: null },
  { instruction: 'Read the topic description to the student.', script: null, tip: null },
  { instruction: 'Ask the discussion questions one by one.', script: null, tip: '"Take your time to think about each answer."' },
  { instruction: 'Give feedback after each answer.', script: null, tip: 'Encourage the student to expand their answers with follow-up questions.' },
  { instruction: 'Wrap up the discussion.', script: '"Great discussion today! You did a wonderful job sharing your thoughts."', tip: null },
];

// Autosave
const AUTOSAVE_DELAY_MS = 5000;

function makeEmptyQuestions(count = 20): DiscussionQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `q-${Date.now()}-${i}`,
    number: i + 1,
    question: '',
  }));
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function DiscussionQuestionsVisualEditor() {
  const { params } = useRoute();
  const lessonId = params?.id;

  // Core state
  const [lesson, setLesson] = useState<LessonMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Content state
  const [topicTitle, setTopicTitle] = useState('');
  const [topicDescription, setTopicDescription] = useState('');
  const [questions, setQuestions] = useState<DiscussionQuestion[]>(makeEmptyQuestions());

  // Tutor guide state
  const [tutorDuration, setTutorDuration] = useState('10 minutes');
  const [tutorSteps, setTutorSteps] = useState<TutorStep[]>(DEFAULT_TUTOR_STEPS);

  // Feedback section state
  const [feedbackData, setFeedbackData] = useState<DQFeedbackSectionData>(DEFAULT_DQ_FEEDBACK_DATA);

  // Hero background state
  const [backgroundImage, setBackgroundImage] = useState('');
  const [overlayColor, setOverlayColor] = useState('#1a1a2ecc');
  const [activeElement, setActiveElement] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autosave
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'pending' | 'saved'>('idle');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUnsavedChangesRef = useRef(false);
  const initialLoadRef = useRef(true);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // Load lesson data
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lessonId) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getLessonById(lessonId);
        setLesson(data);

        // Hydrate from saved data
        const saved: DiscussionQuestionsData | undefined = data.discussionQuestionsData as any;
        if (saved?.questions?.length) {
          setTopicTitle(saved.topicTitle || data.lessonName || '');
          setTopicDescription(saved.topicDescription || '');
          setQuestions(saved.questions);
          if (saved.tutorSteps?.length) setTutorSteps(saved.tutorSteps);
          if (saved.tutorDuration) setTutorDuration(saved.tutorDuration);
          if (saved.backgroundImage) setBackgroundImage(saved.backgroundImage);
          if (saved.overlayColor) setOverlayColor(saved.overlayColor);
          if (saved.feedbackData) setFeedbackData(saved.feedbackData);
        } else {
          setTopicTitle(data.lessonName || '');
          setTopicDescription('');
          setQuestions(makeEmptyQuestions());
        }
        // Mark initial load complete after state settles
        setTimeout(() => { initialLoadRef.current = false; }, 100);
      } catch (err) {
        console.error('Failed to load:', err);
        setError('Failed to load topic');
      } finally {
        setLoading(false);
      }
    })();
  }, [lessonId]);

  // ──────────────────────────────────────────────────────────────────────────
  // Save
  // ──────────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!lesson) return;
    setSaving(true);
    try {
      const payload: DiscussionQuestionsData = {
        topicTitle,
        topicDescription,
        questions: questions.map((q, i) => ({ ...q, number: i + 1 })),
        tutorDuration,
        tutorSteps,
        backgroundImage: backgroundImage || undefined,
        overlayColor,
        feedbackData,
      };
      const updated = await updateLessonHeader(lesson.id, {
        lessonName: topicTitle,
        discussionQuestionsData: payload,
      });
      setLesson(updated);
      setAutosaveStatus('saved');
      hasUnsavedChangesRef.current = false;
      if (autosaveStatus !== 'pending') {
        toast.success('Changes saved!');
      }
      setTimeout(() => setAutosaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
      if (autosaveStatus !== 'pending') {
        toast.error('Failed to save changes');
      }
      setAutosaveStatus('idle');
    } finally {
      setSaving(false);
    }
  }, [lesson, topicTitle, topicDescription, questions, tutorDuration, tutorSteps, backgroundImage, overlayColor, feedbackData, autosaveStatus]);

  // ──────────────────────────────────────────────────────────────────────────
  // Autosave
  // ──────────────────────────────────────────────────────────────────────────
  const triggerAutosave = useCallback(() => {
    if (initialLoadRef.current) return;
    hasUnsavedChangesRef.current = true;
    setAutosaveStatus('pending');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, AUTOSAVE_DELAY_MS);
  }, [handleSave]);

  // Watch editable state
  useEffect(() => {
    if (!lesson || loading) return;
    triggerAutosave();
  }, [topicTitle, topicDescription, questions, tutorDuration, tutorSteps, backgroundImage, overlayColor, feedbackData]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Question helpers
  // ──────────────────────────────────────────────────────────────────────────
  const updateQuestion = (index: number, field: keyof DiscussionQuestion, value: string) => {
    setQuestions(prev => prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)));
  };

  const addQuestion = () => {
    setQuestions(prev => [
      ...prev,
      { id: `q-${Date.now()}`, number: prev.length + 1, question: '' },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(prev => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, number: i + 1 })));
  };

  const handleBack = () => {
    if (hasUnsavedChangesRef.current) {
      handleSave();
    }
    window.close();
  };

  // ──────────────────────────────────────────────────────────────────────────
  // AI insert handler
  // ──────────────────────────────────────────────────────────────────────────
  const handleAIInsertQuestions = (aiQuestions: string[]) => {
    setQuestions(prev => {
      // Replace empty slots first, then append remaining
      const updated = [...prev];
      let aiIdx = 0;
      // Fill in empty slots
      for (let i = 0; i < updated.length && aiIdx < aiQuestions.length; i++) {
        if (!updated[i].question.trim()) {
          updated[i] = { ...updated[i], question: aiQuestions[aiIdx] };
          aiIdx++;
        }
      }
      // Append any remaining
      while (aiIdx < aiQuestions.length) {
        updated.push({
          id: `q-${Date.now()}-${aiIdx}`,
          number: updated.length + 1,
          question: aiQuestions[aiIdx],
        });
        aiIdx++;
      }
      return updated.map((q, i) => ({ ...q, number: i + 1 }));
    });
    toast.success(`Inserted ${aiQuestions.length} AI-generated questions!`);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Hero background image
  // ──────────────────────────────────────────────────────────────────────────
  const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setBackgroundImage(reader.result as string); };
    reader.readAsDataURL(file);
  };

  const baseColor = overlayColor.slice(0, 7);
  const opacity = overlayColor.length === 9
    ? parseInt(overlayColor.slice(7, 9), 16) / 255
    : 0.8;

  const handleColorChange = (color: string) => {
    const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
    setOverlayColor(color + opacityHex);
  };

  const handleOpacityChange = (newOpacity: number) => {
    const opacityHex = Math.round(newOpacity * 255).toString(16).padStart(2, '0');
    setOverlayColor(baseColor + opacityHex);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Drag reorder
  // ──────────────────────────────────────────────────────────────────────────
  const handleDragStart = (idx: number) => setDragIndex(idx);
  const handleDragOver = (e: DragEvent, idx: number) => { e.preventDefault(); setDragOverIndex(idx); };
  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      setQuestions(prev => {
        const copy = [...prev];
        const [moved] = copy.splice(dragIndex, 1);
        copy.splice(dragOverIndex, 0, moved);
        return copy.map((q, i) => ({ ...q, number: i + 1 }));
      });
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Render: Loading / Error
  // ──────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="csve-fullpage csve-loading">
        <div className="csve-loader">
          <i className="ri-loader-4-line" />
          <p>Loading topic...</p>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="csve-fullpage csve-error">
        <i className="ri-error-warning-line" />
        <h2>{error || 'Topic not found'}</h2>
        <button onClick={handleBack}>Go Back</button>
      </div>
    );
  }

  const levelBadge = lesson.levelBadge || `LVL ${lesson.level}`;
  const filledCount = questions.filter(q => q.question.trim()).length;

  // ──────────────────────────────────────────────────────────────────────────
  // Render: Main  (identical structure to ConversationalSkillsVisualEditor)
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="csve-fullpage dqve-page">

      {/* ════════════════════════════════════════════════════════════════════
          TOOLBAR  (same as CSVE)
          ════════════════════════════════════════════════════════════════════ */}
      <div className="csve-toolbar">
        <div className="csve-toolbar-left">
          <button className="csve-toolbar-btn csve-back-btn" onClick={handleBack}>
            <i className="ri-arrow-left-line" />
            <span>Back</span>
          </button>
          <div className="csve-toolbar-divider" />
          <span className="csve-toolbar-title">
            <span className="csve-badge">{levelBadge}</span>
            Topic {lesson.lessonNumber}: {topicTitle || 'Untitled'}
          </span>
        </div>
        <div className="csve-toolbar-center">
          <span className="csve-edit-mode">
            <i className="ri-discuss-line" />
            Discussion Questions Editor
          </span>
        </div>
        <div className="csve-toolbar-right">
          <span className="dqve-toolbar-counter">
            <i className="ri-chat-check-line" />
            {filledCount}/{questions.length}
          </span>
          <button
            className="csve-toolbar-btn csve-save-btn"
            onClick={handleSave}
            disabled={saving}
            title={
              autosaveStatus === 'pending' ? 'Autosaving...' :
              autosaveStatus === 'saved' ? 'Autosaved!' : 'Save'
            }
          >
            <i className={
              autosaveStatus === 'saved' ? 'ri-check-line' :
              autosaveStatus === 'pending' ? 'ri-loader-4-line' :
              'ri-save-line'
            } />
            <span>
              {saving ? 'Saving...' :
               autosaveStatus === 'pending' ? 'Autosaving...' :
               autosaveStatus === 'saved' ? 'Saved!' : 'Save'}
            </span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          CANVAS  (scrollable area — same #f5f5f5 background as CSVE)
          ════════════════════════════════════════════════════════════════════ */}
      <div className="csve-canvas" onClick={() => setActiveElement(null)}>

        {/* ── Topbar breadcrumb (same as CSVE) ── */}
        <nav className="csve-topbar">
          <div className="csve-topbar-content">
            <span className="csve-course-info">
              Discussion Questions {levelBadge} | Topic {lesson.lessonNumber}: {topicTitle || 'Untitled'}
            </span>
          </div>
        </nav>

        {/* ── Hero header (same as CSVE — bg image, overlay, title, desc) ── */}
        <header
          className={`csve-hero ${activeElement === 'hero' ? 'csve-active' : ''}`}
          style={{
            backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          }}
          onClick={(e) => { e.stopPropagation(); setActiveElement('hero'); }}
        >
          <div className="csve-hero-overlay" style={{ backgroundColor: overlayColor }} />

          {/* Edgy geometric accent shapes */}
          <div className="dqve-hero-shape dqve-hero-shape--tr1" />
          <div className="dqve-hero-shape dqve-hero-shape--tr2" />
          <div className="dqve-hero-shape dqve-hero-shape--bl1" />
          <div className="dqve-hero-shape dqve-hero-shape--bottom" />

          <div className="csve-hero-content">
            <p className="csve-lesson-label">Topic {lesson.lessonNumber}</p>
            <h1 className="csve-lesson-name">
              <input
                className="dqve-hero-title"
                value={topicTitle}
                onChange={e => setTopicTitle((e.target as HTMLInputElement).value)}
                placeholder="Topic Title"
              />
            </h1>
            <div className="csve-goal-wrapper">
              <p className="csve-goal-jp">
                <input
                  className="dqve-hero-desc"
                  value={topicDescription}
                  onChange={e => setTopicDescription((e.target as HTMLInputElement).value)}
                  placeholder="Brief description of the discussion topic..."
                />
              </p>
            </div>
          </div>

          {/* Edit indicator */}
          <div className="csve-edit-indicator">
            <i className="ri-edit-line" />
            Click to change background image
          </div>
        </header>

        {/* ── Content: same csve-main → csve-sections as CSVE ── */}
        <main className="csve-main">
          <div className="csve-sections">

            {/* ── Single section matching CSVE's INTRODUCE pattern ── */}
            <section className="csve-intro-section">
              <div className="csve-intro-layout">
                {/* Left Column — Questions */}
                <div className="csve-intro-left">
                  {/* Section number + title + blue line (identical to CSVE) */}
                  <div className="csve-section-number">
                    <span className="csve-number-badge">1</span>
                    <h2 className="csve-section-title">DISCUSSION QUESTIONS</h2>
                    <div className="csve-section-line" />
                  </div>

                  {/* Counter + Add button */}
                  <div className="dqve-section-actions">
                    <span className="dqve-filled-badge">
                      {filledCount} of {questions.length} filled
                    </span>
                    <button className="dqve-header-add-btn" onClick={addQuestion}>
                      <i className="ri-add-line" /> Add Question
                    </button>
                  </div>

                  {/* Question list */}
                  <div className="dqve-questions-list">
                    {questions.map((q, i) => (
                      <div
                        key={q.id}
                        className={`dqve-q${q.question.trim() ? ' dqve-q--filled' : ''}${dragOverIndex === i ? ' dqve-q--drag-over' : ''}${dragIndex === i ? ' dqve-q--dragging' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={e => handleDragOver(e as any, i)}
                        onDragEnd={handleDragEnd}
                      >
                        {/* Drag handle */}
                        <div className="dqve-q-grip">
                          <i className="ri-draggable" />
                        </div>

                        {/* Number */}
                        <div className="dqve-q-num">{i + 1}</div>

                        {/* Input */}
                        <div className="dqve-q-body">
                          <input
                            className="dqve-q-input"
                            type="text"
                            value={q.question}
                            onChange={e => updateQuestion(i, 'question', (e.target as HTMLInputElement).value)}
                            placeholder={`Question ${i + 1}...`}
                          />
                        </div>

                        {/* Remove button */}
                        <button
                          className="dqve-q-remove"
                          onClick={() => removeQuestion(i)}
                          title="Remove question"
                          disabled={questions.length <= 1}
                        >
                          <i className="ri-delete-bin-line" />
                        </button>
                      </div>
                    ))}

                    {/* Add row */}
                    <button className="dqve-add-row" onClick={addQuestion}>
                      <i className="ri-add-circle-line" />
                      <span>Add Another Question</span>
                    </button>
                  </div>
                </div>

                {/* Right Column — Tutor Guide (same as CSVE intro-right) */}
                <div className="csve-intro-right">
                  <div className="csve-lesson-goal-box csve-editable-card">
                    <TutorGuide
                      title="DISCUSSION GUIDE"
                      duration={tutorDuration}
                      steps={tutorSteps as UniversalTutorStep[]}
                      onStepsChange={(steps) => setTutorSteps(steps.map(s => ({
                        instruction: s.instruction,
                        script: s.script ?? null,
                        tip: s.tip ?? null,
                      })))}
                      onDurationChange={setTutorDuration}
                      features={{ showScripts: true, showTips: true, legacyMode: true }}
                      className=""
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ── Section 2: FEEDBACK ── */}
            <DQFeedbackSectionEditor
              data={feedbackData}
              onChange={setFeedbackData}
            />

          </div>
        </main>
      </div>

      {/* Side Panel — Header Settings (same as CSVE) */}
      {activeElement === 'hero' && (
        <aside className="csve-panel" onClick={e => e.stopPropagation()}>
          <div className="csve-panel-header">
            <h3>Header Settings</h3>
            <button className="csve-panel-close" onClick={() => setActiveElement(null)}>
              <i className="ri-close-line" />
            </button>
          </div>

          <div className="csve-panel-body">
            {/* Background Image */}
            <div className="csve-control">
              <label>Background Image</label>
              <div className="csve-image-control">
                {backgroundImage ? (
                  <div className="csve-image-thumb">
                    <img src={backgroundImage} alt="Background" />
                    <div className="csve-image-actions">
                      <button onClick={() => fileInputRef.current?.click()}>
                        <i className="ri-image-edit-line" />
                      </button>
                      <button onClick={() => setBackgroundImage('')}>
                        <i className="ri-delete-bin-line" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="csve-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <i className="ri-image-add-line" />
                    <span>Add Image</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* Overlay Color */}
            <div className="csve-control">
              <label>Overlay Color</label>
              <div className="csve-color-row">
                <input
                  type="color"
                  value={baseColor}
                  onChange={e => handleColorChange((e.target as HTMLInputElement).value)}
                />
                <span className="csve-color-value">{baseColor}</span>
              </div>
            </div>

            {/* Opacity */}
            <div className="csve-control">
              <label>Opacity: {Math.round(opacity * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={opacity}
                onChange={e => handleOpacityChange(parseFloat((e.target as HTMLInputElement).value))}
              />
            </div>

            {/* Preset Colors */}
            <div className="csve-control">
              <label>Quick Colors</label>
              <div className="csve-color-presets">
                {['#1a1a2e', '#2d1b00', '#331a00', '#0d0d0d', '#1c1c1c', '#3d1f00'].map(color => (
                  <button
                    key={color}
                    className={`csve-preset ${baseColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* AI Question Generator */}
      {lesson && (
        <DQAIGenerator
          topic={topicTitle}
          level={lesson.level || 1}
          questionCount={questions.length}
          onInsertQuestions={handleAIInsertQuestions}
        />
      )}
    </div>
  );
}

// ============================================================================
// DQ FEEDBACK SECTION EDITOR
// ============================================================================

interface DQFeedbackSectionEditorProps {
  data: DQFeedbackSectionData;
  onChange: (data: DQFeedbackSectionData) => void;
}

function DQFeedbackSectionEditor({ data, onChange }: DQFeedbackSectionEditorProps) {
  const updateData = (updates: Partial<DQFeedbackSectionData>) => {
    onChange({ ...data, ...updates });
  };

  // ── Category handlers ──
  const updateCategory = (idx: number, updates: Partial<FeedbackCategory>) => {
    const cats = [...data.categories];
    cats[idx] = { ...cats[idx], ...updates };
    updateData({ categories: cats });
  };

  const updateExampleFeedbackItem = (catIdx: number, itemIdx: number, value: string) => {
    const cats = [...data.categories];
    const items = [...cats[catIdx].exampleFeedbackItems];
    items[itemIdx] = value;
    cats[catIdx] = { ...cats[catIdx], exampleFeedbackItems: items };
    updateData({ categories: cats });
  };

  const addExampleFeedbackItem = (catIdx: number) => {
    const cats = [...data.categories];
    cats[catIdx] = { ...cats[catIdx], exampleFeedbackItems: [...cats[catIdx].exampleFeedbackItems, ''] };
    updateData({ categories: cats });
  };

  const removeExampleFeedbackItem = (catIdx: number, itemIdx: number) => {
    const cats = [...data.categories];
    cats[catIdx] = { ...cats[catIdx], exampleFeedbackItems: cats[catIdx].exampleFeedbackItems.filter((_, i) => i !== itemIdx) };
    updateData({ categories: cats });
  };

  const updateExample = (catIdx: number, exIdx: number, updates: Partial<FeedbackExample>) => {
    const cats = [...data.categories];
    const exs = [...cats[catIdx].examples];
    exs[exIdx] = { ...exs[exIdx], ...updates };
    cats[catIdx] = { ...cats[catIdx], examples: exs };
    updateData({ categories: cats });
  };

  const addExample = (catIdx: number) => {
    const cats = [...data.categories];
    cats[catIdx] = { ...cats[catIdx], examples: [...cats[catIdx].examples, { youSaid: '', correction: '', correctionLabel: 'Better:' }] };
    updateData({ categories: cats });
  };

  const removeExample = (catIdx: number, exIdx: number) => {
    const cats = [...data.categories];
    cats[catIdx] = { ...cats[catIdx], examples: cats[catIdx].examples.filter((_, i) => i !== exIdx) };
    updateData({ categories: cats });
  };

  // ── Rubric handlers ──
  const updateRubricLevel = (idx: number, updates: Partial<RubricLevel>) => {
    const levels = [...data.rubricLevels];
    levels[idx] = { ...levels[idx], ...updates };
    updateData({ rubricLevels: levels });
  };

  // ── Tutor step handlers ──
  const updateTutorStep = (idx: number, field: keyof DQFeedbackTutorStep, value: unknown) => {
    const steps = [...data.tutorSteps];
    steps[idx] = { ...steps[idx], [field]: value };
    updateData({ tutorSteps: steps });
  };

  const addTutorStep = () => {
    updateData({ tutorSteps: [...data.tutorSteps, { instruction: '' }] });
  };

  const removeTutorStep = (idx: number) => {
    updateData({ tutorSteps: data.tutorSteps.filter((_, i) => i !== idx) });
  };

  return (
    <section className="csve-section csve-feedback-section">
      {/* Section Header */}
      <div className="csve-section-number csve-feedback-number">
        <span className="csve-number-badge">{data.sectionNumber}</span>
        <input
          type="text"
          className="csve-section-title-editable"
          value={data.sectionTitle}
          onChange={e => updateData({ sectionTitle: (e.target as HTMLInputElement).value })}
        />
        <div className="csve-section-line" />
      </div>

      {/* Two-column layout */}
      <div className="csve-feedback-content">
        {/* Left Column — Student View */}
        <div className="csve-feedback-left">
          {/* GOAL Card */}
          <div className="csve-fb-goal-card">
            <div className="csve-fb-goal-accent" />
            <div className="csve-fb-goal-body">
              <span className="csve-fb-goal-label">SESSION OBJECTIVE</span>
              <input
                type="text"
                className="csve-fb-goal-text"
                value={data.goal}
                onChange={e => updateData({ goal: (e.target as HTMLInputElement).value })}
                placeholder="Students will be able to..."
              />
              <input
                type="text"
                className="csve-fb-goal-jp"
                value={data.goalJp}
                onChange={e => updateData({ goalJp: (e.target as HTMLInputElement).value })}
                placeholder="Japanese translation..."
              />
            </div>
          </div>

          {/* Rubric */}
          <div className="csve-fb-rubric-card">
            <div className="csve-fb-rubric-title-row">
              <input
                type="text"
                className="csve-fb-rubric-title"
                value={data.rubricTitle}
                onChange={e => updateData({ rubricTitle: (e.target as HTMLInputElement).value })}
              />
            </div>
            <div className="csve-fb-rubric-scale">
              {data.rubricLevels.map((level, levelIdx) => (
                <div key={level.score} className={`csve-fb-rubric-item csve-fb-rubric-${level.score}`}>
                  <div className="csve-fb-rubric-circle">{level.score}</div>
                  <div className="csve-fb-rubric-details">
                    <input
                      type="text"
                      className="csve-fb-rubric-label"
                      value={level.label}
                      onChange={e => updateRubricLevel(levelIdx, { label: (e.target as HTMLInputElement).value })}
                    />
                    <textarea
                      className="csve-fb-rubric-desc"
                      value={level.description}
                      onChange={e => updateRubricLevel(levelIdx, { description: (e.target as HTMLTextAreaElement).value })}
                      rows={1}
                      ref={el => {
                        if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
                      }}
                      onInput={e => {
                        const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px';
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assessment Areas Header */}
          <div className="csve-fb-categories-header">
            <input
              type="text"
              className="csve-fb-categories-title"
              value={data.personalizedFeedbackTitle}
              onChange={e => updateData({ personalizedFeedbackTitle: (e.target as HTMLInputElement).value })}
            />
          </div>

          {/* Category Cards */}
          {data.categories.map((category, catIdx) => (
            <div key={category.id} className={`csve-fb-category-card csve-fb-cat-${category.id}`}>
              {/* Category Header */}
              <div className="csve-fb-cat-header">
                <div className="csve-fb-cat-icon">
                  {category.id === 'content' && <i className="ri-lightbulb-line" />}
                  {category.id === 'accuracy' && <i className="ri-focus-2-line" />}
                  {category.id === 'interaction' && <i className="ri-chat-smile-2-line" />}
                </div>
                <div className="csve-fb-cat-titles">
                  <input
                    type="text"
                    className="csve-fb-cat-name"
                    value={category.title}
                    onChange={e => updateCategory(catIdx, { title: (e.target as HTMLInputElement).value })}
                  />
                  <textarea
                    className="csve-fb-cat-jp"
                    value={category.titleJp}
                    onChange={e => updateCategory(catIdx, { titleJp: (e.target as HTMLTextAreaElement).value })}
                    rows={1}
                  />
                </div>
              </div>

              {/* Assessment Criteria */}
              <div className="csve-fb-cat-assess">
                <span className="csve-fb-assess-label">Assessment criteria</span>
                <textarea
                  className="csve-fb-assess-text"
                  value={category.focusOn}
                  onChange={e => updateCategory(catIdx, { focusOn: (e.target as HTMLTextAreaElement).value })}
                  placeholder="Evaluate the student's ability to..."
                  rows={1}
                  ref={el => {
                    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
                  }}
                  onInput={e => {
                    const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px';
                  }}
                />
              </div>

              {/* Key Indicators */}
              <div className="csve-fb-cat-focus">
                <span className="csve-fb-focus-label">Key indicators</span>
                <div className="csve-fb-focus-tags">
                  {category.exampleFeedbackItems.map((item, itemIdx) => (
                    <div key={itemIdx} className="csve-fb-focus-tag">
                      <input
                        type="text"
                        className="csve-fb-tag-input"
                        value={item}
                        onChange={e => updateExampleFeedbackItem(catIdx, itemIdx, (e.target as HTMLInputElement).value)}
                        placeholder="feedback item..."
                      />
                      {category.exampleFeedbackItems.length > 1 && (
                        <button className="csve-fb-tag-remove" onClick={() => removeExampleFeedbackItem(catIdx, itemIdx)}>
                          <i className="ri-close-line" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button className="csve-fb-add-tag" onClick={() => addExampleFeedbackItem(catIdx)}>
                    <i className="ri-add-line" />
                  </button>
                </div>
              </div>

              {/* Sample Corrections */}
              <div className="csve-fb-cat-examples">
                <span className="csve-fb-examples-label">Sample corrections</span>

                {category.id === 'content' && category.vocabularyExample && (
                  <div className="csve-fb-vocab-highlight">
                    <i className="ri-book-2-line" />
                    <input
                      type="text"
                      className="csve-fb-vocab-input"
                      value={category.vocabularyExample || ''}
                      onChange={e => updateCategory(catIdx, { vocabularyExample: (e.target as HTMLInputElement).value })}
                      placeholder="target word — brief definition"
                    />
                  </div>
                )}

                {category.examples.map((example, exIdx) => (
                  <div key={exIdx} className="csve-fb-example-card dqve-fb-example-card">
                    <div className="csve-fb-example-said">
                      <span className="dqve-fb-label dqve-fb-label--said">You said:</span>
                      <input
                        type="text"
                        className="csve-fb-example-input csve-fb-said-input"
                        value={example.youSaid}
                        onChange={e => updateExample(catIdx, exIdx, { youSaid: (e.target as HTMLInputElement).value })}
                        placeholder="Student's original attempt..."
                      />
                    </div>
                    <div className="csve-fb-example-better">
                      <span className="dqve-fb-label dqve-fb-label--correct">Correct:</span>
                      <input
                        type="text"
                        className="csve-fb-example-input csve-fb-better-input"
                        value={example.correction}
                        onChange={e => updateExample(catIdx, exIdx, { correction: (e.target as HTMLInputElement).value })}
                        placeholder="Improved version..."
                      />
                    </div>
                    {category.examples.length > 1 && (
                      <button className="csve-fb-example-remove" onClick={() => removeExample(catIdx, exIdx)}>
                        <i className="ri-close-line" />
                      </button>
                    )}
                  </div>
                ))}
                <button className="csve-fb-add-example" onClick={() => addExample(catIdx)}>
                  <i className="ri-add-line" /> Add Example
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column — Tutor Guide */}
        <div className="csve-feedback-right">
          <div className="tgs-tutor-guide">
            <div className="tgs-header">
              <span className="tgs-title">{data.sectionTitle}</span>
            </div>
            <div className="csve-mission-tutor-subheader">
              <span className="csve-feedback-subheader-title">{data.sectionTitle}</span>
              <span className="csve-mission-duration-wrapper">
                (<input
                  type="text"
                  className="csve-mission-duration-input"
                  value={data.duration}
                  onChange={e => updateData({ duration: (e.target as HTMLInputElement).value })}
                  placeholder="2 minutes"
                />)
              </span>
            </div>

            <div className="tgs-steps">
              {data.tutorSteps.map((step, stepIdx) => (
                <div key={stepIdx} className="tgs-step">
                  <span className="tgs-number">{stepIdx + 1}</span>
                  <div className="tgs-content">
                    <input
                      type="text"
                      className="tgs-instruction-input"
                      value={step.instruction}
                      onChange={e => updateTutorStep(stepIdx, 'instruction', (e.target as HTMLInputElement).value)}
                      placeholder="Step instruction..."
                    />
                    {/* Scripts */}
                    {(step.scripts || []).map((s, sIdx) => (
                      <div key={`s-${sIdx}`} className="tgs-script-item">
                        <span className="tgs-script-bullet">●</span>
                        <input
                          type="text"
                          className="tgs-script-input"
                          value={s.text}
                          onChange={e => {
                            const newScripts = [...(step.scripts || [])];
                            newScripts[sIdx] = { text: (e.target as HTMLInputElement).value };
                            updateTutorStep(stepIdx, 'scripts', newScripts);
                          }}
                          placeholder="Script..."
                        />
                        <button
                          className="tgs-remove-btn"
                          onClick={() => {
                            const newScripts = (step.scripts || []).filter((_, i) => i !== sIdx);
                            updateTutorStep(stepIdx, 'scripts', newScripts);
                          }}
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    ))}
                    {/* Prompts */}
                    {(step.prompts || []).map((p, pIdx) => (
                      <div key={`p-${pIdx}`} className="tgs-prompt-item">
                        <span className="tgs-prompt-icon">▸</span>
                        <input
                          type="text"
                          className="tgs-prompt-input"
                          value={p.text}
                          onChange={e => {
                            const newPrompts = [...(step.prompts || [])];
                            newPrompts[pIdx] = { text: (e.target as HTMLInputElement).value };
                            updateTutorStep(stepIdx, 'prompts', newPrompts);
                          }}
                          placeholder="Question or direction..."
                        />
                        <button
                          className="tgs-remove-btn"
                          onClick={() => {
                            const newPrompts = (step.prompts || []).filter((_, i) => i !== pIdx);
                            updateTutorStep(stepIdx, 'prompts', newPrompts);
                          }}
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    ))}
                    {/* Tips */}
                    {(step.tips || []).map((tip, tipIdx) => (
                      <div key={tipIdx} className="tgs-tip-item">
                        <span className="tgs-tip-icon">◆</span>
                        <input
                          type="text"
                          className="tgs-tip-input"
                          value={tip.text}
                          onChange={e => {
                            const newTips = [...(step.tips || [])];
                            newTips[tipIdx] = { text: (e.target as HTMLInputElement).value };
                            updateTutorStep(stepIdx, 'tips', newTips);
                          }}
                          placeholder="Tip..."
                        />
                        <button
                          className="tgs-remove-btn"
                          onClick={() => {
                            const newTips = (step.tips || []).filter((_, i) => i !== tipIdx);
                            updateTutorStep(stepIdx, 'tips', newTips);
                          }}
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    ))}
                    <div className="tgs-add-btns">
                      <button
                        className="tgs-add-script-btn"
                        onClick={() => updateTutorStep(stepIdx, 'scripts', [...(step.scripts || []), { text: '' }])}
                      >
                        <i className="ri-add-line" /> Script
                      </button>
                      <button
                        className="tgs-add-prompt-btn"
                        onClick={() => updateTutorStep(stepIdx, 'prompts', [...(step.prompts || []), { text: '' }])}
                      >
                        <i className="ri-add-line" /> Prompt
                      </button>
                      <button
                        className="tgs-add-tip-btn"
                        onClick={() => updateTutorStep(stepIdx, 'tips', [...(step.tips || []), { text: '' }])}
                      >
                        <i className="ri-add-line" /> Tip
                      </button>
                      {data.tutorSteps.length > 1 && (
                        <button className="tgs-remove-step-btn" onClick={() => removeTutorStep(stepIdx)}>
                          <i className="ri-delete-bin-line" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <button className="tgs-add-step-btn" onClick={addTutorStep}>
                <i className="ri-add-line" /> Add Step
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
