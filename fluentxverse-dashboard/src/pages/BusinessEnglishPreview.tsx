import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { getLessonById, getPublicLessonById, type LessonMaterial } from '../api/lessonMaterial.api';
import { API_BASE_URL } from '../config/api';
import { normalizeLessonMedia } from '../../../shared/lessonMedia';
import BusinessEnglishA4Document, { businessA4Sections } from '../components/businessEnglish/BusinessEnglishA4Document';
import { isBusinessA4Pilot, type BusinessA4Layout } from '../components/businessEnglish/a4Pagination';
import './BusinessEnglishVisualEditor.css';
import './BusinessEnglishPreview.css';

type LessonType = 'READING' | 'SPEAKING' | 'LISTENING' | 'WRITING' | 'REVIEW';
type ThemeMode = 'dark' | 'light';
type NoteType = 'instruction' | 'script' | 'tip' | 'question';
type UnderstandTutorGroup = 'comprehension' | 'wordBank' | 'soundPractice' | 'activityBlocks';
type ActivityBlockType =
  | 'matching'
  | 'multipleChoice'
  | 'sentenceReorder'
  | 'errorCorrection'
  | 'dialogueCompletion'
  | 'trueFalse'
  | 'readingPassage'
  | 'categorization'
  | 'image';

interface TutorNote {
  type: NoteType;
  text: string;
  group?: UnderstandTutorGroup | string;
}

const normalizeTutorNoteType = (type: string = 'instruction'): NoteType =>
  ['instruction', 'script', 'tip', 'question'].includes(type)
    ? (type as NoteType)
    : 'instruction';

const stripHtmlForTutorGrouping = (value: string = '') =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeUnderstandTutorNotes = (notes: TutorNote[] = []): TutorNote[] => {
  let currentGroup: UnderstandTutorGroup = 'comprehension';

  return notes.map((note) => {
    if (note.group) return note;

    const text = stripHtmlForTutorGrouping(note.text);

    if (
      text.includes('word bank') ||
      text.includes('read each word') ||
      text.includes('read the word') ||
      text.includes('definition') ||
      text.includes('meaning')
    ) {
      currentGroup = 'wordBank';
    } else if (
      text.includes('sound practice') ||
      text.includes('pronunciation') ||
      text.includes('pronounce') ||
      text.includes('mouth') ||
      /\/[^/\s]{1,12}\//.test(text)
    ) {
      currentGroup = 'soundPractice';
    } else if (
      text.includes('profile card') ||
      text.includes('read the profile card') ||
      text.includes('team directory') ||
      text.includes('directory entry') ||
      text.includes('read the entry') ||
      text.includes('comprehension question') ||
      text.includes('ask the questions one by one') ||
      text.includes('ask the comprehension questions') ||
      text.includes('read the passage')
    ) {
      currentGroup = 'activityBlocks';
    } else if (
      text.includes('pattern drill') ||
      text.includes('patterns') ||
      text.includes('pattern') ||
      text.includes('table') ||
      text.includes('sentence')
    ) {
      currentGroup = 'comprehension';
    }

    return { ...note, group: currentGroup };
  });
};

interface PatternItem {
  en: string;
  kr: string;
}

interface VocabItem {
  word: string;
  pos: string;
  translation: string;
  definition?: string;
  pronunciation?: string;
}

interface PronunciationColumn {
  symbol: string;
  words: Array<{ en: string; kr: string }>;
}

interface FillRow {
  parts: Array<{ text: string; isBlank: boolean }>;
}

interface PatternDrill {
  label: string;
  labelKr: string;
  template: string;
  examples: Array<{ en: string; kr: string }>;
}

interface DialogueLine {
  role: 'tutor' | 'student';
  en: string;
  kr: string;
}

interface GuideQuestion {
  text: string;
}

const normalizeChallengeTutorNotes = (
  notes: TutorNote[] = [],
  guideQuestions: GuideQuestion[] = [],
): TutorNote[] => {
  const normalizedNotes = (Array.isArray(notes) ? notes : []).map((note) => ({
    ...note,
    type: normalizeTutorNoteType(note?.type),
    text: note?.text || '',
  })).filter((note, index, arr) => {
    if (note.type !== 'question') return true;
    const normalizedText = stripHtmlForTutorGrouping(note.text);
    if (!normalizedText) return false;
    return arr.findIndex((candidate) => (
      normalizeTutorNoteType(candidate?.type) === 'question' &&
      stripHtmlForTutorGrouping(candidate?.text || '') === normalizedText
    )) === index;
  });

  const hasQuestionNotes = normalizedNotes.some((note) => (
    note.type === 'question' && stripHtmlForTutorGrouping(note.text)
  ));

  if (hasQuestionNotes) {
    return normalizedNotes;
  }

  const existingQuestionTexts = new Set(
    normalizedNotes
      .filter((note) => note.type === 'question')
      .map((note) => stripHtmlForTutorGrouping(note.text))
      .filter(Boolean),
  );

  const legacyQuestionNotes = (Array.isArray(guideQuestions) ? guideQuestions : []).reduce<TutorNote[]>((acc, question) => {
    const text = question?.text || '';
    const normalizedText = stripHtmlForTutorGrouping(text);

    if (normalizedText && existingQuestionTexts.has(normalizedText)) {
      return acc;
    }

    if (normalizedText) {
      existingQuestionTexts.add(normalizedText);
    }

    acc.push({ type: 'question', text });
    return acc;
  }, []);

  return [...normalizedNotes, ...legacyQuestionNotes];
};

const getQuestionNoteOrdinal = (notes: TutorNote[] = [], index: number) =>
  notes
    .slice(0, index + 1)
    .filter((note) => normalizeTutorNoteType(note?.type) === 'question')
    .length;

interface DiscussionCategory {
  title: string;
  questions: string[];
}

interface ActivityBlockBase {
  type: ActivityBlockType;
  id: string;
  title: string;
  titleKr: string;
}

interface MatchingBlock extends ActivityBlockBase {
  type: 'matching';
  pairs: Array<{ left: string; right: string }>;
}

interface MultipleChoiceBlock extends ActivityBlockBase {
  type: 'multipleChoice';
  items: Array<{
    question: string;
    questionKr: string;
    options: Array<{ text: string; isCorrect: boolean }>;
  }>;
}

interface SentenceReorderBlock extends ActivityBlockBase {
  type: 'sentenceReorder';
  items: Array<{ jumbled: string; answer: string }>;
}

interface ErrorCorrectionBlock extends ActivityBlockBase {
  type: 'errorCorrection';
  items: Array<{ sentence: string; corrected: string; hint: string }>;
}

interface DialogueCompletionBlock extends ActivityBlockBase {
  type: 'dialogueCompletion';
  slots: Array<{ role: 'tutor' | 'student'; text: string; isBlank: boolean }>;
}

interface TrueFalseBlock extends ActivityBlockBase {
  type: 'trueFalse';
  items: Array<{ statement: string; statementKr: string; answer: boolean }>;
}

interface ReadingPassageBlock extends ActivityBlockBase {
  type: 'readingPassage';
  passage: string;
  questions: Array<{ question: string; questionKr: string }>;
}

interface CategorizationBlock extends ActivityBlockBase {
  type: 'categorization';
  categories: Array<{ name: string; items: string[] }>;
}

interface ImageBlock extends ActivityBlockBase {
  type: 'image';
  images: Array<{ src: string; label: string }>;
}

type ActivityBlock =
  | MatchingBlock
  | MultipleChoiceBlock
  | SentenceReorderBlock
  | ErrorCorrectionBlock
  | DialogueCompletionBlock
  | TrueFalseBlock
  | ReadingPassageBlock
  | CategorizationBlock
  | ImageBlock;

interface BELessonData {
  lessonType: LessonType;
  a4Layout?: BusinessA4Layout;
  hiddenBlocks: string[];
  introduce: {
    goalEn: string;
    goalKr: string;
    situationEn: string;
    situationKr: string;
    taskEn: string;
    taskKr: string;
    tutorNotes: TutorNote[];
  };
  present: {
    patterns: PatternItem[];
    vocabulary: VocabItem[];
    pronunciation: {
      instruction: string;
      instructionKr: string;
      left: PronunciationColumn;
      right: PronunciationColumn;
    };
    tutorNotes: TutorNote[];
  };
  understand: {
    instruction: string;
    instructionKr: string;
    fillRows: FillRow[];
    patternDrills: PatternDrill[];
    activityBlocks: ActivityBlock[];
    tutorNotes: TutorNote[];
  };
  practice: {
    steps: Array<{
      title: string;
      instructionEn: string;
      instructionKr: string;
      content: string;
      dialogue?: DialogueLine[];
      wordBox?: Array<{ word: string; translation?: string }>;
      tutorNotes: TutorNote[];
    }>;
    activityBlocks: ActivityBlock[];
  };
  challenge: {
    scenarioEn: string;
    scenarioKr: string;
    guideQuestions: GuideQuestion[];
    roleplayTable?: { you: string; coworkers: string[] };
    activityBlocks: ActivityBlock[];
    tutorNotes: TutorNote[];
  };
  discussion: {
    instructionEn: string;
    instructionKr: string;
    categories: DiscussionCategory[];
    activityBlocks: ActivityBlock[];
    tutorNotes: TutorNote[];
  };
  feedback: {
    goalReviewEn: string;
    goalReviewKr: string;
    feedbackTemplate: string;
    nextLessonLabel: string;
    nextLessonName: string;
    tutorNotes: TutorNote[];
  };
}

interface PreviewOverrides {
  chapterName?: string;
  lessonName?: string;
  goalTextEn?: string;
  goalTextJp?: string;
  theme?: ThemeMode;
  beData?: BELessonData;
}

const PCPP_PAGES = [
  { key: 'page1', num: '1', label: 'Introduce + Present' },
  { key: 'page2', num: '2', label: 'Understand + Vocab' },
  { key: 'page3', num: '3', label: 'Practice 1-2' },
  { key: 'page4', num: '4', label: 'Practice 3-4' },
  { key: 'page5', num: '5', label: 'Challenge' },
  { key: 'page6', num: '6', label: 'Discussion' },
  { key: 'page7', num: '7', label: 'Feedback' },
] as const;

const SECTION_STEPS = [
  { num: 1, short: 'Warm-Up' },
  { num: 2, short: 'Present' },
  { num: 3, short: 'Comp.' },
  { num: 4, short: 'Drill' },
  { num: 5, short: 'Simul.' },
  { num: 6, short: 'Wrap-Up' },
];

const LEVEL_BADGES: Record<number, string> = {
  3: 'BEGINNER',
  4: 'HIGH BEGINNER',
  5: 'HIGH BEGINNER',
  6: 'INTERMEDIATE',
  7: 'INTERMEDIATE',
  8: 'HIGH INTERMEDIATE',
  9: 'HIGH INTERMEDIATE',
  10: 'ADVANCED',
};

const ACTIVITY_BLOCK_META: Record<ActivityBlockType, { icon: string }> = {
  matching: { icon: 'ri-links-line' },
  multipleChoice: { icon: 'ri-checkbox-circle-line' },
  sentenceReorder: { icon: 'ri-sort-asc' },
  errorCorrection: { icon: 'ri-eraser-line' },
  dialogueCompletion: { icon: 'ri-chat-3-line' },
  trueFalse: { icon: 'ri-checkbox-line' },
  readingPassage: { icon: 'ri-article-line' },
  categorization: { icon: 'ri-layout-grid-line' },
  image: { icon: 'ri-image-line' },
};

const DEFAULT_BE_DATA: BELessonData = {
  lessonType: 'READING',
  hiddenBlocks: [],
  introduce: {
    goalEn: '',
    goalKr: '',
    situationEn: '',
    situationKr: '',
    taskEn: '',
    taskKr: '',
    tutorNotes: [],
  },
  present: {
    patterns: [],
    vocabulary: [],
    pronunciation: {
      instruction: '',
      instructionKr: '',
      left: { symbol: '', words: [] },
      right: { symbol: '', words: [] },
    },
    tutorNotes: [],
  },
  understand: {
    instruction: '',
    instructionKr: '',
    fillRows: [],
    patternDrills: [],
    activityBlocks: [],
    tutorNotes: [],
  },
  practice: {
    steps: [],
    activityBlocks: [],
  },
  challenge: {
    scenarioEn: '',
    scenarioKr: '',
    guideQuestions: [],
    roleplayTable: undefined,
    activityBlocks: [],
    tutorNotes: [],
  },
  discussion: {
    instructionEn: '',
    instructionKr: '',
    categories: [],
    activityBlocks: [],
    tutorNotes: [],
  },
  feedback: {
    goalReviewEn: '',
    goalReviewKr: '',
    feedbackTemplate: '',
    nextLessonLabel: '',
    nextLessonName: '',
    tutorNotes: [],
  },
};

const noteIcons: Record<NoteType, string> = {
  instruction: 'ri-file-list-3-line',
  script: 'ri-chat-quote-line',
  tip: 'ri-lightbulb-line',
  question: 'ri-question-line',
};

const html = (value?: string) => ({ __html: value || '' });

const getStoredTheme = (): ThemeMode => {
  const requestedTheme = new URLSearchParams(window.location.search).get('theme');
  if (requestedTheme === 'dark' || requestedTheme === 'light') return requestedTheme;
  try {
    return (localStorage.getItem('beve-theme') as ThemeMode) || 'dark';
  } catch {
    return 'dark';
  }
};

const normalizeActivityBlocks = (blocks: any[] = []): ActivityBlock[] =>
  blocks.map((block: any) => {
    switch (block?.type) {
      case 'matching':
        return { ...block, pairs: Array.isArray(block.pairs) ? block.pairs : [] } as MatchingBlock;
      case 'multipleChoice':
        return {
          ...block,
          items: Array.isArray(block.items)
            ? block.items.map((item: any) => ({
                ...item,
                options: Array.isArray(item?.options) ? item.options : [],
              }))
            : [],
        } as MultipleChoiceBlock;
      case 'sentenceReorder':
      case 'errorCorrection':
      case 'trueFalse':
        return { ...block, items: Array.isArray(block.items) ? block.items : [] } as ActivityBlock;
      case 'dialogueCompletion':
        return { ...block, slots: Array.isArray(block.slots) ? block.slots : [] } as DialogueCompletionBlock;
      case 'readingPassage':
        return {
          ...block,
          passage: block?.passage || '',
          questions: Array.isArray(block.questions) ? block.questions : [],
        } as ReadingPassageBlock;
      case 'categorization':
        return {
          ...block,
          categories: Array.isArray(block.categories)
            ? block.categories.map((category: any) => ({
                ...category,
                items: Array.isArray(category?.items) ? category.items : [],
              }))
            : [],
        } as CategorizationBlock;
      case 'image':
        return { ...block, images: Array.isArray(block.images) ? block.images : [] } as ImageBlock;
      default:
        return block as ActivityBlock;
    }
  });

const mergeWithDefaults = (raw: any): BELessonData => {
  const beData = raw || {};
  const patternDrills = Array.isArray(beData.understand?.patternDrills)
    ? beData.understand.patternDrills.map((drill: any) => {
        const examples = Array.isArray(drill?.examples) ? [...drill.examples] : [];
        while (examples.length < 5) examples.push({ en: '', kr: '' });
        return { ...drill, examples };
      })
    : [];
  const challengeTutorNotes = normalizeChallengeTutorNotes(
    Array.isArray(beData.challenge?.tutorNotes) ? beData.challenge.tutorNotes : [],
    Array.isArray(beData.challenge?.guideQuestions) ? beData.challenge.guideQuestions : [],
  );

  return {
    ...DEFAULT_BE_DATA,
    ...beData,
    introduce: {
      ...DEFAULT_BE_DATA.introduce,
      ...(beData.introduce || {}),
      tutorNotes: Array.isArray(beData.introduce?.tutorNotes) ? beData.introduce.tutorNotes : [],
    },
    present: {
      ...DEFAULT_BE_DATA.present,
      ...(beData.present || {}),
      patterns: beData.present?.patterns || [],
      vocabulary: beData.present?.vocabulary || [],
      pronunciation: {
        ...DEFAULT_BE_DATA.present.pronunciation,
        ...(beData.present?.pronunciation || {}),
        left: {
          ...DEFAULT_BE_DATA.present.pronunciation.left,
          ...(beData.present?.pronunciation?.left || {}),
          words: beData.present?.pronunciation?.left?.words || [],
        },
        right: {
          ...DEFAULT_BE_DATA.present.pronunciation.right,
          ...(beData.present?.pronunciation?.right || {}),
          words: beData.present?.pronunciation?.right?.words || [],
        },
      },
      tutorNotes: Array.isArray(beData.present?.tutorNotes) ? beData.present.tutorNotes : [],
    },
    understand: {
      ...DEFAULT_BE_DATA.understand,
      ...(beData.understand || {}),
      fillRows: beData.understand?.fillRows || [],
      patternDrills,
      activityBlocks: normalizeActivityBlocks(beData.understand?.activityBlocks || []),
      tutorNotes: normalizeUnderstandTutorNotes(Array.isArray(beData.understand?.tutorNotes) ? beData.understand.tutorNotes : []),
    },
    practice: {
      ...DEFAULT_BE_DATA.practice,
      ...(beData.practice || {}),
      steps: Array.isArray(beData.practice?.steps)
        ? beData.practice.steps.map((step: any) => ({
            ...step,
            tutorNotes: Array.isArray(step?.tutorNotes) ? step.tutorNotes : [],
            dialogue: Array.isArray(step?.dialogue) ? step.dialogue : undefined,
            wordBox: Array.isArray(step?.wordBox) ? step.wordBox : undefined,
          }))
        : [],
      activityBlocks: normalizeActivityBlocks(beData.practice?.activityBlocks || []),
    },
    challenge: {
      ...DEFAULT_BE_DATA.challenge,
      ...(beData.challenge || {}),
      roleplayTable: beData.challenge?.roleplayTable
        ? {
            ...beData.challenge.roleplayTable,
            you: beData.challenge.roleplayTable.you || '',
            coworkers: Array.isArray(beData.challenge.roleplayTable.coworkers)
              ? beData.challenge.roleplayTable.coworkers
              : [],
          }
        : undefined,
      activityBlocks: normalizeActivityBlocks(beData.challenge?.activityBlocks || []),
      guideQuestions: [],
      tutorNotes: challengeTutorNotes,
    },
    discussion: {
      ...DEFAULT_BE_DATA.discussion,
      ...(beData.discussion || {}),
      categories: Array.isArray(beData.discussion?.categories)
        ? beData.discussion.categories.map((category: any) => ({
            ...category,
            questions: Array.isArray(category?.questions) ? category.questions : [],
          }))
        : [],
      activityBlocks: normalizeActivityBlocks(beData.discussion?.activityBlocks || []),
      tutorNotes: Array.isArray(beData.discussion?.tutorNotes) ? beData.discussion.tutorNotes : [],
    },
    feedback: {
      ...DEFAULT_BE_DATA.feedback,
      ...(beData.feedback || {}),
      tutorNotes: Array.isArray(beData.feedback?.tutorNotes) ? beData.feedback.tutorNotes : [],
    },
  };
};

function StaticHtml({
  className = '',
  value,
  emptyText,
}: {
  className?: string;
  value?: string;
  emptyText?: string;
}) {
  if (!value && emptyText) {
    return <div className={`${className} beve-preview-empty`}>{emptyText}</div>;
  }

  return <div className={className} dangerouslySetInnerHTML={html(value)} />;
}

export default function BusinessEnglishPreview() {
  const { params } = useRoute();
  const id = params?.id;
  const [lesson, setLesson] = useState<LessonMaterial | null>(null);
  const [previewOverrides, setPreviewOverrides] = useState<PreviewOverrides | null>(null);
  const [hasSessionData, setHasSessionData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePage, setActivePage] = useState<string>('page1');
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  useLayoutEffect(() => {
    document.documentElement.dataset.materialTheme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const page1IntroStudentRef = useRef<HTMLDivElement | null>(null);
  const [page1IntroTutorMaxHeight, setPage1IntroTutorMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    const stored = sessionStorage.getItem(`business-english-preview-${id}`);
    let hasStoredPreview = false;
    if (stored) {
      try {
        const parsed = normalizeLessonMedia(JSON.parse(stored), API_BASE_URL) as PreviewOverrides;
        setPreviewOverrides(parsed);
        setHasSessionData(true);
        hasStoredPreview = true;
        if (!new URLSearchParams(window.location.search).has('theme') && parsed.theme) setTheme(parsed.theme);
      } catch (sessionError) {
        console.error('Failed to parse Business English preview session data:', sessionError);
      }
    }

    loadLesson(id, hasStoredPreview);
  }, [id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleScroll = () => {
      const keys = PCPP_PAGES.map((page) => page.key);
      for (let i = keys.length - 1; i >= 0; i -= 1) {
        const el = pageRefs.current[keys[i]];
        if (el && el.getBoundingClientRect().top <= 200) {
          setActivePage(keys[i]);
          break;
        }
      }
    };

    canvas.addEventListener('scroll', handleScroll, { passive: true });
    return () => canvas.removeEventListener('scroll', handleScroll);
  }, [loading]);

  useEffect(() => {
    const target = page1IntroStudentRef.current;
    if (!target) return;

    const updateHeight = () => {
      const nextHeight = Math.ceil(target.getBoundingClientRect().height);
      setPage1IntroTutorMaxHeight(nextHeight > 0 ? nextHeight : null);
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }

    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(target);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [previewOverrides, lesson, theme, loading]);

  const loadLesson = async (lessonId: string, allowDraftFallback = false) => {
    try {
      setLoading(true);
      let data: LessonMaterial;

      try {
        data = await getPublicLessonById(lessonId);
      } catch (publicLoadError) {
        if (!allowDraftFallback) {
          throw publicLoadError;
        }
        data = await getLessonById(lessonId);
      }

      setLesson(data);
      setError('');
    } catch (loadError) {
      console.error('Failed to load Business English lesson preview:', loadError);
      if (!sessionStorage.getItem(`business-english-preview-${lessonId}`)) {
        setError('Failed to load Business English preview');
      }
    } finally {
      setLoading(false);
    }
  };

  const scrollToPage = (key: string) => {
    const el = pageRefs.current[key];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('beve-theme', next);
    } catch {
      // ignore
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = '/business-english-editor';
  };

  const handleClose = () => {
    window.close();
  };

  if (loading) {
    return (
      <div className={`beve ${theme}`}>
        <div className="beve-loading">
          <i className="ri-loader-4-line" />
          <span>Loading lesson preview...</span>
        </div>
      </div>
    );
  }

  if ((error || !lesson) && !hasSessionData) {
    return (
      <div className={`beve ${theme}`}>
        <div className="beve-error">
          <i className="ri-error-warning-line" />
          <span>{error || 'Lesson not found'}</span>
          <button onClick={handleBack}>Back to Editor</button>
        </div>
      </div>
    );
  }

  const chapterName = previewOverrides?.chapterName ?? lesson?.chapterName ?? 'Preview';
  const lessonName = previewOverrides?.lessonName ?? lesson?.lessonName ?? 'Untitled Lesson';
  const goalTextEn = previewOverrides?.goalTextEn ?? lesson?.goalTextEn ?? '';
  const goalTextKr = previewOverrides?.goalTextJp ?? lesson?.goalTextJp ?? '';
  const beData = mergeWithDefaults(previewOverrides?.beData ?? lesson?.beData);
  const level = lesson?.level ?? 0;
  const chapter = lesson?.chapter ?? 0;
  const lessonNumber = lesson?.lessonNumber ?? 0;
  const skill = (lesson?.skill || '').toUpperCase();
  const isHidden = (blockId: string) => (beData.hiddenBlocks || []).includes(blockId);
  const totalSteps = beData.practice.steps.length;
  const page3StepIndices = Array.from({ length: Math.ceil(totalSteps / 2) }, (_, i) => i);
  const page4StepIndices = Array.from(
    { length: totalSteps - page3StepIndices.length },
    (_, i) => i + page3StepIndices.length,
  );

  const renderPageHeader = (pageNum: number) => (
    <div className="beve-page-header">
      <div className="beve-header-row1">
        <div className="beve-header-brand">
          <span className="beve-header-brand-text">
            <span className="brand-fluent">Fluent</span>
            <span className="brand-x">X</span>
            <span className="brand-verse">Verse</span>
          </span>
          <span className="beve-header-brand-sub">Business English</span>
        </div>
        <div className="beve-header-meta">
          <span className="beve-header-level">
            Level <strong>{level}</strong>
          </span>
          <span className="beve-header-meta-divider">|</span>
          <span className="beve-header-page">
            Page <strong>{pageNum}</strong>
          </span>
        </div>
      </div>
      <div className="beve-header-row2">
        <span className="beve-header-chapter">
          Chapter {chapter} / {chapterName || 'Untitled'}
        </span>
        <div className="beve-header-row2-right">
          <span className="beve-skill-badge">{beData.lessonType.toLowerCase()}</span>
        </div>
      </div>
      <div className="beve-header-row3">
        <h2 className="beve-header-lesson">
          <span className="beve-header-lesson-number">Lesson {lessonNumber}</span>{' '}
          <span className="beve-header-lesson-title">{lessonName || 'Untitled'}</span>
        </h2>
      </div>
    </div>
  );

  const renderSectionBanner = (activeNum: number, title: string) => (
    <div className="beve-section-banner">
      <div className="beve-section-banner-left">
        <span className="beve-section-banner-title">{title}</span>
      </div>
      <div className="beve-chevron-bar">
        {SECTION_STEPS.map((step, index) => (
          <div
            key={step.num}
            className={`beve-chevron${step.num === activeNum ? ' active' : ''}${step.num < activeNum ? ' completed' : ''}`}
          >
            {index > 0 && <span className="beve-chevron-connector" />}
            <span className="beve-chevron-num">{step.num}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPageFooter = () => (
    <div className="beve-page-footer">
      <div className="beve-footer-content">
        <div className="beve-footer-left">
          <span className="beve-page-footer-brand">
            <span className="brand-fluent">Fluent</span>
            <span className="brand-x">X</span>
            <span className="brand-verse">Verse</span>
          </span>
          <span className="beve-footer-divider">/</span>
          <span className="beve-footer-course">Business English</span>
        </div>
        <div className="beve-footer-center" />
        <div className="beve-footer-right">
          <span className="beve-footer-copy">&copy; {new Date().getFullYear()} FluentXVerse</span>
        </div>
      </div>
    </div>
  );

  const renderTutorNotes = (notes: TutorNote[], group?: UnderstandTutorGroup) => (
    <>
      <div className="beve-col-tutor-title">
        <i className="ri-booklet-line" /> Teaching Notes
      </div>
      <div className="beve-tutor-notes">
        {(group ? notes.filter((note) => (note.group || 'comprehension') === group) : notes).length > 0 ? (
          (group ? notes.filter((note) => (note.group || 'comprehension') === group) : notes).map((note, index) => (
            <div key={index} className={`beve-tutor-note ${note.type}`}>
              <div className="beve-tutor-note-type">
                <i className={noteIcons[note.type] || 'ri-file-text-line'} /> {note.type}
              </div>
              <StaticHtml className="beve-preview-static-rich" value={note.text} emptyText="No note text" />
            </div>
          ))
        ) : (
          <div className="beve-preview-empty">No teaching notes yet.</div>
        )}
      </div>
    </>
  );

  const renderHintBox = () => (
    <div className="beve-hint-box">
      <div className="beve-hint-label">Key Expressions</div>
      <div className="beve-hint-patterns">
        {(beData.present.patterns || []).map((pattern, index) => (
          <div key={index} className="beve-hint-pattern">
            <span className="beve-hint-en" dangerouslySetInnerHTML={html(pattern.en)} />
            <span className="beve-hint-kr" dangerouslySetInnerHTML={html(`(${pattern.kr})`)} />
          </div>
        ))}
      </div>
    </div>
  );

  const renderActivityBlock = (block: ActivityBlock) => {
    const icon = ACTIVITY_BLOCK_META[block.type]?.icon || 'ri-file-text-line';

    return (
      <div key={block.id} className="beve-activity-block">
        <div className="beve-activity-header">
          <i className={icon} />
          <div className="beve-activity-title">{block.title}</div>
        </div>

        {block.type === 'matching' && (
          <table className="beve-matching-table">
            <thead>
              <tr>
                <th>Left</th>
                <th>Right</th>
              </tr>
            </thead>
            <tbody>
              {(block.pairs || []).map((pair, index) => (
                <tr key={index}>
                  <td dangerouslySetInnerHTML={html(pair.left)} />
                  <td dangerouslySetInnerHTML={html(pair.right)} />
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {block.type === 'multipleChoice' &&
          (block.items || []).map((item, questionIndex) => (
            <div key={questionIndex} className="beve-mcq-item">
              <div className="beve-mcq-question">
                <span className="beve-mcq-num">{questionIndex + 1}.</span>
                <StaticHtml className="beve-preview-static-rich" value={item.question} />
              </div>
              <div className="beve-mcq-options">
                {(item.options || []).map((option, optionIndex) => (
                  <div
                    key={optionIndex}
                    className={`beve-mcq-option${option.isCorrect ? ' correct' : ''}`}
                  >
                    <span className="beve-preview-radio">
                      <i
                        className={
                          option.isCorrect
                            ? 'ri-checkbox-circle-fill'
                            : 'ri-checkbox-blank-circle-line'
                        }
                      />
                    </span>
                    <StaticHtml className="beve-preview-static-rich" value={option.text} />
                  </div>
                ))}
              </div>
            </div>
          ))}

        {block.type === 'sentenceReorder' &&
          (block.items || []).map((item, index) => (
            <div key={index} className="beve-reorder-item">
              <div className="beve-reorder-row">
                <span className="beve-reorder-label">Jumbled:</span>
                <StaticHtml className="beve-preview-static-rich" value={item.jumbled} />
              </div>
              <div className="beve-reorder-row">
                <span className="beve-reorder-label">Answer:</span>
                <StaticHtml className="beve-preview-static-rich" value={item.answer} />
              </div>
            </div>
          ))}

        {block.type === 'errorCorrection' &&
          (block.items || []).map((item, index) => (
            <div key={index} className="beve-error-item">
              <div className="beve-error-row">
                <span className="beve-error-label">×</span>
                <StaticHtml className="beve-preview-static-rich" value={item.sentence} />
              </div>
              <div className="beve-error-row">
                <span className="beve-error-label">✓</span>
                <StaticHtml className="beve-preview-static-rich" value={item.corrected} />
              </div>
              {item.hint && (
                <div className="beve-error-row">
                  <span className="beve-error-label">?</span>
                  <StaticHtml className="beve-preview-static-rich" value={item.hint} />
                </div>
              )}
            </div>
          ))}

        {block.type === 'dialogueCompletion' &&
          (block.slots || []).map((slot, index) => (
            <div
              key={index}
              className={`beve-dialogue-slot ${slot.role}${slot.isBlank ? ' blank' : ''}`}
            >
              <div className="beve-dialogue-slot-header">
                <span className="beve-preview-role-pill">
                  {slot.role === 'tutor' ? 'Tutor' : 'Student'}
                </span>
                {slot.isBlank && <span className="beve-preview-blank-pill">Blank</span>}
              </div>
              <StaticHtml
                className="beve-preview-static-rich"
                value={slot.isBlank ? `${slot.text} ______` : slot.text}
              />
            </div>
          ))}

        {block.type === 'trueFalse' &&
          (block.items || []).map((item, index) => (
            <div key={index} className="beve-tf-item">
              <div className="beve-tf-statement">
                <span className="beve-tf-num">{index + 1}.</span>
                <StaticHtml className="beve-preview-static-rich" value={item.statement} />
              </div>
              <div className="beve-tf-answer">
                <span className={`beve-tf-btn${item.answer ? ' active' : ''}`}>TRUE</span>
                <span className={`beve-tf-btn${!item.answer ? ' active' : ''}`}>FALSE</span>
              </div>
            </div>
          ))}

        {block.type === 'readingPassage' && (
          <>
            <div className="beve-reading-passage" dangerouslySetInnerHTML={html(block.passage)} />
            <div className="beve-reading-questions">
              {(block.questions || []).map((question, index) => (
                <div key={index} className="beve-reading-q">
                  <span className="beve-reading-q-num">{index + 1}.</span>
                  <StaticHtml className="beve-preview-static-rich" value={question.question} />
                </div>
              ))}
            </div>
          </>
        )}

        {block.type === 'categorization' && (
          <div className="beve-categorize-grid">
            {(block.categories || []).map((category, index) => (
              <div key={index} className="beve-categorize-col">
                <div className="beve-categorize-col-header">
                  <i className="ri-folder-2-line" />
                  <StaticHtml className="beve-preview-static-rich" value={category.name} />
                </div>
                {(category.items || []).map((item, itemIndex) => (
                  <div key={itemIndex} className="beve-categorize-item">
                    <i className="ri-check-line" />
                    <StaticHtml className="beve-preview-static-rich" value={item} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {block.type === 'image' && (
          <div className="beve-preview-image-grid">
            {(block.images || []).map((image, index) => (
              <figure key={index} className="beve-preview-image-card">
                {image.src ? (
                  <img src={image.src} alt={image.label || `Activity ${index + 1}`} />
                ) : (
                  <div className="beve-preview-image-placeholder">
                    <i className="ri-image-line" />
                  </div>
                )}
                {image.label && (
                  <figcaption dangerouslySetInnerHTML={html(image.label)} />
                )}
              </figure>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderActivityBlocksArea = (blocks: ActivityBlock[]) => {
    if (!blocks.length) return null;
    return <div className="beve-activity-blocks-area">{blocks.map(renderActivityBlock)}</div>;
  };

  const renderPracticeStep = (stepIndex: number) => {
    const step = beData.practice.steps[stepIndex];
    if (!step) return null;

    return (
      <div key={stepIndex} className="beve-step-card">
        <div className="beve-step-header">
          <span className="step-num">{stepIndex + 1}</span>
          <div className="step-title-text">{step.title}</div>
        </div>
        <div className="beve-step-body">
          <div className="beve-step-instruction">
            <StaticHtml className="beve-preview-static-rich" value={step.instructionEn} />
            {step.instructionKr && (
              <StaticHtml className="beve-step-instruction-kr" value={step.instructionKr} />
            )}
          </div>

          {step.content && <StaticHtml className="beve-preview-static-rich" value={step.content} />}

          {step.dialogue && step.dialogue.length > 0 && (
            <div className="beve-dialogue" style={{ marginTop: step.content ? 12 : 0 }}>
              {step.dialogue.map((line, lineIndex) => (
                <div key={lineIndex} className={`beve-dialogue-line ${line.role}`}>
                  <span className="beve-dialogue-role">
                    {line.role === 'tutor' ? 'Tutor:' : 'Student:'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <StaticHtml className="beve-dialogue-text" value={line.en} />
                    {line.kr && <StaticHtml className="beve-dialogue-text-kr" value={line.kr} />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step.wordBox && step.wordBox.length > 0 && (
            <div className="beve-word-box" style={{ marginTop: 12 }}>
              <div className="beve-word-box-label">
                <i className="ri-price-tag-3-line" /> Word Box
              </div>
              <div className="beve-word-box-items">
                {step.wordBox.map((item, index) => (
                  <div key={index} className="beve-word-box-item">
                    <span>{item.word}</span>
                    {item.translation && (
                      <span className="beve-word-box-trans">({item.translation})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPracticeStepNotes = (stepIndex: number) => {
    const step = beData.practice.steps[stepIndex];
    if (!step) {
      return (
        <div className="beve-col-tutor-title">
          <i className="ri-booklet-line" /> Teaching Notes
        </div>
      );
    }

    return (
      <>
        <div className="beve-col-tutor-title">
          <i className="ri-booklet-line" /> Teaching Notes
        </div>
        <div className="beve-practice-note-panel-title">{step.title}</div>
        <div className="beve-tutor-notes">
          {(step.tutorNotes || []).length > 0 ? (
            step.tutorNotes.map((note, noteIndex) => (
              <div key={noteIndex} className={`beve-tutor-note ${note.type}`}>
                <div className="beve-tutor-note-type">
                  <i className={noteIcons[note.type] || 'ri-file-text-line'} /> {note.type}
                </div>
                <StaticHtml className="beve-preview-static-rich" value={note.text} />
              </div>
            ))
          ) : (
            <div className="beve-preview-empty">No teaching notes for this step yet.</div>
          )}
        </div>
      </>
    );
  };

  const renderPage1 = () => (
    <div className="beve-page" id="beve-page1" ref={(el) => { pageRefs.current.page1 = el; }}>
      {renderPageHeader(1)}
      <div className="beve-page-sections">
        <div className="beve-page-section">
          <div className="beve-col-student" ref={page1IntroStudentRef}>
            {renderSectionBanner(1, 'WARM-UP')}
            <div className="beve-goal-box">
              <div className="beve-goal-label">Lesson Goal</div>
              <StaticHtml
                className="beve-goal-en"
                value={beData.introduce.goalEn || goalTextEn}
                emptyText="Goal not set"
              />
              <StaticHtml
                className="beve-goal-kr"
                value={beData.introduce.goalKr || goalTextKr}
                emptyText="목표 미설정"
              />
            </div>
            <div className="beve-situation-box">
              <div className="beve-situation-label">
                <i className="ri-briefcase-line" /> Situation and Task
              </div>
              <StaticHtml
                className="beve-situation-en"
                value={beData.introduce.situationEn}
                emptyText="Situation not set"
              />
              <StaticHtml className="beve-situation-kr" value={beData.introduce.situationKr} />
            </div>
          </div>
          <div
            className="beve-col-tutor"
            style={page1IntroTutorMaxHeight ? { maxHeight: `${page1IntroTutorMaxHeight}px` } : undefined}
          >
            {renderTutorNotes(beData.introduce.tutorNotes)}
          </div>
        </div>

        <div className="beve-page-section">
          <div className="beve-col-student">
            {renderSectionBanner(2, 'KEY EXPRESSIONS')}
            <div className="beve-sub-heading">
              Key Expressions <span className="kr-label">핵심 표현</span>
            </div>
            <div className="beve-patterns-grid">
              {beData.present.patterns.length > 0 ? (
                beData.present.patterns.map((pattern, index) => (
                  <div key={index} className="beve-pattern-card">
                    <StaticHtml className="beve-pattern-en" value={pattern.en} emptyText="Pattern" />
                    <StaticHtml className="beve-pattern-kr" value={pattern.kr} />
                  </div>
                ))
              ) : (
                <div className="beve-preview-empty">No key expressions yet.</div>
              )}
            </div>
          </div>
          <div className="beve-col-tutor">
            {renderTutorNotes(beData.present.tutorNotes)}
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  const renderPage2 = () => (
    <div className="beve-page" id="beve-page2" ref={(el) => { pageRefs.current.page2 = el; }}>
      {renderPageHeader(2)}
      <div className="beve-page-sections">
        <div className="beve-page-section">
          <div className="beve-col-student">
            {renderSectionBanner(3, 'COMPREHENSION')}

            {!isHidden('comprehensionIntro') && (
              <div className="beve-situation-box">
                <StaticHtml
                  className="beve-situation-en"
                  value={beData.understand.instruction}
                  emptyText="Comprehension instruction not set"
                />
                <StaticHtml className="beve-situation-kr" value={beData.understand.instructionKr} />
              </div>
            )}

            {!isHidden('patternDrills') && beData.understand.patternDrills.length > 0 && (
              <div className="beve-pattern-drills">
                {beData.understand.patternDrills.map((drill, drillIndex) => (
                  <div key={drillIndex} className="beve-drill-card">
                    <div className="beve-drill-header">
                      <StaticHtml className="beve-drill-label" value={drill.label} />
                      <StaticHtml className="beve-drill-label-kr" value={drill.labelKr} />
                    </div>
                    <div className="beve-drill-template" dangerouslySetInnerHTML={html(drill.template)} />
                    <table className="beve-drill-table">
                      <tbody>
                        {drill.examples.map((example, exampleIndex) => (
                          <tr key={exampleIndex}>
                            <td dangerouslySetInnerHTML={html(example.en)} />
                            <td dangerouslySetInnerHTML={html(example.kr)} />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="beve-col-tutor">{renderTutorNotes(beData.understand.tutorNotes, 'comprehension')}</div>
        </div>

        {!isHidden('vocabulary') && beData.present.vocabulary.length > 0 && (
          <div className="beve-page-section">
            <div className="beve-col-student">
              <div className="beve-sub-heading" style={{ marginTop: 0 }}>
                Word Bank <span className="kr-label">단어장</span>
              </div>
              <table className="beve-vocab-table">
                <thead>
                  <tr>
                    <th>Word</th>
                    <th>Part of Speech</th>
                    <th>Translation</th>
                    <th>Definition</th>
                  </tr>
                </thead>
                <tbody>
                  {beData.present.vocabulary.map((vocab, index) => (
                    <tr key={index}>
                      <td className="beve-vocab-word">{vocab.word}</td>
                      <td className="beve-vocab-pos">{vocab.pos}</td>
                      <td className="beve-vocab-translation">{vocab.translation}</td>
                      <td>{vocab.definition || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="beve-col-tutor">{renderTutorNotes(beData.understand.tutorNotes, 'wordBank')}</div>
          </div>
        )}

        {!isHidden('soundPractice') &&
          (beData.present.pronunciation.left.words.length > 0 ||
            beData.present.pronunciation.right.words.length > 0) && (
            <div className="beve-page-section">
              <div className="beve-col-student">
                <div className="beve-sub-heading" style={{ marginTop: 0 }}>
                  Sound Practice{' '}
                  <span className="kr-label">{beData.present.pronunciation.instructionKr}</span>
                </div>
                <div className="beve-pronun-box">
                  <StaticHtml
                    className="beve-pronun-title"
                    value={beData.present.pronunciation.instruction}
                    emptyText="Pronunciation instruction not set"
                  />
                  <div className="beve-pronun-columns">
                    {(['left', 'right'] as const).map((side) => {
                      const column = beData.present.pronunciation[side];
                      return (
                        <div key={side} className="beve-pronun-col">
                          <div className="beve-pronun-symbol">{column.symbol}</div>
                          <div className="beve-pronun-words">
                            {(column.words || []).map((word, index) => (
                              <div key={index} className="beve-pronun-word">
                                <span>{word.en}</span>
                                <span style={{ color: '#71717a', fontSize: 12 }}>{word.kr}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="beve-col-tutor">{renderTutorNotes(beData.understand.tutorNotes, 'soundPractice')}</div>
            </div>
          )}

        {beData.understand.activityBlocks.length > 0 && (
          <div className="beve-page-section">
            <div className="beve-col-student">{renderActivityBlocksArea(beData.understand.activityBlocks)}</div>
            <div className="beve-col-tutor">{renderTutorNotes(beData.understand.tutorNotes, 'activityBlocks')}</div>
          </div>
        )}
      </div>
      {renderPageFooter()}
    </div>
  );

  const renderPage3 = () => (
    <div className="beve-page" id="beve-page3" ref={(el) => { pageRefs.current.page3 = el; }}>
      {renderPageHeader(3)}
      <div className="beve-page-sections">
        {page3StepIndices.map((index, idx) => (
          <div key={index} className="beve-page-section">
            <div className="beve-col-student">
              {idx === 0 ? renderSectionBanner(4, 'DRILL') : null}
              {renderPracticeStep(index)}
            </div>
            <div className="beve-col-tutor">{renderPracticeStepNotes(index)}</div>
          </div>
        ))}
        <div className="beve-page-section beve-page-section-full">
          <div className="beve-col-student">
            {beData.present.patterns.length > 0 && renderHintBox()}
            {renderActivityBlocksArea(beData.practice.activityBlocks)}
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  const renderPage4 = () => (
    <div className="beve-page" id="beve-page4" ref={(el) => { pageRefs.current.page4 = el; }}>
      {renderPageHeader(4)}
      <div className="beve-page-sections">
        {page4StepIndices.length > 0 ? (
          page4StepIndices.map((index, idx) => (
            <div key={index} className="beve-page-section">
              <div className="beve-col-student">
                {idx === 0 ? renderSectionBanner(4, 'DRILL (CONTINUATION)') : null}
                {renderPracticeStep(index)}
              </div>
              <div className="beve-col-tutor">{renderPracticeStepNotes(index)}</div>
            </div>
          ))
        ) : (
          <div className="beve-page-section beve-page-section-full">
            <div className="beve-col-student">
              {renderSectionBanner(4, 'DRILL (CONTINUATION)')}
              <div className="beve-preview-empty">
                All practice steps fit on the previous page.
              </div>
            </div>
          </div>
        )}
        <div className="beve-page-section beve-page-section-full">
          <div className="beve-col-student">
            {beData.present.patterns.length > 0 && renderHintBox()}
            {renderActivityBlocksArea(beData.practice.activityBlocks)}
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  const renderPage5 = () => (
    (() => {
      const challengeQuestionEntries = beData.challenge.tutorNotes
        .map((note, index) => ({ note, index }))
        .filter(({ note }) => normalizeTutorNoteType(note.type) === 'question');
      const firstQuestionIndex = challengeQuestionEntries.length > 0 ? challengeQuestionEntries[0].index : -1;
      const challengeLeadingNotes = firstQuestionIndex === -1
        ? beData.challenge.tutorNotes.map((note, index) => ({ note, index }))
        : beData.challenge.tutorNotes
            .slice(0, firstQuestionIndex)
            .map((note, index) => ({ note, index }))
            .filter(({ note }) => normalizeTutorNoteType(note.type) !== 'question');
      const challengeTrailingNotes = firstQuestionIndex === -1
        ? []
        : beData.challenge.tutorNotes
            .slice(firstQuestionIndex)
            .map((note, offset) => ({ note, index: firstQuestionIndex + offset }))
            .filter(({ note }) => normalizeTutorNoteType(note.type) !== 'question');

      return (
    <div className="beve-page" id="beve-page5" ref={(el) => { pageRefs.current.page5 = el; }}>
      {renderPageHeader(5)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(5, 'SIMULATION')}
          <div className="beve-challenge-box">
            <div className="beve-challenge-title">
              <i className="ri-sword-line" /> Simulation
            </div>
            <StaticHtml
              className="beve-challenge-scenario"
              value={beData.challenge.scenarioEn}
              emptyText="Simulation scenario not set"
            />
            <StaticHtml className="beve-challenge-scenario-kr" value={beData.challenge.scenarioKr} />
          </div>

          {!isHidden('roleplayTable') && beData.challenge.roleplayTable && (
            <div className="beve-situation-box">
              <div className="beve-situation-label">Roleplay Assignments</div>
              <div className="beve-preview-roleplay-grid">
                <div>
                  <div className="beve-preview-role-label">YOU</div>
                  <StaticHtml
                    className="beve-preview-static-rich"
                    value={beData.challenge.roleplayTable.you}
                  />
                </div>
                <div>
                  <div className="beve-preview-role-label">YOUR COWORKERS</div>
                  <div className="beve-preview-role-list">
                    {(beData.challenge.roleplayTable.coworkers || []).map((coworker, index) => (
                      <StaticHtml
                        key={index}
                        className="beve-preview-static-rich"
                        value={coworker}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {renderActivityBlocksArea(beData.challenge.activityBlocks)}
          {beData.present.patterns.length > 0 && renderHintBox()}
        </div>
        <div className="beve-col-tutor">
          <div className="beve-col-tutor-title">
            <i className="ri-booklet-line" /> Teaching Notes
          </div>
          <div className="beve-tutor-notes">
            {challengeLeadingNotes.length > 0 ? (
              challengeLeadingNotes.map(({ note, index }) => (
                <div key={index} className={`beve-tutor-note ${note.type}`}>
                  <div className="beve-tutor-note-type">
                    <i className={noteIcons[note.type] || 'ri-file-text-line'} /> {note.type}
                  </div>
                  <StaticHtml className="beve-preview-static-rich" value={note.text} />
                </div>
              ))
            ) : challengeQuestionEntries.length === 0 && challengeTrailingNotes.length === 0 ? (
              <div className="beve-preview-empty">No teaching notes yet.</div>
            ) : null}
            {challengeQuestionEntries.length > 0 && (
              <>
                <div className="beve-sub-heading" style={{ borderBottom: 'none', marginBottom: 6, marginTop: challengeLeadingNotes.length > 0 ? 16 : 0 }}>
                  Prompt Questions
                </div>
                <div className="beve-guide-questions">
                  {challengeQuestionEntries.map(({ note }, questionIndex) => (
                    <div key={questionIndex} className="beve-guide-q">
                      <span style={{ fontWeight: 700, color: '#7c3aed', marginRight: 6 }}>
                        {questionIndex + 1}.
                      </span>
                      <span dangerouslySetInnerHTML={html(note.text)} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {challengeTrailingNotes.map(({ note, index }) => (
              <div key={index} className={`beve-tutor-note ${note.type}`}>
                <div className="beve-tutor-note-type">
                  <i className={noteIcons[note.type] || 'ri-file-text-line'} /> {note.type}
                </div>
                <StaticHtml className="beve-preview-static-rich" value={note.text} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>
      );
    })()
  );

  const renderPage6 = () => (
    <div className="beve-page" id="beve-page6" ref={(el) => { pageRefs.current.page6 = el; }}>
      {renderPageHeader(6)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(5, 'SIMULATION — OPEN TALK')}
          <div className="beve-situation-box">
            <StaticHtml
              className="beve-situation-en"
              value={beData.discussion.instructionEn}
              emptyText="Discussion instruction not set"
            />
            <StaticHtml className="beve-situation-kr" value={beData.discussion.instructionKr} />
          </div>
          <div className="beve-discussion-categories">
            {beData.discussion.categories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="beve-disc-cat">
                <StaticHtml
                  className="beve-disc-cat-title"
                  value={category.title}
                  emptyText="Category"
                />
                <div className="beve-disc-questions">
                  {(category.questions || []).map((question, questionIndex) => (
                    <div key={questionIndex} className="beve-disc-q" data-num={`${questionIndex + 1}.`}>
                      <span dangerouslySetInnerHTML={html(question)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {renderActivityBlocksArea(beData.discussion.activityBlocks)}
        </div>
        <div className="beve-col-tutor">{renderTutorNotes(beData.discussion.tutorNotes)}</div>
      </div>
      {renderPageFooter()}
    </div>
  );

  const renderPage7 = () => (
    <div className="beve-page" id="beve-page7" ref={(el) => { pageRefs.current.page7 = el; }}>
      {renderPageHeader(7)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(6, 'WRAP-UP')}

          <div className="beve-goal-box beve-readonly-ref">
            <div className="beve-goal-label">
              <i className="ri-bookmark-line" style={{ marginRight: 4 }} /> Lesson Goal
            </div>
            <StaticHtml
              className="beve-goal-en"
              value={beData.introduce.goalEn || goalTextEn}
              emptyText="Goal not set"
            />
            <StaticHtml
              className="beve-goal-kr"
              value={beData.introduce.goalKr || goalTextKr}
              emptyText="목표 미설정"
            />
          </div>

          <div className="beve-readonly-ref beve-key-expr-ref">
            <div className="beve-goal-label">
              <i className="ri-key-2-line" style={{ marginRight: 4 }} /> Key Expressions
            </div>
            {beData.present.patterns.length > 0 ? (
              beData.present.patterns.map((pattern, index) => (
                <div key={index} className="beve-key-expr-row">
                  <span className="beve-key-expr-num">{index + 1}.</span>
                  <div>
                    <StaticHtml className="beve-key-expr-en" value={pattern.en} />
                    <StaticHtml className="beve-key-expr-kr" value={pattern.kr} />
                  </div>
                </div>
              ))
            ) : (
              <div className="beve-preview-empty">No key expressions yet.</div>
            )}
          </div>

          {!isHidden('feedbackTemplate') && (
            <>
              <div className="beve-sub-heading" style={{ marginTop: 0 }}>
                <i className="ri-chat-check-line" /> Tutor&apos;s Review
              </div>
              <div className="beve-feedback-template">
                <StaticHtml
                  className="beve-preview-static-rich"
                  value={beData.feedback.feedbackTemplate}
                  emptyText="Feedback template not set"
                />
              </div>
            </>
          )}

          {!isHidden('nextLesson') && (
            <div className="beve-next-lesson">
              <i className="ri-arrow-right-circle-line" />
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#a1a1aa',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    marginBottom: 2,
                  }}
                >
                  Next Lesson
                </div>
                <div>
                  <span>{beData.feedback.nextLessonLabel}</span>
                  {beData.feedback.nextLessonLabel && beData.feedback.nextLessonName ? ' — ' : ''}
                  <strong>{beData.feedback.nextLessonName}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="beve-col-tutor">{renderTutorNotes(beData.feedback.tutorNotes)}</div>
      </div>
      {renderPageFooter()}
    </div>
  );

  return (
    <div className={`beve ${theme} beve-preview${isBusinessA4Pilot(lesson) ? ' beve--a4' : ''}`}>
      <div className="beve-toolbar">
        <div className="beve-toolbar-left">
          <button className="beve-back-btn" onClick={handleBack}>
            <i className="ri-arrow-left-line" />
            <span>Back</span>
          </button>
          <div className="beve-toolbar-divider" />
          <div className="beve-toolbar-title">
            <span className="beve-toolbar-badge">{LEVEL_BADGES[level] || `LEVEL ${level}`}</span>
            Lesson {lessonNumber}: {lessonName || 'Untitled'}
          </div>
        </div>
        <div className="beve-toolbar-center">
          <i className="ri-eye-line" /> Business English Preview
        </div>
        <div className="beve-toolbar-right">
          <button
            className="beve-toolbar-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            <i className={theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line'} />
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button className="beve-toolbar-btn" onClick={handleClose}>
            <i className="ri-close-line" />
            Close
          </button>
        </div>
      </div>

      <div className="beve-body">
        {isBusinessA4Pilot(lesson) ? <BusinessEnglishA4Document
          sections={businessA4Sections([renderPage1(), renderPage2(), renderPage3(), renderPage4(), renderPage5(), renderPage6(), renderPage7()])}
          renderHeader={renderPageHeader}
          renderFooter={renderPageFooter}
          layout={beData.a4Layout}
        /> : <>
        <div className="beve-sidebar">
          <div className="beve-sidebar-header">Pages</div>
          <div className="beve-sidebar-pages">
            {PCPP_PAGES.map((page) => (
              <button
                key={page.key}
                className={`beve-sidebar-page ${activePage === page.key ? 'active' : ''}`}
                onClick={() => scrollToPage(page.key)}
              >
                <span className="beve-page-num">{page.num}</span>
                <span className="beve-page-label">{page.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="beve-canvas" ref={canvasRef}>
          {renderPage1()}
          {renderPage2()}
          {renderPage3()}
          {renderPage4()}
          {renderPage5()}
          {renderPage6()}
          {renderPage7()}
        </div>
        </>}
      </div>
    </div>
  );
}
