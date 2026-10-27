/**
 * BusinessEnglishVisualEditor
 * WYSIWYG visual editor for Business English PCPP lesson materials.
 *
 * 7-page scrollable document matching the reference PDF structure:
 *   Page 1: ① Introduce (Goal + Situation) + ② Present (Key Expressions)
 *   Page 2: ③ Understand (Table) + Useful Vocabulary + Pronunciation
 *   Page 3: ④ Practice Steps 1-2
 *   Page 4: ④ Practice Steps 3-4
 *   Page 5: ⑤ Challenge (Simulation)
 *   Page 6: ⑤ Challenge – Discussion Questions
 *   Page 7: ⑥ Feedback
 *
 * Design: white page, black bars, dark-purple accent (#4c1d95)
 * Two-column: Student material (left) | Teaching Notes (right)
 */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import {
  getLessonById,
  updateLessonHeader,
  type LessonMaterial,
} from '../api/lessonMaterial.api';
import { toast } from '../Components/Toast/Toast';
import { BEAIContentGenerator } from '../components/BEAIContentGenerator';
import type { BESectionType } from '../api/ai.api';
import BusinessEnglishA4Document, { businessA4Sections } from '../components/businessEnglish/BusinessEnglishA4Document';
import { isBusinessA4Pilot, type BusinessA4Layout } from '../components/businessEnglish/a4Pagination';
import './BusinessEnglishVisualEditor.css';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type LessonType = 'READING' | 'SPEAKING' | 'LISTENING' | 'WRITING' | 'REVIEW';
interface PatternItem { en: string; kr: string; }
interface VocabItem { word: string; pos: string; translation: string; definition?: string; pronunciation?: string; }
interface PronunColumn { symbol: string; words: { en: string; kr: string }[]; }
interface DialogueLine { role: 'tutor' | 'student'; en: string; kr: string; }
interface FillRow { parts: { text: string; isBlank: boolean }[]; }
interface DiscussionCategory { title: string; questions: string[]; }
type UnderstandTutorGroup = 'comprehension' | 'wordBank' | 'soundPractice' | 'activityBlocks';
type TutorNoteType = 'instruction' | 'script' | 'tip' | 'question';
interface TutorNote { type: TutorNoteType; text: string; group?: UnderstandTutorGroup | string; }
type TutorNoteDragState =
  | { kind: 'section'; section: string; index: number; group?: string }
  | { kind: 'practice'; stepIndex: number; index: number };
interface GuideQuestion { text: string; }
interface PatternDrill {
  label: string; labelKr: string;
  template: string;
  examples: { en: string; kr: string }[];
}
interface WordBoxItem { word: string; translation?: string; }

const stripHtmlForTutorGrouping = (value: string = '') =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeTutorNoteType = (type: string = 'instruction'): TutorNoteType =>
  ['instruction', 'script', 'tip', 'question'].includes(type)
    ? (type as TutorNoteType)
    : 'instruction';

const TUTOR_NOTE_ICONS: Record<TutorNoteType, string> = {
  instruction: 'ri-file-list-3-line',
  script: 'ri-chat-quote-line',
  tip: 'ri-lightbulb-line',
  question: 'ri-question-line',
};

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
    if (!normalizedText) return true;
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

// ─── Activity Block Types ─────────────────────────────────
type ActivityBlockType = 'matching' | 'multipleChoice' | 'sentenceReorder' | 'errorCorrection' | 'dialogueCompletion' | 'trueFalse' | 'readingPassage' | 'categorization' | 'image';

interface MatchingPair { left: string; right: string; }
interface MatchingBlock { type: 'matching'; id: string; title: string; titleKr: string; pairs: MatchingPair[]; }

interface MCQOption { text: string; isCorrect: boolean; }
interface MCQItem { question: string; questionKr: string; options: MCQOption[]; }
interface MultipleChoiceBlock { type: 'multipleChoice'; id: string; title: string; titleKr: string; items: MCQItem[]; }

interface SentenceReorderItem { jumbled: string; answer: string; }
interface SentenceReorderBlock { type: 'sentenceReorder'; id: string; title: string; titleKr: string; items: SentenceReorderItem[]; }

interface ErrorCorrectionItem { sentence: string; corrected: string; hint: string; }
interface ErrorCorrectionBlock { type: 'errorCorrection'; id: string; title: string; titleKr: string; items: ErrorCorrectionItem[]; }

interface DialogueCompletionSlot { role: 'tutor' | 'student'; text: string; isBlank: boolean; }
interface DialogueCompletionBlock { type: 'dialogueCompletion'; id: string; title: string; titleKr: string; slots: DialogueCompletionSlot[]; }

interface TrueFalseItem { statement: string; statementKr: string; answer: boolean; }
interface TrueFalseBlock { type: 'trueFalse'; id: string; title: string; titleKr: string; items: TrueFalseItem[]; }

interface ReadingPassageBlock { type: 'readingPassage'; id: string; title: string; titleKr: string; passage: string; questions: { question: string; questionKr: string }[]; }

interface CategorizationCategory { name: string; items: string[]; }
interface CategorizationBlock { type: 'categorization'; id: string; title: string; titleKr: string; categories: CategorizationCategory[]; }

interface ImageItem { src: string; label: string; }
interface ImageBlock { type: 'image'; id: string; title: string; titleKr: string; images: ImageItem[]; }

type ActivityBlock = MatchingBlock | MultipleChoiceBlock | SentenceReorderBlock | ErrorCorrectionBlock | DialogueCompletionBlock | TrueFalseBlock | ReadingPassageBlock | CategorizationBlock | ImageBlock;

const ACTIVITY_BLOCK_META: Record<ActivityBlockType, { label: string; labelKr: string; icon: string }> = {
  matching: { label: 'Matching', labelKr: '매칭', icon: 'ri-links-line' },
  multipleChoice: { label: 'Multiple Choice', labelKr: '객관식', icon: 'ri-checkbox-circle-line' },
  sentenceReorder: { label: 'Sentence Reordering', labelKr: '문장 재배열', icon: 'ri-sort-asc' },
  errorCorrection: { label: 'Error Correction', labelKr: '오류 수정', icon: 'ri-eraser-line' },
  dialogueCompletion: { label: 'Dialogue Completion', labelKr: '대화 완성', icon: 'ri-chat-3-line' },
  trueFalse: { label: 'True / False', labelKr: '참/거짓', icon: 'ri-checkbox-line' },
  readingPassage: { label: 'Reading Passage', labelKr: '독해', icon: 'ri-article-line' },
  categorization: { label: 'Categorization', labelKr: '분류', icon: 'ri-layout-grid-line' },
  image: { label: 'Image', labelKr: '이미지', icon: 'ri-image-line' },
};

interface BELessonData {
  lessonType: LessonType;
  a4Layout?: BusinessA4Layout;
  hiddenBlocks: string[];
  introduce: {
    goalEn: string; goalKr: string;
    situationEn: string; situationKr: string;
    taskEn: string; taskKr: string;
    tutorNotes: TutorNote[];
  };
  present: {
    patterns: PatternItem[];
    vocabulary: VocabItem[];
    pronunciation: { instruction: string; instructionKr: string; left: PronunColumn; right: PronunColumn; };
    tutorNotes: TutorNote[];
  };
  understand: {
    instruction: string; instructionKr: string;
    fillRows: FillRow[];
    patternDrills: PatternDrill[];
    activityBlocks: ActivityBlock[];
    tutorNotes: TutorNote[];
  };
  practice: {
    steps: {
      title: string; instructionEn: string; instructionKr: string;
      content: string; dialogue?: DialogueLine[]; wordBox?: WordBoxItem[];
      tutorNotes: TutorNote[];
    }[];
    activityBlocks: ActivityBlock[];
  };
  challenge: {
    scenarioEn: string; scenarioKr: string;
    guideQuestions: GuideQuestion[];
    roleplayTable?: { you: string; coworkers: string[] };
    activityBlocks: ActivityBlock[];
    tutorNotes: TutorNote[];
  };
  discussion: {
    instructionEn: string; instructionKr: string;
    categories: DiscussionCategory[];
    activityBlocks: ActivityBlock[];
    tutorNotes: TutorNote[];
  };
  feedback: {
    goalReviewEn: string; goalReviewKr: string;
    feedbackTemplate: string;
    nextLessonLabel: string; nextLessonName: string;
    tutorNotes: TutorNote[];
  };
}

type PracticeStepData = BELessonData['practice']['steps'][number];

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_BE_DATA: BELessonData = {
  lessonType: 'READING',
  hiddenBlocks: [],
  introduce: {
    goalEn: 'Can introduce yourself and your coworker.',
    goalKr: '자기소개와 동료 소개를 할 수 있게 된다.',
    situationEn: 'A new coworker joins your team. Introduce yourself and another coworker to him/her.',
    situationKr: '당신의 팀에 새로운 직원이 배치되었습니다. 먼저 자기소개를 한 후 팀원을 그/그녀에게 소개해 봅시다.',
    taskEn: '', taskKr: '',
    tutorNotes: [
      { type: 'script', text: '"Today, we\'re going to talk about introducing yourself and your coworker."' },
      { type: 'instruction', text: 'Read the lesson goal.' },
      { type: 'instruction', text: 'Ask the student to repeat.' },
      { type: 'script', text: '"Is it clear?"' },
      { type: 'script', text: '"Let\'s go to the next part."' },
    ],
  },
  present: {
    patterns: [
      { en: 'My name is John.', kr: '제 이름은 존입니다.' },
      { en: 'This is Andrew.', kr: '이쪽은 앤드류입니다.' },
      { en: 'We are coworkers.', kr: '우리는 동료입니다.' },
    ],
    vocabulary: [
      { word: 'pleased', pos: 'adjective', translation: '기꺼이', definition: 'very happy', pronunciation: '[pleezd]' },
      { word: 'coworker', pos: 'noun', translation: '동료', definition: 'someone you work with', pronunciation: '[KOH-wur-ker]' },
      { word: 'join', pos: 'verb', translation: '합류하다', definition: 'to become a member of a group', pronunciation: '[join]' },
    ],
    pronunciation: {
      instruction: "Let's practice saying words with /\u00E6/ and /\u028C/.",
      instructionKr: '\u767A\u97F3',
      left: { symbol: '/\u00E6/', words: [{ en: 'bag', kr: '가방' },{ en: 'fan', kr: '선풍기' },{ en: 'cab', kr: '택시' },{ en: 'hat', kr: '모자' },{ en: 'lack', kr: '부족한' }] },
      right: { symbol: '/\u028C/', words: [{ en: 'bug', kr: '벌레' },{ en: 'fun', kr: '재미' },{ en: 'cub', kr: '새끼' },{ en: 'hut', kr: '오두막' },{ en: 'luck', kr: '행운' }] },
    },
    tutorNotes: [
      { type: 'script', text: '"Let\'s look at patterns used in introducing yourself and your coworker."' },
      { type: 'instruction', text: 'Read the first pattern. Ask the student to repeat.' },
      { type: 'script', text: '"Use this to introduce yourself."' },
      { type: 'instruction', text: 'Read each word. Ask the student to repeat.' },
      { type: 'tip', text: 'For lower-level students, give simple definitions.' },
    ],
  },
  understand: {
    instruction: 'You can use these patterns to introduce yourself and a coworker.',
    instructionKr: '자기소개나 동료를 소개할 때 다음 패턴을 사용합니다.',
    fillRows: [],
    patternDrills: [],
    activityBlocks: [],
    tutorNotes: [
      { type: 'instruction', text: 'Read each sentence in the table. Ask the student to repeat.' },
      { type: 'instruction', text: 'Correct mispronounced words after reading.' },
      { type: 'tip', text: 'For lower-level students, explain how each sentence is used.' },
    ],
  },
  practice: {
    steps: [
      {
        title: 'Step 1 \u2014 Repeat',
        instructionEn: 'Repeat after your tutor.',
        instructionKr: '선생님을 따라 반복하세요.',
        content: '',
        tutorNotes: [
          { type: 'script', text: '"I will read each sentence. Please repeat after me."' },
          { type: 'instruction', text: 'Adjust the speed according to the student\'s level.' },
          { type: 'instruction', text: 'Correct mispronounced words after reading.' },
        ],
      },
      {
        title: 'Step 2 \u2014 Fill in the Blanks',
        instructionEn: 'Fill in the blanks with the correct pattern.',
        instructionKr: '적절한 패턴을 넣으세요.',
        content: '',
        tutorNotes: [
          { type: 'script', text: '"Let\'s practice again."' },
          { type: 'instruction', text: 'Read the instruction.' },
          { type: 'script', text: '"Please start with the first sentence."' },
        ],
      },
      {
        title: 'Step 3 \u2014 Dialogue',
        instructionEn: 'Read the dialogue with your tutor.',
        instructionKr: '선생님과 함께 대화를 읽어 봅시다.',
        content: '',
        dialogue: [
          { role: 'tutor', en: 'Good morning. My name is Evan. It\'s my first day today.', kr: '안녕하세요. 제 이름은 에반입니다. 오늘은 제 첫 출근 날입니다.' },
          { role: 'student', en: 'Pleased to meet you, Evan. My name is Akihiro. This is Sandra. We are coworkers.', kr: '만나서 반갑습니다, 에반 씨. 제 이름은 아키히로입니다. 이쪽은 산드라입니다. 우리는 동료입니다.' },
          { role: 'tutor', en: 'Pleased to meet you, too, Akihiro and Sandra.', kr: '아키히로 씨, 산드라 씨, 저도 반갑습니다.' },
        ],
        tutorNotes: [
          { type: 'script', text: '"Let\'s read the dialogue."' },
          { type: 'script', text: '"Is it clear?"' },
          { type: 'tip', text: 'For lower-level students, first read each line and have them repeat after you. Then, roleplay.' },
          { type: 'script', text: '"Great job!"' },
        ],
      },
      {
        title: 'Step 4 \u2014 Complete the Dialogue',
        instructionEn: 'Complete the dialogue.',
        instructionKr: '대화문을 완성하세요.',
        content: '',
        dialogue: [
          { role: 'tutor', en: 'Hello. My name is Shirley. I\'m the new secretary.', kr: '안녕하세요. 제 이름은 셜리입니다. 저는 새로운 비서입니다.' },
          { role: 'student', en: 'Pleased to meet you, Shirley. ________________. ________________. ________________.', kr: '셜리 씨, 만나서 반갑습니다. ________________.' },
          { role: 'tutor', en: 'Pleased to meet you, too!', kr: '저도 만나서 반갑습니다.' },
        ],
        tutorNotes: [
          { type: 'script', text: '"Let\'s do the last practice."' },
          { type: 'instruction', text: 'Read the instruction.' },
          { type: 'tip', text: 'For lower-level students, ask them to do it step by step.' },
        ],
      },
    ],
    activityBlocks: [],
  },
  challenge: {
    scenarioEn: 'A new coworker joins your team. Using today\'s patterns and the table, introduce yourself and your coworkers. Then, say that you are coworkers.',
    scenarioKr: '새로운 동료가 당신의 팀에 합류합니다. 자주 쓰는 문법 표현과 아래 표를 사용하여 자기소개와 동료 소개를 해 봅시다.',
    guideQuestions: [
      { text: 'Hi! Nice to meet you. May I know the names of the others, as well?' },
      { text: 'Do you work with all of them?' },
      { text: 'Are we teammates?' },
      { text: 'I see. Do we often have meetings together?' },
      { text: 'What other things do we do together?' },
    ],
    roleplayTable: { you: 'Your own name', coworkers: ['Margaret', 'Edison', 'Vanessa', 'Mila', 'Antonia'] },
    activityBlocks: [],
    tutorNotes: [
      { type: 'script', text: '"Are you ready for the challenge?"' },
      { type: 'instruction', text: 'Read the situation.' },
      { type: 'script', text: '"Now, I am your new coworker. I\'ll start."' },
      { type: 'instruction', text: 'Make the discussion as natural as possible.' },
      { type: 'instruction', text: 'Give feedback after finishing the challenge.' },
    ],
  },
  discussion: {
    instructionEn: 'Choose one category, then answer the questions.',
    instructionKr: '카테고리를 하나 선택하고 질문에 답해 봅시다.',
    categories: [
      { title: 'YOUR BOSS', questions: ['What is the name of your boss?', 'What is his/her position in the company?', 'Is he/she a good boss? Why?'] },
      { title: 'YOUR TEAMMATE', questions: ['Can you name one of your teammates?', 'Can you describe him/her?', 'What is his/her task in the team?'] },
      { title: 'YOUR FAVORITE COWORKER', questions: ['Who is your favorite coworker?', 'What do you like about him/her?', 'What is his/her job?'] },
    ],
    activityBlocks: [],
    tutorNotes: [
      { type: 'script', text: '"Now, let\'s have a discussion."' },
      { type: 'script', text: '"Please choose a category you would like to discuss."' },
      { type: 'instruction', text: 'Ask the questions under the student\'s preferred category.' },
      { type: 'tip', text: 'If the student can\'t choose, pick a category. If there is remaining time, let the student choose another category.' },
    ],
  },
  feedback: {
    goalReviewEn: 'Can introduce yourself and your coworker.',
    goalReviewKr: '자기소개와 동료 소개를 할 수 있게 된다.',
    feedbackTemplate: '*OVERALL SCORE*\nOverall: (score)\n- comment\n\n*Vocabulary/Phrases*\nVocabulary:\n- word/phrase\n- word/phrase\n\n*Grammar*\nGrammar:\nincorrect grammar = correct grammar\n\n*Pronunciation*\nPronunciation:\n- mispronounced word\n- mispronounced word',
    nextLessonLabel: 'CHAPTER 1: WORK INTRODUCTIONS',
    nextLessonName: 'Lesson 2: A New Coworker',
    tutorNotes: [
      { type: 'script', text: '"It\'s the end of the lesson. Great job! Now, let\'s review today\'s lesson goal."' },
      { type: 'instruction', text: 'Ask the student to read the lesson goal.' },
      { type: 'script', text: '"Were you able to achieve today\'s lesson goal?"' },
      { type: 'instruction', text: 'Fill in and send the template below via chat box.' },
      { type: 'instruction', text: 'Practice the mispronounced words with the student.' },
      { type: 'tip', text: 'Encourage the student to take the next lesson.' },
    ],
  },
};

const normalizePracticeInstructionKr = (instructionEn: string, instructionKr: string, title = '') => {
  const en = (instructionEn || '').toLowerCase();
  const stepTitle = (title || '').toLowerCase();

  if (
    (en.includes('team directory entry') || stepTitle.includes('own profile')) &&
    (en.includes('your own information') || en.includes('fill in the blanks'))
  ) {
    return '패턴을 사용하여 자신의 팀 디렉터리 항목을 완성하세요. 문장을 읽고 자신의 정보로 빈칸을 채우세요.';
  }

  if (en.includes('fill in the blanks') && (!instructionKr || !instructionKr.includes('빈칸'))) {
    return '문장을 읽고 알맞은 표현으로 빈칸을 채우세요.';
  }

  return instructionKr || '';
};

const normalizePracticeStep = (step: Partial<PracticeStepData>, index: number): PracticeStepData => ({
  title: step.title || `Step ${index + 1}`,
  instructionEn: step.instructionEn || '',
  instructionKr: normalizePracticeInstructionKr(step.instructionEn || '', step.instructionKr || '', step.title || ''),
  content: step.content || '',
  dialogue: step.dialogue,
  wordBox: step.wordBox,
  tutorNotes: Array.isArray(step.tutorNotes) ? step.tutorNotes : [],
});

// ============================================================================
// PAGE NAV CONFIG — matches 7-page PDF structure
// ============================================================================

const PCPP_PAGES = [
  { key: 'page1', num: '1', label: 'Introduce + Present' },
  { key: 'page2', num: '2', label: 'Understand + Vocab' },
  { key: 'page3', num: '3', label: 'Practice 1-2' },
  { key: 'page4', num: '4', label: 'Practice 3-4' },
  { key: 'page5', num: '5', label: 'Challenge' },
  { key: 'page6', num: '6', label: 'Discussion' },
  { key: 'page7', num: '7', label: 'Feedback' },
] as const;

const AUTOSAVE_DELAY_MS = 10000;

const LEVEL_BADGES: Record<number, string> = {
  3: 'BEGINNER', 4: 'HIGH BEGINNER', 5: 'HIGH BEGINNER',
  6: 'INTERMEDIATE', 7: 'INTERMEDIATE',
  8: 'HIGH INTERMEDIATE', 9: 'HIGH INTERMEDIATE',
  10: 'ADVANCED',
};

// ============================================================================
// RICH TEXT INPUT — contentEditable with Ctrl+B/I/U formatting
// ============================================================================

interface BERichTextInputProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  singleLine?: boolean;
  compact?: boolean;
  style?: Record<string, any>;
}

interface BlockWrapperProps {
  blockId: string;
  label: string;
  icon: string;
  hidden: boolean;
  onToggle: (blockId: string, hide: boolean, btnEl?: HTMLElement | null) => void;
  children: any;
}

function BERichTextInput({ value, onChange, placeholder, className = '', singleLine = true, compact = false, style }: BERichTextInputProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasFocus, setHasFocus] = useState(false);

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold', false);
      if (ref.current) onChange(ref.current.innerHTML);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic', false);
      if (ref.current) onChange(ref.current.innerHTML);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      document.execCommand('underline', false);
      if (ref.current) onChange(ref.current.innerHTML);
    }
    if (singleLine && e.key === 'Enter') e.preventDefault();
  };

  const handleInput = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
  };

  // Normalize \n → <br> so line breaks render properly in contentEditable
  const normalizedValue = (value || '').replace(/\n/g, '<br>');

  useEffect(() => {
    if (ref.current && !hasFocus && ref.current.innerHTML !== normalizedValue) {
      ref.current.innerHTML = normalizedValue;
    }
  }, [normalizedValue, hasFocus]);

  useEffect(() => {
    if (ref.current && !ref.current.innerHTML) {
      ref.current.innerHTML = normalizedValue;
    }
  }, []);

  const showPlaceholder = !value && !hasFocus;

  return (
    <div className={`beve-rich-wrap ${compact ? 'beve-rich-compact' : ''} ${className}`}>
      <div
        ref={ref}
        className={`beve-rich-input ${showPlaceholder ? 'beve-rich-placeholder' : ''}`}
        contentEditable
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        data-placeholder={placeholder}
        spellcheck={false}
        style={style}
      />
      {!compact && (
        <div className="beve-rich-hint">
          <kbd>Ctrl</kbd>+<kbd>B</kbd> bold · <kbd>Ctrl</kbd>+<kbd>I</kbd> italic · <kbd>Ctrl</kbd>+<kbd>U</kbd> underline
        </div>
      )}
    </div>
  );
}

function BlockWrapper({ blockId, label, icon, hidden, onToggle, children }: BlockWrapperProps) {
  if (hidden) {
    return (
      <button
        className="beve-block-add-btn"
        data-block-id={blockId}
        onClick={(e) => onToggle(blockId, false, e.currentTarget as HTMLElement)}
      >
        <i className={icon} /> Add {label}
      </button>
    );
  }

  return (
    <div className="beve-block-wrapper" data-block-id={blockId}>
      <button
        className="beve-block-remove-btn"
        onClick={(e) => onToggle(blockId, true, e.currentTarget as HTMLElement)}
        title={`Remove ${label}`}
      >
        <i className="ri-delete-bin-line" />
      </button>
      {children}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BusinessEnglishVisualEditor() {
  const { params } = useRoute();
  const id = params?.id;

  const [lesson, setLesson] = useState<LessonMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'pending' | 'saved'>('idle');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUnsavedChangesRef = useRef(false);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('beve-theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; }
  });
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('beve-theme', next); } catch {}
  };

  const [activePage, setActivePage] = useState<string>('page1');
  const [chapterName, setChapterName] = useState('');
  const [lessonName, setLessonName] = useState('');
  const [goalTextEn, setGoalTextEn] = useState('');
  const [goalTextJp, setGoalTextJp] = useState('');
  const [beData, setBeData] = useState<BELessonData>(DEFAULT_BE_DATA);
  const [draggedTutorNote, setDraggedTutorNote] = useState<TutorNoteDragState | null>(null);
  const [dragOverTutorNoteKey, setDragOverTutorNoteKey] = useState<string | null>(null);

  // Refs for scroll-to navigation
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const page1IntroStudentRef = useRef<HTMLDivElement | null>(null);
  const [page1IntroTutorMaxHeight, setPage1IntroTutorMaxHeight] = useState<number | null>(null);
  const latestSavePayloadRef = useRef({
    lesson: null as LessonMaterial | null,
    chapterName: '',
    lessonName: '',
    goalTextEn: '',
    goalTextJp: '',
    beData: DEFAULT_BE_DATA as BELessonData,
  });

  useEffect(() => {
    latestSavePayloadRef.current = {
      lesson,
      chapterName,
      lessonName,
      goalTextEn,
      goalTextJp,
      beData,
    };
  }, [lesson, chapterName, lessonName, goalTextEn, goalTextJp, beData]);

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
  }, [beData.introduce, lessonName, chapterName, theme]);

  // ---- Load ----
  useEffect(() => { if (id) loadLesson(id); }, [id]);

  const loadLesson = async (lessonId: string) => {
    try {
      setLoading(true);
      const data = await getLessonById(lessonId);
      setLesson(data);
      setChapterName(data.chapterName || '');
      setLessonName(data.lessonName || '');
      setGoalTextEn(data.goalTextEn || '');
      setGoalTextJp(data.goalTextJp || '');
      const skillType = (data.skill?.toUpperCase() || 'READING') as LessonType;
      const merged: any = { ...DEFAULT_BE_DATA, lessonType: skillType, ...(data.beData || {}) };
      const sourceChallengeRoleplayTable = data.beData?.challenge?.roleplayTable;

      // Deep-normalize nested sections so UI can safely call .map() on arrays
      merged.present = { ...DEFAULT_BE_DATA.present, ...(merged.present || {}) };
      merged.present.patterns = merged.present.patterns || DEFAULT_BE_DATA.present.patterns;
      merged.present.vocabulary = merged.present.vocabulary || DEFAULT_BE_DATA.present.vocabulary;
      merged.present.pronunciation = { ...DEFAULT_BE_DATA.present.pronunciation, ...(merged.present.pronunciation || {}) };

      merged.understand = { ...DEFAULT_BE_DATA.understand, ...(merged.understand || {}) };
      merged.understand.fillRows = merged.understand.fillRows || DEFAULT_BE_DATA.understand.fillRows;
      merged.understand.patternDrills = (merged.understand.patternDrills || DEFAULT_BE_DATA.understand.patternDrills).map((drill: any) => {
        const examples = Array.isArray(drill.examples) ? [...drill.examples] : [];
        while (examples.length < 5) examples.push({ en: '', kr: '' });
        return { ...drill, examples };
      });
      merged.understand.activityBlocks = merged.understand.activityBlocks || DEFAULT_BE_DATA.understand.activityBlocks;
      merged.understand.tutorNotes = normalizeUnderstandTutorNotes(merged.understand.tutorNotes || DEFAULT_BE_DATA.understand.tutorNotes);

      merged.practice = { ...DEFAULT_BE_DATA.practice, ...(merged.practice || {}) };
      merged.practice.steps = (merged.practice.steps || DEFAULT_BE_DATA.practice.steps).map((step: any, index: number) =>
        normalizePracticeStep(step, index)
      );
      merged.practice.activityBlocks = merged.practice.activityBlocks || DEFAULT_BE_DATA.practice.activityBlocks;

      merged.challenge = { ...DEFAULT_BE_DATA.challenge, ...(merged.challenge || {}) };
      const normalizedChallengeNotes = normalizeChallengeTutorNotes(
        merged.challenge.tutorNotes || DEFAULT_BE_DATA.challenge.tutorNotes,
        merged.challenge.guideQuestions || DEFAULT_BE_DATA.challenge.guideQuestions,
      );
      merged.challenge.tutorNotes = normalizedChallengeNotes;
      merged.challenge.guideQuestions = [];
      merged.challenge.activityBlocks = merged.challenge.activityBlocks || DEFAULT_BE_DATA.challenge.activityBlocks;
      merged.challenge.roleplayTable =
        sourceChallengeRoleplayTable !== undefined
          ? sourceChallengeRoleplayTable
          : (skillType === 'READING' ? undefined : DEFAULT_BE_DATA.challenge.roleplayTable);

      merged.discussion = { ...DEFAULT_BE_DATA.discussion, ...(merged.discussion || {}) };
      merged.discussion.categories = merged.discussion.categories || DEFAULT_BE_DATA.discussion.categories;
      merged.discussion.activityBlocks = merged.discussion.activityBlocks || DEFAULT_BE_DATA.discussion.activityBlocks;

      merged.feedback = { ...DEFAULT_BE_DATA.feedback, ...(merged.feedback || {}) };

      setBeData(merged);
    } catch (e: any) {
      setError(e?.message || 'Failed to load lesson');
    } finally {
      setLoading(false);
    }
  };

  // ---- Scroll spy — update sidebar active page on scroll ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleScroll = () => {
      const keys = PCPP_PAGES.map(p => p.key);
      for (let i = keys.length - 1; i >= 0; i--) {
        const el = pageRefs.current[keys[i]];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200) { setActivePage(keys[i]); break; }
        }
      }
    };
    canvas.addEventListener('scroll', handleScroll, { passive: true });
    return () => canvas.removeEventListener('scroll', handleScroll);
  }, [loading]);

  const scrollToPage = (key: string) => {
    const el = pageRefs.current[key];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ---- Autosave ----
  const saveAll = useCallback(async () => {
    const current = latestSavePayloadRef.current;

    if (!current.lesson) {
      setAutosaveStatus('idle');
      return;
    }

    setSaving(true);
    try {
      await updateLessonHeader(current.lesson.id, {
        chapterName: current.chapterName,
        lessonName: current.lessonName,
        goalTextEn: current.goalTextEn,
        goalTextJp: current.goalTextJp,
        beData: current.beData as any,
      });
      hasUnsavedChangesRef.current = false;
      setAutosaveStatus('saved');
      setTimeout(() => setAutosaveStatus('idle'), 3000);
    } catch {
      setAutosaveStatus('idle');
      toast.error('Failed to save');
    }
    finally { setSaving(false); }
  }, []);

  const triggerAutosave = useCallback(() => {
    hasUnsavedChangesRef.current = true;
    setAutosaveStatus('pending');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      if (hasUnsavedChangesRef.current) {
        saveAll();
      }
    }, AUTOSAVE_DELAY_MS);
  }, [saveAll]);

  const handleManualSave = () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    saveAll();
  };

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  const handleOpenPreview = () => {
    if (!lesson) return;
    sessionStorage.setItem(`business-english-preview-${lesson.id}`, JSON.stringify({
      chapterName,
      lessonName,
      goalTextEn,
      goalTextJp,
      theme,
      beData,
    }));
    window.open(`/business-english-preview/${lesson.id}`, '_blank');
  };

  // ---- Generic updaters ----
  type BEObjectSections = { [K in keyof BELessonData]-?: BELessonData[K] extends object ? K : never }[keyof BELessonData];
  const updateSection = <K extends BEObjectSections>(section: K, updates: Partial<BELessonData[K]>) => {
    setBeData(prev => {
      const nextSection: any = { ...(prev[section] as any), ...(updates as any) };

      if (section === 'challenge') {
        const normalizedTutorNotes = normalizeChallengeTutorNotes(
          Array.isArray(nextSection.tutorNotes) ? nextSection.tutorNotes : [],
          Array.isArray(nextSection.guideQuestions) ? nextSection.guideQuestions : [],
        );
        nextSection.tutorNotes = normalizedTutorNotes;
        nextSection.guideQuestions = [];
      }

      return { ...prev, [section]: nextSection };
    });
    triggerAutosave();
  };

  const updateTutorNotes = (section: BEObjectSections, notes: TutorNote[]) => {
    updateSection(section, { tutorNotes: notes } as any);
  };

  const addTutorNote = (
    section: BEObjectSections,
    type: TutorNote['type'] = 'instruction',
    group?: UnderstandTutorGroup,
  ) => {
    const current = (beData[section] as any).tutorNotes || [];
    updateTutorNotes(section, [...current, { type, text: '', ...(group ? { group } : {}) }]);
  };

  const removeTutorNote = (section: BEObjectSections, idx: number) => {
    const current = [...(beData[section] as any).tutorNotes];
    current.splice(idx, 1);
    updateTutorNotes(section, current);
  };

  const updateTutorNote = (section: BEObjectSections, idx: number, updates: Partial<TutorNote>) => {
    const current = [...(beData[section] as any).tutorNotes];
    current[idx] = { ...current[idx], ...updates };
    updateTutorNotes(section, current);
  };

  const addChallengeQuestionNote = () => {
    const current = [...(beData.challenge.tutorNotes || [])];
    const lastQuestionIndex = current.reduce((lastIndex, note, index) => (
      normalizeTutorNoteType(note?.type) === 'question' ? index : lastIndex
    ), -1);
    const insertIndex = lastQuestionIndex >= 0 ? lastQuestionIndex + 1 : current.length;
    current.splice(insertIndex, 0, { type: 'question', text: '' });
    updateTutorNotes('challenge', current);
  };

  const reorderItems = <T,>(items: T[], fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return items;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    if (typeof moved === 'undefined') return items;
    next.splice(toIndex, 0, moved);
    return next;
  };

  const moveTutorNoteInSection = (section: BEObjectSections, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const current = [...((beData[section] as any).tutorNotes || [])];
    updateTutorNotes(section, reorderItems(current, fromIndex, toIndex));
  };

  const movePracticeTutorNote = (stepIndex: number, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const steps = [...beData.practice.steps];
    const noteList = [...(steps[stepIndex]?.tutorNotes || [])];
    steps[stepIndex] = { ...steps[stepIndex], tutorNotes: reorderItems(noteList, fromIndex, toIndex) };
    updateSection('practice', { steps });
  };

  const moveTutorNoteInSectionByOffset = (
    section: BEObjectSections,
    fromIndex: number,
    targetIndex: number | null | undefined,
  ) => {
    if (targetIndex === null || typeof targetIndex === 'undefined') return;
    moveTutorNoteInSection(section, fromIndex, targetIndex);
  };

  const movePracticeTutorNoteByOffset = (
    stepIndex: number,
    fromIndex: number,
    targetIndex: number | null | undefined,
  ) => {
    if (targetIndex === null || typeof targetIndex === 'undefined') return;
    movePracticeTutorNote(stepIndex, fromIndex, targetIndex);
  };

  const clearTutorDragState = () => {
    setDraggedTutorNote(null);
    setDragOverTutorNoteKey(null);
  };

  const getSectionTutorNoteKey = (section: string, index: number, group?: string) =>
    `section:${section}:${group || 'all'}:${index}`;

  const getPracticeTutorNoteKey = (stepIndex: number, index: number) =>
    `practice:${stepIndex}:${index}`;

  // ---- Loading / Error UI ----
  if (loading) return (
    <div className="beve-loading"><i className="ri-loader-4-line" /><span>Loading lesson\u2026</span></div>
  );
  if (error || !lesson) return (
    <div className="beve-error">
      <i className="ri-error-warning-line" /><span>{error || 'Lesson not found'}</span>
      <button onClick={() => window.location.href = '/business-english-editor'}>Back to Editor</button>
    </div>
  );

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  const renderTutorNotes = (section: BEObjectSections, group?: UnderstandTutorGroup) => {
    const rawNotes: TutorNote[] = (beData[section] as any).tutorNotes || [];
    const notes = section === 'understand' ? normalizeUnderstandTutorNotes(rawNotes) : rawNotes;
    const noteEntries = notes
      .map((note, index) => ({ note, index }))
      .filter(({ note }) => !group || (note.group || 'comprehension') === group);
    return (
      <>
        <div className="beve-col-tutor-title">
          <i className="ri-booklet-line" /> Teaching Notes
        </div>
        <div className="beve-tutor-notes">
          {noteEntries.map(({ note, index }, notePosition) => {
            const previousIndex = notePosition > 0 ? noteEntries[notePosition - 1].index : null;
            const nextIndex = notePosition < noteEntries.length - 1 ? noteEntries[notePosition + 1].index : null;
            return (
              <div
                key={index}
                className={`beve-tutor-note ${note.type}${dragOverTutorNoteKey === getSectionTutorNoteKey(section, index, group) ? ' drag-over' : ''}`}
                onDragOver={(e) => {
                  if (!draggedTutorNote || draggedTutorNote.kind !== 'section') return;
                  if (draggedTutorNote.section !== section || (draggedTutorNote.group || '') !== (group || '')) return;
                  e.preventDefault();
                  if (dragOverTutorNoteKey !== getSectionTutorNoteKey(section, index, group)) {
                    setDragOverTutorNoteKey(getSectionTutorNoteKey(section, index, group));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!draggedTutorNote || draggedTutorNote.kind !== 'section') return;
                  if (draggedTutorNote.section !== section || (draggedTutorNote.group || '') !== (group || '')) return;
                  moveTutorNoteInSection(section, draggedTutorNote.index, index);
                  clearTutorDragState();
                }}
              >
                <div className="beve-tutor-note-type">
                  <span
                    className="beve-tutor-note-drag"
                    draggable
                    title="Drag to reorder"
                    onDragStart={(e) => {
                      const dataTransfer = e.dataTransfer;
                      if (!dataTransfer) return;
                      dataTransfer.effectAllowed = 'move';
                      dataTransfer.setData('text/plain', getSectionTutorNoteKey(section, index, group));
                      setDraggedTutorNote({ kind: 'section', section, index, group });
                      setDragOverTutorNoteKey(getSectionTutorNoteKey(section, index, group));
                    }}
                    onDragEnd={clearTutorDragState}
                  >
                    <i className="ri-draggable" />
                  </span>
                  <i className={TUTOR_NOTE_ICONS[note.type] || 'ri-file-text-line'} /> {note.type}
                </div>
                <BERichTextInput
                  value={note.text}
                  compact
                  onChange={(html) => updateTutorNote(section, index, { text: html, ...(note.group ? { group: note.group } : {}) })}
                  placeholder="Type note…"
                />
                <div className="beve-tutor-note-actions">
                  <button
                    className="beve-icon-btn"
                    title="Move up"
                    disabled={previousIndex === null}
                    onClick={() => moveTutorNoteInSectionByOffset(section, index, previousIndex)}
                  >
                    <i className="ri-arrow-up-line" />
                  </button>
                  <button
                    className="beve-icon-btn"
                    title="Move down"
                    disabled={nextIndex === null}
                    onClick={() => moveTutorNoteInSectionByOffset(section, index, nextIndex)}
                  >
                    <i className="ri-arrow-down-line" />
                  </button>
                  <button className="beve-icon-btn danger" title="Delete note" onClick={() => removeTutorNote(section, index)}>
                    <i className="ri-delete-bin-line" /></button>
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="beve-tutor-add-note" onClick={() => addTutorNote(section, 'instruction', group)}>
              <i className="ri-add-line" /> Instruction</button>
            <button className="beve-tutor-add-note" onClick={() => addTutorNote(section, 'script', group)}>
              <i className="ri-add-line" /> Script</button>
            <button className="beve-tutor-add-note" onClick={() => addTutorNote(section, 'tip', group)}>
              <i className="ri-add-line" /> Tip</button>
          </div>
        </div>
      </>
    );
  };

  const renderChallengeStandardTutorNote = (
    note: TutorNote,
    index: number,
    previousIndex?: number | null,
    nextIndex?: number | null,
  ) => (
    <div
      key={index}
      className={`beve-tutor-note ${note.type}${dragOverTutorNoteKey === getSectionTutorNoteKey('challenge', index) ? ' drag-over' : ''}`}
      onDragOver={(e) => {
        if (!draggedTutorNote || draggedTutorNote.kind !== 'section' || draggedTutorNote.section !== 'challenge') return;
        e.preventDefault();
        if (dragOverTutorNoteKey !== getSectionTutorNoteKey('challenge', index)) {
          setDragOverTutorNoteKey(getSectionTutorNoteKey('challenge', index));
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (!draggedTutorNote || draggedTutorNote.kind !== 'section' || draggedTutorNote.section !== 'challenge') return;
        moveTutorNoteInSection('challenge', draggedTutorNote.index, index);
        clearTutorDragState();
      }}
    >
      <div className="beve-tutor-note-type">
        <span
          className="beve-tutor-note-drag"
          draggable
          title="Drag to reorder"
          onDragStart={(e) => {
            const dataTransfer = e.dataTransfer;
            if (!dataTransfer) return;
            dataTransfer.effectAllowed = 'move';
            dataTransfer.setData('text/plain', getSectionTutorNoteKey('challenge', index));
            setDraggedTutorNote({ kind: 'section', section: 'challenge', index });
            setDragOverTutorNoteKey(getSectionTutorNoteKey('challenge', index));
          }}
          onDragEnd={clearTutorDragState}
        >
          <i className="ri-draggable" />
        </span>
        <i className={TUTOR_NOTE_ICONS[note.type] || 'ri-file-text-line'} /> {note.type}
      </div>
      <BERichTextInput
        value={note.text}
        compact
        onChange={(html) => updateTutorNote('challenge', index, { text: html })}
        placeholder="Note text"
      />
      <div className="beve-tutor-note-actions">
        <button
          className="beve-icon-btn"
          title="Move up"
          disabled={previousIndex === null || typeof previousIndex === 'undefined'}
          onClick={() => moveTutorNoteInSectionByOffset('challenge', index, previousIndex)}
        >
          <i className="ri-arrow-up-line" />
        </button>
        <button
          className="beve-icon-btn"
          title="Move down"
          disabled={nextIndex === null || typeof nextIndex === 'undefined'}
          onClick={() => moveTutorNoteInSectionByOffset('challenge', index, nextIndex)}
        >
          <i className="ri-arrow-down-line" />
        </button>
        <button className="beve-icon-btn danger" title="Delete note" onClick={() => removeTutorNote('challenge', index)}>
          <i className="ri-delete-bin-line" />
        </button>
      </div>
    </div>
  );

  const renderPageHeader = (pageNum: number) => (
    <div className="beve-page-header">
      {/* Row 1: Brand + Level/Page */}
      <div className="beve-header-row1">
        <div className="beve-header-brand">
          <span className="beve-header-brand-text"><span className="brand-fluent">Fluent</span><span className="brand-x">X</span><span className="brand-verse">Verse</span></span>
          <span className="beve-header-brand-sub">Business English</span>
        </div>
        <div className="beve-header-meta">
          <span className="beve-header-level">Level <strong>{lesson.level}</strong></span>
          <span className="beve-header-meta-divider">|</span>
          <span className="beve-header-page">Page <strong>{pageNum}</strong></span>
        </div>
      </div>
      {/* Row 2: Chapter + Lesson Type */}
      <div className="beve-header-row2">
        <span className="beve-header-chapter">Chapter {lesson.chapter} / {chapterName || 'Untitled'}</span>
        <div className="beve-header-row2-right">
          <select className="beve-lesson-type-select" aria-label="Lesson skill" value={beData.lessonType}
            onChange={(e) => { setBeData(prev => ({ ...prev, lessonType: (e.target as HTMLSelectElement).value as LessonType })); triggerAutosave(); }}>
            <option value="READING">Reading</option>
            <option value="SPEAKING">Speaking</option>
            <option value="LISTENING">Listening</option>
            <option value="WRITING">Writing</option>
            <option value="REVIEW">Review</option>
          </select>
        </div>
      </div>
      {/* Row 3: Lesson name */}
      <div className="beve-header-row3">
        <h2 className="beve-header-lesson">
          <span className="beve-header-lesson-number">Lesson {lesson.lessonNumber}</span>{' '}
          <span className="beve-header-lesson-title">{lessonName || 'Untitled'}</span>
        </h2>
      </div>
    </div>
  );

  const renderHintBox = () => (
    <div className="beve-hint-box">
      <div className="beve-hint-label">Key Expressions</div>
      <div className="beve-hint-patterns">
        {(beData.present.patterns || []).map((p, i) => (
          <div key={i} className="beve-hint-pattern">
            <span className="beve-hint-en" dangerouslySetInnerHTML={{ __html: p.en }} />
            <span className="beve-hint-kr" dangerouslySetInnerHTML={{ __html: `(${p.kr})` }} />
          </div>
        ))}
      </div>
    </div>
  );

  // Helper: render a practice step
  const renderPracticeStep = (si: number) => {
    const step = beData.practice.steps[si];
    if (!step) return null;
    return (
      <div key={si} className="beve-step-card">
        <div className="beve-step-header">
          <span className="step-num">{si + 1}</span>
          <BERichTextInput className="step-title-text" value={step.title}
            onChange={(html) => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], title: html }; updateSection('practice', { steps }); }}
            placeholder="Step title" />
        </div>
        <div className="beve-step-body">
          <div className="beve-step-instruction">
            <BERichTextInput value={step.instructionEn}
              onChange={(html) => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], instructionEn: html }; updateSection('practice', { steps }); }}
              placeholder="Instruction (English)" />
            <BERichTextInput className="beve-step-instruction-kr" value={step.instructionKr} compact
              onChange={(html) => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], instructionKr: html }; updateSection('practice', { steps }); }}
              placeholder="지시 (한국어)" />
          </div>
          <BERichTextInput value={step.content} singleLine={false}
            onChange={(html) => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], content: html }; updateSection('practice', { steps }); }}
            placeholder="Step content…" style={{ minHeight: 40, fontSize: 14, lineHeight: 1.7 }} />

          {step.dialogue && step.dialogue.length > 0 && (
            <div className="beve-dialogue" style={{ marginTop: 12 }}>
              {step.dialogue.map((line, li) => (
                <div key={li} className={`beve-dialogue-line ${line.role}`}>
                  <span className="beve-dialogue-role">{line.role === 'tutor' ? 'Tutor:' : 'Student:'}</span>
                  <div style={{ flex: 1 }}>
                    <BERichTextInput className="beve-dialogue-text" value={line.en}
                      onChange={(html) => { const steps = [...beData.practice.steps]; const dlg = [...(steps[si].dialogue || [])]; dlg[li] = { ...dlg[li], en: html }; steps[si] = { ...steps[si], dialogue: dlg }; updateSection('practice', { steps }); }}
                      placeholder="English dialogue…" />
                    <BERichTextInput className="beve-dialogue-text-kr" value={line.kr}
                      onChange={(html) => { const steps = [...beData.practice.steps]; const dlg = [...(steps[si].dialogue || [])]; dlg[li] = { ...dlg[li], kr: html }; steps[si] = { ...steps[si], dialogue: dlg }; updateSection('practice', { steps }); }}
                      placeholder="한국어 번역…" />
                  </div>
                </div>
              ))}
              <button className="beve-add-btn" style={{ marginTop: 6 }} onClick={() => {
                const steps = [...beData.practice.steps];
                const dlg = [...(steps[si].dialogue || []), { role: 'student' as const, en: '', kr: '' }];
                steps[si] = { ...steps[si], dialogue: dlg };
                updateSection('practice', { steps });
              }}><i className="ri-add-line" /> Add Line</button>
            </div>
          )}

          {/* Word Box */}
          {step.wordBox && step.wordBox.length > 0 && (
            <div className="beve-word-box" style={{ marginTop: 12 }}>
              <div className="beve-word-box-label"><i className="ri-price-tag-3-line" /> Word Box</div>
              <div className="beve-word-box-items">
                {step.wordBox.map((wb, wi) => (
                  <div key={wi} className="beve-word-box-item">
                    <span className="beve-editable" contentEditable
                      onBlur={(e) => { const steps = [...beData.practice.steps]; const box = [...(steps[si].wordBox || [])]; box[wi] = { ...box[wi], word: (e.target as HTMLElement).innerText }; steps[si] = { ...steps[si], wordBox: box }; updateSection('practice', { steps }); }}
                      dangerouslySetInnerHTML={{ __html: wb.word }} />
                    {wb.translation && (
                      <span className="beve-word-box-trans">({wb.translation})</span>
                    )}
                    <button className="beve-icon-btn danger" style={{ width: 16, height: 16, fontSize: 9, flexShrink: 0 }}
                      onClick={() => { const steps = [...beData.practice.steps]; const box = (steps[si].wordBox || []).filter((_, idx) => idx !== wi); steps[si] = { ...steps[si], wordBox: box }; updateSection('practice', { steps }); }}>
                      <i className="ri-close-line" /></button>
                  </div>
                ))}
              </div>
              <button className="beve-add-btn" style={{ marginTop: 6 }}
                onClick={() => { const steps = [...beData.practice.steps]; const box = [...(steps[si].wordBox || []), { word: '', translation: '' }]; steps[si] = { ...steps[si], wordBox: box }; updateSection('practice', { steps }); }}>
                <i className="ri-add-line" /> Add Word</button>
            </div>
          )}
          {!step.wordBox || step.wordBox.length === 0 ? (
            <button className="beve-add-btn" style={{ marginTop: 8, opacity: .6 }}
              onClick={() => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], wordBox: [{ word: '', translation: '' }] }; updateSection('practice', { steps }); }}>
              <i className="ri-price-tag-3-line" /> Add Word Box</button>
          ) : null}
        </div>
      </div>
    );
  };

  // Helper: render practice step tutor notes as a standalone section panel
  const renderPracticeStepNotes = (si: number) => {
    const step = beData.practice.steps[si];
    if (!step) return (
      <div className="beve-col-tutor-title"><i className="ri-booklet-line" /> Teaching Notes</div>
    );
    return (
      <>
        <div className="beve-col-tutor-title"><i className="ri-booklet-line" /> Teaching Notes</div>
        <div className="beve-practice-note-panel-title">{step.title}</div>
        <div className="beve-tutor-notes">
          {(step.tutorNotes || []).map((note, ni) => {
            const previousIndex = ni > 0 ? ni - 1 : null;
            const nextIndex = ni < step.tutorNotes.length - 1 ? ni + 1 : null;
            return (
              <div
                key={ni}
                className={`beve-tutor-note ${note.type}${dragOverTutorNoteKey === getPracticeTutorNoteKey(si, ni) ? ' drag-over' : ''}`}
                onDragOver={(e) => {
                  if (!draggedTutorNote || draggedTutorNote.kind !== 'practice' || draggedTutorNote.stepIndex !== si) return;
                  e.preventDefault();
                  if (dragOverTutorNoteKey !== getPracticeTutorNoteKey(si, ni)) {
                    setDragOverTutorNoteKey(getPracticeTutorNoteKey(si, ni));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!draggedTutorNote || draggedTutorNote.kind !== 'practice' || draggedTutorNote.stepIndex !== si) return;
                  movePracticeTutorNote(si, draggedTutorNote.index, ni);
                  clearTutorDragState();
                }}
              >
                <div className="beve-tutor-note-type">
                  <span
                    className="beve-tutor-note-drag"
                    draggable
                    title="Drag to reorder"
                    onDragStart={(e) => {
                      const dataTransfer = e.dataTransfer;
                      if (!dataTransfer) return;
                      dataTransfer.effectAllowed = 'move';
                      dataTransfer.setData('text/plain', getPracticeTutorNoteKey(si, ni));
                      setDraggedTutorNote({ kind: 'practice', stepIndex: si, index: ni });
                      setDragOverTutorNoteKey(getPracticeTutorNoteKey(si, ni));
                    }}
                    onDragEnd={clearTutorDragState}
                  >
                    <i className="ri-draggable" />
                  </span>
                  <i className={TUTOR_NOTE_ICONS[note.type] || 'ri-file-text-line'} /> {note.type}
                </div>
                <BERichTextInput value={note.text}
                  compact
                  onChange={(html) => { const steps = [...beData.practice.steps]; const notes = [...steps[si].tutorNotes]; notes[ni] = { ...notes[ni], text: html }; steps[si] = { ...steps[si], tutorNotes: notes }; updateSection('practice', { steps }); }}
                  placeholder="Type note…" />
                <div className="beve-tutor-note-actions">
                  <button
                    className="beve-icon-btn"
                    title="Move up"
                    disabled={previousIndex === null}
                    onClick={() => movePracticeTutorNoteByOffset(si, ni, previousIndex)}
                  >
                    <i className="ri-arrow-up-line" />
                  </button>
                  <button
                    className="beve-icon-btn"
                    title="Move down"
                    disabled={nextIndex === null}
                    onClick={() => movePracticeTutorNoteByOffset(si, ni, nextIndex)}
                  >
                    <i className="ri-arrow-down-line" />
                  </button>
                  <button className="beve-icon-btn danger" title="Delete note" onClick={() => { const steps = [...beData.practice.steps]; const notes = steps[si].tutorNotes.filter((_, idx) => idx !== ni); steps[si] = { ...steps[si], tutorNotes: notes }; updateSection('practice', { steps }); }}>
                    <i className="ri-delete-bin-line" /></button>
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="beve-tutor-add-note"
              onClick={() => {
                const steps = [...beData.practice.steps];
                steps[si] = { ...steps[si], tutorNotes: [...steps[si].tutorNotes, { type: 'instruction', text: '' }] };
                updateSection('practice', { steps });
              }}
            >
              <i className="ri-add-line" /> Instruction
            </button>
            <button
              className="beve-tutor-add-note"
              onClick={() => {
                const steps = [...beData.practice.steps];
                steps[si] = { ...steps[si], tutorNotes: [...steps[si].tutorNotes, { type: 'script', text: '' }] };
                updateSection('practice', { steps });
              }}
            >
              <i className="ri-add-line" /> Script
            </button>
            <button
              className="beve-tutor-add-note"
              onClick={() => {
                const steps = [...beData.practice.steps];
                steps[si] = { ...steps[si], tutorNotes: [...steps[si].tutorNotes, { type: 'tip', text: '' }] };
                updateSection('practice', { steps });
              }}
            >
              <i className="ri-add-line" /> Tip
            </button>
          </div>
        </div>
      </>
    );
  };

  // ========================================================================
  // MODULAR BLOCK WRAPPER — togglable add/remove for content blocks
  // ========================================================================
  const isBlockHidden = (blockId: string) => (beData.hiddenBlocks || []).includes(blockId);

  const toggleBlock = (blockId: string, hide: boolean, btnEl?: HTMLElement | null) => {
    // Capture position of the clicked button relative to viewport
    const scrollContainer = canvasRef.current;
    let savedOffset: number | null = null;
    if (btnEl && scrollContainer) {
      savedOffset = btnEl.getBoundingClientRect().top;
    }

    const current = beData.hiddenBlocks || [];
    const updated = hide
      ? [...current, blockId]
      : current.filter(id => id !== blockId);
    setBeData(prev => ({ ...prev, hiddenBlocks: updated }));
    triggerAutosave();

    // After React re-renders, restore scroll so the element stays in place
    if (savedOffset !== null && scrollContainer) {
      requestAnimationFrame(() => {
        const el = scrollContainer.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
        if (el) {
          const newTop = el.getBoundingClientRect().top;
          scrollContainer.scrollTop += newTop - savedOffset!;
        }
      });
    }
  };

  // ========================================================================
  // ACTIVITY BLOCKS — renderers, factory, and add-block dropdown
  // ========================================================================
  const [activityDropdownPage, setActivityDropdownPage] = useState<string | null>(null);

  const generateId = () => `ab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const createActivityBlock = (type: ActivityBlockType): ActivityBlock => {
    const id = generateId();
    const meta = ACTIVITY_BLOCK_META[type];
    switch (type) {
      case 'matching': return { type, id, title: meta.label, titleKr: meta.labelKr, pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }] };
      case 'multipleChoice': return { type, id, title: meta.label, titleKr: meta.labelKr, items: [{ question: '', questionKr: '', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }] }] };
      case 'sentenceReorder': return { type, id, title: meta.label, titleKr: meta.labelKr, items: [{ jumbled: '', answer: '' }] };
      case 'errorCorrection': return { type, id, title: meta.label, titleKr: meta.labelKr, items: [{ sentence: '', corrected: '', hint: '' }] };
      case 'dialogueCompletion': return { type, id, title: meta.label, titleKr: meta.labelKr, slots: [{ role: 'tutor', text: '', isBlank: false }, { role: 'student', text: '', isBlank: true }, { role: 'tutor', text: '', isBlank: false }] };
      case 'trueFalse': return { type, id, title: meta.label, titleKr: meta.labelKr, items: [{ statement: '', statementKr: '', answer: true }] };
      case 'readingPassage': return { type, id, title: meta.label, titleKr: meta.labelKr, passage: '', questions: [{ question: '', questionKr: '' }] };
      case 'categorization': return { type, id, title: meta.label, titleKr: meta.labelKr, categories: [{ name: 'Category A', items: [''] }, { name: 'Category B', items: [''] }] };
      case 'image': return { type, id, title: meta.label, titleKr: meta.labelKr, images: [] };
    }
  };

  type SectionWithBlocks = 'understand' | 'practice' | 'challenge' | 'discussion';

  const addActivityBlock = (section: SectionWithBlocks, type: ActivityBlockType) => {
    const block = createActivityBlock(type);
    setBeData(prev => {
      const sec = prev[section] as any;
      return { ...prev, [section]: { ...sec, activityBlocks: [...(sec.activityBlocks || []), block] } };
    });
    triggerAutosave();
    setActivityDropdownPage(null);
  };

  const removeActivityBlock = (section: SectionWithBlocks, blockId: string) => {
    setBeData(prev => {
      const sec = prev[section] as any;
      return { ...prev, [section]: { ...sec, activityBlocks: (sec.activityBlocks || []).filter((b: ActivityBlock) => b.id !== blockId) } };
    });
    triggerAutosave();
  };

  const updateActivityBlock = (section: SectionWithBlocks, blockId: string, updates: Partial<ActivityBlock>) => {
    setBeData(prev => {
      const sec = prev[section] as any;
      const blocks = (sec.activityBlocks || []).map((b: ActivityBlock) => b.id === blockId ? { ...b, ...updates } : b);
      return { ...prev, [section]: { ...sec, activityBlocks: blocks } };
    });
    triggerAutosave();
  };

  // ─── Individual Activity Block Renderers ───
  const renderMatchingBlock = (block: MatchingBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-matching">
      <div className="beve-activity-header">
        <i className="ri-links-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      <table className="beve-matching-table"><thead><tr><th>Left</th><th>Right</th><th style={{ width: 30 }} /></tr></thead><tbody>
        {(block.pairs || []).map((p, i) => (
          <tr key={i}>
            <td><BERichTextInput value={p.left} onChange={(html) => { const pairs = [...block.pairs]; pairs[i] = { ...pairs[i], left: html }; updateActivityBlock(section, block.id, { pairs } as any); }} placeholder="Item" singleLine /></td>
            <td><BERichTextInput value={p.right} onChange={(html) => { const pairs = [...block.pairs]; pairs[i] = { ...pairs[i], right: html }; updateActivityBlock(section, block.id, { pairs } as any); }} placeholder="Match" singleLine /></td>
            <td><button className="beve-icon-btn danger" onClick={() => { updateActivityBlock(section, block.id, { pairs: block.pairs.filter((_, idx) => idx !== i) } as any); }}><i className="ri-delete-bin-line" /></button></td>
          </tr>
        ))}
      </tbody></table>
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { pairs: [...(block.pairs || []), { left: '', right: '' }] } as any)}><i className="ri-add-line" /> Add Pair</button>
    </div>
  );

  const renderMultipleChoiceBlock = (block: MultipleChoiceBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-mcq">
      <div className="beve-activity-header">
        <i className="ri-checkbox-circle-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      {(block.items || []).map((item, qi) => (
        <div key={qi} className="beve-mcq-item">
          <div className="beve-mcq-question">
            <span className="beve-mcq-num">{qi + 1}.</span>
            <BERichTextInput value={item.question} onChange={(html) => { const items = [...block.items]; items[qi] = { ...items[qi], question: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="Question" singleLine />
          </div>
          <div className="beve-mcq-options">
            {(item.options || []).map((opt, oi) => (
              <div key={oi} className={`beve-mcq-option${opt.isCorrect ? ' correct' : ''}`}>
                  <button className="beve-mcq-radio" onClick={() => { const items = [...block.items]; items[qi] = { ...items[qi], options: ((items[qi].options) || []).map((o, idx) => ({ ...o, isCorrect: idx === oi })) }; updateActivityBlock(section, block.id, { items } as any); }}>
                  <i className={opt.isCorrect ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
                </button>
                <BERichTextInput value={opt.text} onChange={(html) => { const items = [...block.items]; const options = [...((items[qi].options) || [])]; options[oi] = { ...options[oi], text: html }; items[qi] = { ...items[qi], options }; updateActivityBlock(section, block.id, { items } as any); }} placeholder={`Option ${String.fromCharCode(65 + oi)}`} singleLine />
                <button className="beve-icon-btn danger" style={{ width: 18, height: 18, fontSize: 10 }} onClick={() => { const items = [...block.items]; items[qi] = { ...items[qi], options: items[qi].options.filter((_, idx) => idx !== oi) }; updateActivityBlock(section, block.id, { items } as any); }}><i className="ri-close-line" /></button>
              </div>
            ))}
            <button className="beve-add-btn" style={{ fontSize: 11 }} onClick={() => { const items = [...block.items]; items[qi] = { ...items[qi], options: [...((items[qi].options) || []), { text: '', isCorrect: false }] }; updateActivityBlock(section, block.id, { items } as any); }}><i className="ri-add-line" /> Add Option</button>
          </div>
          <button className="beve-icon-btn danger" style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => { updateActivityBlock(section, block.id, { items: block.items.filter((_, idx) => idx !== qi) } as any); }}><i className="ri-delete-bin-line" /></button>
        </div>
      ))}
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { items: [...block.items, { question: '', questionKr: '', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }] }] } as any)}><i className="ri-add-line" /> Add Question</button>
    </div>
  );

  const renderSentenceReorderBlock = (block: SentenceReorderBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-reorder">
      <div className="beve-activity-header">
        <i className="ri-sort-asc" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      {(block.items || []).map((item, i) => (
        <div key={i} className="beve-reorder-item">
          <div className="beve-reorder-row"><span className="beve-reorder-label">Jumbled:</span><BERichTextInput value={item.jumbled} onChange={(html) => { const items = [...block.items]; items[i] = { ...items[i], jumbled: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="the / is / weather / today / nice" singleLine /></div>
          <div className="beve-reorder-row"><span className="beve-reorder-label">Answer:</span><BERichTextInput value={item.answer} onChange={(html) => { const items = [...block.items]; items[i] = { ...items[i], answer: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="The weather is nice today" singleLine /></div>
          <button className="beve-icon-btn danger" style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => { updateActivityBlock(section, block.id, { items: block.items.filter((_, idx) => idx !== i) } as any); }}><i className="ri-delete-bin-line" /></button>
        </div>
      ))}
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { items: [...block.items, { jumbled: '', answer: '' }] } as any)}><i className="ri-add-line" /> Add Sentence</button>
    </div>
  );

  const renderErrorCorrectionBlock = (block: ErrorCorrectionBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-error">
      <div className="beve-activity-header">
        <i className="ri-eraser-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      {(block.items || []).map((item, i) => (
        <div key={i} className="beve-error-item">
          <div className="beve-error-row"><span className="beve-error-label">\u2717</span><BERichTextInput value={item.sentence} onChange={(html) => { const items = [...block.items]; items[i] = { ...items[i], sentence: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="Sentence with error" singleLine /></div>
          <div className="beve-error-row"><span className="beve-error-label">\u2713</span><BERichTextInput value={item.corrected} onChange={(html) => { const items = [...block.items]; items[i] = { ...items[i], corrected: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="Corrected sentence" singleLine /></div>
          <div className="beve-error-row"><span className="beve-error-label">?</span><BERichTextInput value={item.hint} onChange={(html) => { const items = [...block.items]; items[i] = { ...items[i], hint: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="Hint (optional)" singleLine /></div>
          <button className="beve-icon-btn danger" style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => { updateActivityBlock(section, block.id, { items: block.items.filter((_, idx) => idx !== i) } as any); }}><i className="ri-delete-bin-line" /></button>
        </div>
      ))}
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { items: [...block.items, { sentence: '', corrected: '', hint: '' }] } as any)}><i className="ri-add-line" /> Add Item</button>
    </div>
  );

  const renderDialogueCompletionBlock = (block: DialogueCompletionBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-dialogue">
      <div className="beve-activity-header">
        <i className="ri-chat-3-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      {(block.slots || []).map((slot, i) => (
        <div key={i} className={`beve-dialogue-slot ${slot.role}${slot.isBlank ? ' blank' : ''}`}>
          <div className="beve-dialogue-slot-header">
            <select className="beve-dialogue-role-select" value={slot.role} onChange={(e) => { const slots = [...block.slots]; slots[i] = { ...slots[i], role: (e.target as HTMLSelectElement).value as 'tutor' | 'student' }; updateActivityBlock(section, block.id, { slots } as any); }}>
              <option value="tutor">Tutor</option><option value="student">Student</option>
            </select>
            <button className={`beve-dialogue-blank-toggle${slot.isBlank ? ' active' : ''}`} onClick={() => { const slots = [...block.slots]; slots[i] = { ...slots[i], isBlank: !slots[i].isBlank }; updateActivityBlock(section, block.id, { slots } as any); }}><i className="ri-question-line" /> {slot.isBlank ? 'Blank' : 'Given'}</button>
            <button className="beve-icon-btn danger" style={{ width: 18, height: 18, fontSize: 10 }} onClick={() => { updateActivityBlock(section, block.id, { slots: block.slots.filter((_, idx) => idx !== i) } as any); }}><i className="ri-close-line" /></button>
          </div>
          <BERichTextInput value={slot.text} onChange={(html) => { const slots = [...block.slots]; slots[i] = { ...slots[i], text: html }; updateActivityBlock(section, block.id, { slots } as any); }} placeholder={slot.isBlank ? 'Answer (hidden from student)' : 'Dialogue line'} />
        </div>
      ))}
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { slots: [...(block.slots || []), { role: 'student', text: '', isBlank: true }] } as any)}><i className="ri-add-line" /> Add Line</button>
    </div>
  );

  const renderTrueFalseBlock = (block: TrueFalseBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-tf">
      <div className="beve-activity-header">
        <i className="ri-checkbox-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      {(block.items || []).map((item, i) => (
        <div key={i} className="beve-tf-item">
          <div className="beve-tf-statement">
            <span className="beve-tf-num">{i + 1}.</span>
            <BERichTextInput value={item.statement} onChange={(html) => { const items = [...block.items]; items[i] = { ...items[i], statement: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="Statement" singleLine />
          </div>
          <div className="beve-tf-answer">
            <button className={`beve-tf-btn${item.answer ? ' active' : ''}`} onClick={() => { const items = [...block.items]; items[i] = { ...items[i], answer: true }; updateActivityBlock(section, block.id, { items } as any); }}>True</button>
            <button className={`beve-tf-btn${!item.answer ? ' active' : ''}`} onClick={() => { const items = [...block.items]; items[i] = { ...items[i], answer: false }; updateActivityBlock(section, block.id, { items } as any); }}>False</button>
            <button className="beve-icon-btn danger" style={{ marginLeft: 'auto' }} onClick={() => { updateActivityBlock(section, block.id, { items: block.items.filter((_, idx) => idx !== i) } as any); }}><i className="ri-delete-bin-line" /></button>
          </div>
        </div>
      ))}
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { items: [...block.items, { statement: '', statementKr: '', answer: true }] } as any)}><i className="ri-add-line" /> Add Statement</button>
    </div>
  );

  const renderReadingPassageBlock = (block: ReadingPassageBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-reading">
      <div className="beve-activity-header">
        <i className="ri-article-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      <div className="beve-reading-passage">
        <BERichTextInput value={block.passage} onChange={(html) => updateActivityBlock(section, block.id, { passage: html } as any)} placeholder="Paste or type the reading passage here (email, memo, article, etc.)" />
      </div>
      <div className="beve-reading-questions">
        {(block.questions || []).map((q, i) => (
          <div key={i} className="beve-reading-q">
            <span className="beve-reading-q-num">{i + 1}.</span>
            <BERichTextInput value={q.question} onChange={(html) => { const questions = [...block.questions]; questions[i] = { ...questions[i], question: html }; updateActivityBlock(section, block.id, { questions } as any); }} placeholder="Comprehension question" singleLine />
            <button className="beve-icon-btn danger" style={{ width: 18, height: 18, fontSize: 10 }} onClick={() => { updateActivityBlock(section, block.id, { questions: block.questions.filter((_, idx) => idx !== i) } as any); }}><i className="ri-close-line" /></button>
          </div>
        ))}
        <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { questions: [...block.questions, { question: '', questionKr: '' }] } as any)}><i className="ri-add-line" /> Add Question</button>
      </div>
    </div>
  );

  const renderCategorizationBlock = (block: CategorizationBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-categorize">
      <div className="beve-activity-header">
        <i className="ri-layout-grid-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      <div className="beve-categorize-grid" style={{ gridTemplateColumns: `repeat(${(block.categories || []).length}, 1fr)` }}>
        {(block.categories || []).map((cat, ci) => (
          <div key={ci} className="beve-categorize-col">
            <div className="beve-categorize-col-header">
              <BERichTextInput value={cat.name} onChange={(html) => { const categories = [...block.categories]; categories[ci] = { ...categories[ci], name: html }; updateActivityBlock(section, block.id, { categories } as any); }} placeholder="Category" singleLine />
              <button className="beve-icon-btn danger" style={{ width: 18, height: 18, fontSize: 10 }} onClick={() => { updateActivityBlock(section, block.id, { categories: block.categories.filter((_, idx) => idx !== ci) } as any); }}><i className="ri-close-line" /></button>
            </div>
            {(cat.items || []).map((item, ii) => (
              <div key={ii} className="beve-categorize-item">
                <BERichTextInput value={item} onChange={(html) => { const categories = [...block.categories]; const items = [...categories[ci].items]; items[ii] = html; categories[ci] = { ...categories[ci], items }; updateActivityBlock(section, block.id, { categories } as any); }} placeholder="Item" singleLine />
                <button className="beve-icon-btn danger" style={{ width: 16, height: 16, fontSize: 9 }} onClick={() => { const categories = [...block.categories]; categories[ci] = { ...categories[ci], items: categories[ci].items.filter((_, idx) => idx !== ii) }; updateActivityBlock(section, block.id, { categories } as any); }}><i className="ri-close-line" /></button>
              </div>
            ))}
            <button className="beve-add-btn" style={{ fontSize: 11 }} onClick={() => { const categories = [...block.categories]; categories[ci] = { ...categories[ci], items: [...categories[ci].items, ''] }; updateActivityBlock(section, block.id, { categories } as any); }}><i className="ri-add-line" /> Add Item</button>
          </div>
        ))}
      </div>
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { categories: [...block.categories, { name: '', items: [''] }] } as any)}><i className="ri-add-line" /> Add Category</button>
    </div>
  );

  const handleImageUpload = (section: SectionWithBlocks, blockId: string, existingImages: ImageItem[]) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        if (existingImages.length >= 4) return; // max 4
        updateActivityBlock(section, blockId, { images: [...existingImages, { src, label: '' }] } as any);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const renderImageBlock = (block: ImageBlock, section: SectionWithBlocks) => {
    const count = block.images.length;
    const layoutClass = count === 1 ? 'single' : count === 2 ? 'double' : count === 3 ? 'triple' : 'quad';
    return (
      <div className="beve-activity-block beve-activity-image">
        <div className="beve-activity-header">
          <i className="ri-image-line" />
          <BERichTextInput className="beve-activity-title" value={block.title}
            onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
          <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
        </div>
        {count > 0 ? (
          <div className={`beve-img-grid beve-img-${layoutClass}`}>
            {(block.images || []).map((img, i) => (
              <div key={i} className="beve-img-cell">
                <div className="beve-img-square">
                  <img src={img.src} alt={img.label || `Image ${i + 1}`} />
                  <button className="beve-img-remove" onClick={() => {
                    updateActivityBlock(section, block.id, { images: block.images.filter((_, idx) => idx !== i) } as any);
                  }}><i className="ri-close-circle-fill" /></button>
                </div>
                <BERichTextInput className="beve-img-label" value={img.label}
                  onChange={(html) => { const images = [...block.images]; images[i] = { ...images[i], label: html }; updateActivityBlock(section, block.id, { images } as any); }}
                  placeholder="Label (optional)" singleLine />
              </div>
            ))}
          </div>
        ) : null}
        {count < 4 && (
          <button className="beve-add-btn beve-img-add-btn" onClick={() => handleImageUpload(section, block.id, (block.images || []))}>
            <i className="ri-image-add-line" /> Add Image {count > 0 ? `(${count}/4)` : ''}
          </button>
        )}
      </div>
    );
  };

  // ─── Dispatcher ───
  const renderActivityBlock = (block: ActivityBlock, section: SectionWithBlocks) => {
    switch (block.type) {
      case 'matching': return renderMatchingBlock(block, section);
      case 'multipleChoice': return renderMultipleChoiceBlock(block, section);
      case 'sentenceReorder': return renderSentenceReorderBlock(block, section);
      case 'errorCorrection': return renderErrorCorrectionBlock(block, section);
      case 'dialogueCompletion': return renderDialogueCompletionBlock(block, section);
      case 'trueFalse': return renderTrueFalseBlock(block, section);
      case 'readingPassage': return renderReadingPassageBlock(block, section);
      case 'categorization': return renderCategorizationBlock(block, section);
      case 'image': return renderImageBlock(block, section);
    }
  };

  // ─── Render all activity blocks for a section + add dropdown ───
  const renderActivityBlocksArea = (section: SectionWithBlocks) => {
    const blocks = (beData[section] as any).activityBlocks || [];
    const dropdownId = `add-${section}`;
    return (
      <div className="beve-activity-blocks-area">
        {blocks.map((block: ActivityBlock) => (
          <div key={block.id}>{renderActivityBlock(block, section)}</div>
        ))}
        <div className="beve-add-activity-wrap">
          <button className="beve-add-activity-btn" onClick={() => setActivityDropdownPage(activityDropdownPage === dropdownId ? null : dropdownId)}>
            <i className="ri-add-circle-line" /> Add Activity Block
          </button>
          {activityDropdownPage === dropdownId && (
            <div className="beve-add-activity-dropdown">
              {(Object.keys(ACTIVITY_BLOCK_META) as ActivityBlockType[]).map(type => {
                const meta = ACTIVITY_BLOCK_META[type];
                return (
                  <button key={type} className="beve-add-activity-option" onClick={() => addActivityBlock(section, type)}>
                    <i className={meta.icon} /> {meta.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ========================================================================
  // SECTION BANNER — chevron step indicator (inspired by PCPP nav design)
  // ========================================================================
  const SECTION_STEPS = [
    { num: 1, short: 'Warm-Up' },
    { num: 2, short: 'Key Expr.' },
    { num: 3, short: 'Compreh.' },
    { num: 4, short: 'Drill' },
    { num: 5, short: 'Simul.' },
    { num: 6, short: 'Wrap-Up' },
  ];

  const renderSectionBanner = (activeNum: number, title: string) => (
    <div className="beve-section-banner">
      <div className="beve-section-banner-left">
        <span className="beve-section-banner-title">{title}</span>
      </div>
      <div className="beve-chevron-bar">
        {SECTION_STEPS.map((step, i) => (
          <div
            key={step.num}
            className={`beve-chevron${step.num === activeNum ? ' active' : ''}${step.num < activeNum ? ' completed' : ''}`}
          >
            {i > 0 && <span className="beve-chevron-connector" />}
            <span className="beve-chevron-num">{step.num}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ========================================================================
  // PAGE FOOTER — shown on every page
  // ========================================================================

  const renderPageFooter = () => (
    <div className="beve-page-footer">
      <div className="beve-footer-content">
        <div className="beve-footer-left">
          <span className="beve-page-footer-brand"><span className="brand-fluent">Fluent</span><span className="brand-x">X</span><span className="brand-verse">Verse</span></span>
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

  // ========================================================================
  // 7 PAGE RENDERERS — matching PDF structure
  // ========================================================================

  /** PAGE 1: ① Introduce (Goal + Situation) + ② Present (Key Expressions) */
  const renderPage1 = () => (
    <div className="beve-page" id="beve-page1" ref={(el) => { pageRefs.current['page1'] = el; }}>
      {renderPageHeader(1)}
      <div className="beve-page-sections">
        <div className="beve-page-section">
          <div className="beve-col-student" ref={page1IntroStudentRef}>
            {/* ① Introduce */}
            {renderSectionBanner(1, 'WARM-UP')}
            <div className="beve-goal-box">
              <div className="beve-goal-label">Lesson Goal</div>
              <BERichTextInput className="beve-goal-en" value={beData.introduce.goalEn}
                onChange={(html) => updateSection('introduce', { goalEn: html })} placeholder="Goal (English)" />
              <BERichTextInput className="beve-goal-kr" value={beData.introduce.goalKr} compact
                onChange={(html) => updateSection('introduce', { goalKr: html })} placeholder="목표 (한국어)" />
            </div>
            <div className="beve-situation-box">
              <div className="beve-situation-label"><i className="ri-briefcase-line" /> Situation and Task</div>
              <BERichTextInput className="beve-situation-en" value={beData.introduce.situationEn} singleLine={false}
                onChange={(html) => updateSection('introduce', { situationEn: html })} placeholder="Situation (English)" />
              <BERichTextInput className="beve-situation-kr" value={beData.introduce.situationKr} singleLine={false} compact
                onChange={(html) => updateSection('introduce', { situationKr: html })} placeholder="상황 (한국어)" />
            </div>
          </div>
          <div
            className="beve-col-tutor"
            style={page1IntroTutorMaxHeight ? { maxHeight: `${page1IntroTutorMaxHeight}px` } : undefined}
          >
            {renderTutorNotes('introduce')}
          </div>
        </div>

        <div className="beve-page-section">
          <div className="beve-col-student">
            {/* ② Present — Key Expressions */}
            {renderSectionBanner(2, 'KEY EXPRESSIONS')}
            <div className="beve-sub-heading">Key Expressions <span className="kr-label">{'핵심 표현'}</span></div>
            <div className="beve-patterns-grid">
              {beData.present.patterns.map((p, i) => (
                <div key={i} className="beve-pattern-card">
                <BERichTextInput className="beve-pattern-en" value={p.en}
                    onChange={(html) => { const updated = [...beData.present.patterns]; updated[i] = { ...updated[i], en: html }; updateSection('present', { patterns: updated }); }}
                    placeholder="Pattern (English)" />
                  <BERichTextInput className="beve-pattern-kr" value={p.kr} compact
                    onChange={(html) => { const updated = [...beData.present.patterns]; updated[i] = { ...updated[i], kr: html }; updateSection('present', { patterns: updated }); }}
                    placeholder="패턴 (한국어)" />
                  <div className="beve-pattern-actions">
                    <button className="beve-icon-btn danger" onClick={() => { updateSection('present', { patterns: beData.present.patterns.filter((_, idx) => idx !== i) }); }}>
                      <i className="ri-delete-bin-line" /></button>
                  </div>
                </div>
              ))}
              <button className="beve-add-btn" onClick={() => { updateSection('present', { patterns: [...beData.present.patterns, { en: '', kr: '' }] }); }}>
                <i className="ri-add-line" /> Add Pattern</button>
            </div>
          </div>
          <div className="beve-col-tutor">
            {renderTutorNotes('present')}
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  /** PAGE 2: ③ Understand + Word Bank + Sound Practice + Activity */
  const renderPage2 = () => (
    <div className="beve-page" id="beve-page2" ref={(el) => { pageRefs.current['page2'] = el; }}>
      {renderPageHeader(2)}
      <div className="beve-page-sections">
        <div className="beve-page-section">
          <div className="beve-col-student">
            {renderSectionBanner(3, 'COMPREHENSION')}
            <BlockWrapper blockId="comprehensionIntro" label="Comprehension Intro" icon="ri-question-line" hidden={isBlockHidden('comprehensionIntro')} onToggle={toggleBlock}>
              <div className="beve-situation-box">
                <BERichTextInput className="beve-situation-en" value={beData.understand.instruction} singleLine={false}
                  onChange={(html) => updateSection('understand', { instruction: html })} placeholder="Comprehension instruction (English)" />
                <BERichTextInput className="beve-situation-kr" value={beData.understand.instructionKr} singleLine={false} compact
                  onChange={(html) => updateSection('understand', { instructionKr: html })} placeholder="지시 (한국어)" />
              </div>
            </BlockWrapper>

            <BlockWrapper blockId="patternDrills" label="Pattern Drills" icon="ri-table-line" hidden={isBlockHidden('patternDrills')} onToggle={toggleBlock}>
              {beData.understand.patternDrills.length > 0 && (
                <div className="beve-pattern-drills">
                  {beData.understand.patternDrills.map((drill, di) => (
                    <div key={di} className="beve-drill-card">
                      <div className="beve-drill-header">
                        <BERichTextInput className="beve-drill-label" value={drill.label}
                          onChange={(html) => { const drills = [...beData.understand.patternDrills]; drills[di] = { ...drills[di], label: html }; updateSection('understand', { patternDrills: drills }); }}
                          placeholder="Pattern usage description" singleLine />
                        <BERichTextInput className="beve-drill-label-kr" value={drill.labelKr}
                          onChange={(html) => { const drills = [...beData.understand.patternDrills]; drills[di] = { ...drills[di], labelKr: html }; updateSection('understand', { patternDrills: drills }); }}
                          placeholder="설명 (한국어)" singleLine />
                        <button className="beve-icon-btn danger" style={{ position: 'absolute', top: 6, right: 6 }}
                          onClick={() => { updateSection('understand', { patternDrills: beData.understand.patternDrills.filter((_, idx) => idx !== di) }); }}>
                          <i className="ri-delete-bin-line" /></button>
                      </div>
                      <div className="beve-drill-template">
                        <BERichTextInput value={drill.template}
                          onChange={(html) => { const drills = [...beData.understand.patternDrills]; drills[di] = { ...drills[di], template: html }; updateSection('understand', { patternDrills: drills }); }}
                          placeholder="Pattern template (e.g. Welcome to the _____)" singleLine />
                      </div>
                      <table className="beve-drill-table">
                        <tbody>
                          {drill.examples.map((ex, ei) => (
                            <tr key={ei}>
                              <td><BERichTextInput value={ex.en}
                                onChange={(html) => { const drills = [...beData.understand.patternDrills]; const examples = [...drills[di].examples]; examples[ei] = { ...examples[ei], en: html }; drills[di] = { ...drills[di], examples }; updateSection('understand', { patternDrills: drills }); }}
                                placeholder="Example (English)" singleLine /></td>
                              <td><BERichTextInput value={ex.kr}
                                onChange={(html) => { const drills = [...beData.understand.patternDrills]; const examples = [...drills[di].examples]; examples[ei] = { ...examples[ei], kr: html }; drills[di] = { ...drills[di], examples }; updateSection('understand', { patternDrills: drills }); }}
                                placeholder="예문 (한국어)" singleLine /></td>
                              <td style={{ width: 30 }}><button className="beve-icon-btn danger"
                                onClick={() => { const drills = [...beData.understand.patternDrills]; drills[di] = { ...drills[di], examples: drills[di].examples.filter((_, idx) => idx !== ei) }; updateSection('understand', { patternDrills: drills }); }}>
                                <i className="ri-delete-bin-line" /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button className="beve-add-btn" style={{ marginTop: 6 }}
                        onClick={() => { const drills = [...beData.understand.patternDrills]; drills[di] = { ...drills[di], examples: [...drills[di].examples, { en: '', kr: '' }] }; updateSection('understand', { patternDrills: drills }); }}>
                        <i className="ri-add-line" /> Add Example</button>
                    </div>
                  ))}
                </div>
              )}
              <button className="beve-add-btn" style={{ marginBottom: 8 }}
                onClick={() => {
                  updateSection('understand', {
                    patternDrills: [
                      ...beData.understand.patternDrills,
                      { label: '', labelKr: '', template: '', examples: Array.from({ length: 5 }, () => ({ en: '', kr: '' })) },
                    ],
                  });
                }}>
                <i className="ri-add-line" /> Add Pattern Drill</button>
            </BlockWrapper>
          </div>
          <div className="beve-col-tutor">
            {renderTutorNotes('understand', 'comprehension')}
          </div>
        </div>

        <div className="beve-page-section">
          <div className="beve-col-student">
            <BlockWrapper blockId="vocabulary" label="Word Bank" icon="ri-book-2-line" hidden={isBlockHidden('vocabulary')} onToggle={toggleBlock}>
              <div className="beve-sub-heading" style={{ marginTop: 0 }}>Word Bank <span className="kr-label">{'단어장'}</span></div>
              <table className="beve-vocab-table">
                <thead><tr><th>Word</th><th>Part of Speech</th><th>Translation</th><th>Definition</th><th style={{ width: 40 }} /></tr></thead>
                <tbody>
                  {beData.present.vocabulary.map((v, i) => (
                    <tr key={i}>
                      <td><BERichTextInput className="beve-vocab-word" value={v.word}
                        onChange={(html) => { const u = [...beData.present.vocabulary]; u[i] = { ...u[i], word: html }; updateSection('present', { vocabulary: u }); }}
                        placeholder="Word" /></td>
                      <td><BERichTextInput className="beve-vocab-pos" value={v.pos}
                        onChange={(html) => { const u = [...beData.present.vocabulary]; u[i] = { ...u[i], pos: html }; updateSection('present', { vocabulary: u }); }}
                        placeholder="POS" /></td>
                      <td><BERichTextInput className="beve-vocab-translation" value={v.translation}
                        onChange={(html) => { const u = [...beData.present.vocabulary]; u[i] = { ...u[i], translation: html }; updateSection('present', { vocabulary: u }); }}
                        placeholder="번역" /></td>
                      <td><BERichTextInput value={v.definition || ''}
                        onChange={(html) => { const u = [...beData.present.vocabulary]; u[i] = { ...u[i], definition: html }; updateSection('present', { vocabulary: u }); }}
                        placeholder="Definition" /></td>
                      <td><button className="beve-icon-btn danger" onClick={() => { updateSection('present', { vocabulary: beData.present.vocabulary.filter((_, idx) => idx !== i) }); }}>
                        <i className="ri-delete-bin-line" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="beve-add-btn" onClick={() => { updateSection('present', { vocabulary: [...beData.present.vocabulary, { word: '', pos: '', translation: '', definition: '' }] }); }}>
                <i className="ri-add-line" /> Add Vocabulary</button>
            </BlockWrapper>
          </div>
          <div className="beve-col-tutor">
            {renderTutorNotes('understand', 'wordBank')}
          </div>
        </div>

        <div className="beve-page-section">
          <div className="beve-col-student">
            <BlockWrapper blockId="soundPractice" label="Sound Practice" icon="ri-volume-up-line" hidden={isBlockHidden('soundPractice')} onToggle={toggleBlock}>
              <div className="beve-sub-heading" style={{ marginTop: 0 }}>Sound Practice <span className="kr-label">{beData.present.pronunciation.instructionKr}</span></div>
              <div className="beve-pronun-box">
                <BERichTextInput className="beve-pronun-title" value={beData.present.pronunciation.instruction}
                  onChange={(html) => { updateSection('present', { pronunciation: { ...beData.present.pronunciation, instruction: html } }); }}
                  placeholder="Pronunciation instruction" />
                <div className="beve-pronun-columns">
                  {(['left', 'right'] as const).map(side => {
                    const col = beData.present.pronunciation[side];
                    return (
                      <div key={side} className="beve-pronun-col">
                        <div className="beve-pronun-symbol beve-editable" contentEditable
                          onBlur={(e) => { updateSection('present', { pronunciation: { ...beData.present.pronunciation, [side]: { ...col, symbol: (e.target as HTMLElement).innerText } } }); }}
                          dangerouslySetInnerHTML={{ __html: col.symbol }} />
                        <div className="beve-pronun-words">
                          {col.words.map((w, i) => (
                            <div key={i} className="beve-pronun-word">
                              <span className="beve-editable" contentEditable
                                onBlur={(e) => { const words = [...col.words]; words[i] = { ...words[i], en: (e.target as HTMLElement).innerText }; updateSection('present', { pronunciation: { ...beData.present.pronunciation, [side]: { ...col, words } } }); }}
                                dangerouslySetInnerHTML={{ __html: w.en }} />
                              <span style={{ color: '#71717a', fontSize: 12 }}>
                                <span className="beve-editable" contentEditable
                                  onBlur={(e) => { const words = [...col.words]; words[i] = { ...words[i], kr: (e.target as HTMLElement).innerText }; updateSection('present', { pronunciation: { ...beData.present.pronunciation, [side]: { ...col, words } } }); }}
                                  dangerouslySetInnerHTML={{ __html: w.kr }} />
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </BlockWrapper>
          </div>
          <div className="beve-col-tutor">
            {renderTutorNotes('understand', 'soundPractice')}
          </div>
        </div>

        <div className="beve-page-section">
          <div className="beve-col-student">
            {renderActivityBlocksArea('understand')}
          </div>
          <div className="beve-col-tutor">
            {renderTutorNotes('understand', 'activityBlocks')}
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  // Compute which step indices go on Page 3 vs Page 4
  const totalSteps = beData.practice.steps.length;
  const page3StepIndices = Array.from({ length: Math.ceil(totalSteps / 2) }, (_, i) => i);
  const page4StepIndices = Array.from({ length: totalSteps - page3StepIndices.length }, (_, i) => i + page3StepIndices.length);

  /** PAGE 3: ④ Practice Steps (first half) */
  const renderPage3 = () => (
    <div className="beve-page" id="beve-page3" ref={(el) => { pageRefs.current['page3'] = el; }}>
      {renderPageHeader(3)}
      <div className="beve-page-sections">
        {page3StepIndices.map((i, idx) => (
          <div key={i} className="beve-page-section">
            <div className="beve-col-student">
              {idx === 0 ? renderSectionBanner(4, 'DRILL') : null}
              {renderPracticeStep(i)}
            </div>
            <div className="beve-col-tutor">
              {renderPracticeStepNotes(i)}
            </div>
          </div>
        ))}
        <div className="beve-page-section beve-page-section-full">
          <div className="beve-col-student">
            {renderHintBox()}
            {renderActivityBlocksArea('practice')}
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  /** PAGE 4: ④ Practice Steps (second half) */
  const renderPage4 = () => (
    <div className="beve-page" id="beve-page4" ref={(el) => { pageRefs.current['page4'] = el; }}>
      {renderPageHeader(4)}
      <div className="beve-page-sections">
        {page4StepIndices.length > 0 ? page4StepIndices.map((i, idx) => (
          <div key={i} className="beve-page-section">
            <div className="beve-col-student">
              {idx === 0 ? renderSectionBanner(4, 'DRILL (CONTINUATION)') : null}
              {renderPracticeStep(i)}
            </div>
            <div className="beve-col-tutor">
              {renderPracticeStepNotes(i)}
            </div>
          </div>
        )) : (
          <div className="beve-page-section">
            <div className="beve-col-student">
              {renderSectionBanner(4, 'DRILL (CONTINUATION)')}
              <div style={{ fontSize: 13, color: '#71717a', padding: '16px 0', fontStyle: 'italic' }}>
                <i className="ri-information-line" style={{ marginRight: 6 }} />
                All practice steps fit on the previous page. Add more steps to populate this page.
              </div>
            </div>
            <div className="beve-col-tutor">
              <div className="beve-col-tutor-title"><i className="ri-booklet-line" /> Teaching Notes</div>
            </div>
          </div>
        )}
        <div className="beve-page-section beve-page-section-full">
          <div className="beve-col-student">
            <button className="beve-add-btn" style={{ marginTop: 12 }} onClick={() => {
              const newStep = {
                title: `Step ${totalSteps + 1}`,
                instructionEn: '', instructionKr: '',
                content: '', tutorNotes: [],
              };
              setBeData(prev => ({
                ...prev,
                practice: { ...prev.practice, steps: [...prev.practice.steps, newStep] },
              }));
              triggerAutosave();
            }}>
              <i className="ri-add-line" /> Add Practice Step
            </button>
            {renderHintBox()}
            {renderActivityBlocksArea('practice')}
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  /** PAGE 5: ⑤ Challenge (Simulation) */
  const renderPage5 = () => {
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
    <div className="beve-page" id="beve-page5" ref={(el) => { pageRefs.current['page5'] = el; }}>
      {renderPageHeader(5)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(5, 'SIMULATION')}
          <div className="beve-challenge-box">
            <div className="beve-challenge-title"><i className="ri-sword-line" /> Simulation</div>
            <BERichTextInput className="beve-challenge-scenario" value={beData.challenge.scenarioEn}
              onChange={(html) => updateSection('challenge', { scenarioEn: html })} placeholder="Simulation scenario (English)" />
            <BERichTextInput className="beve-challenge-scenario-kr" value={beData.challenge.scenarioKr}
              onChange={(html) => updateSection('challenge', { scenarioKr: html })} placeholder="시뮬레이션 시나리오 (한국어)" />
          </div>

          {beData.challenge.roleplayTable && (
            <BlockWrapper blockId="roleplayTable" label="Roleplay Table" icon="ri-group-line" hidden={isBlockHidden('roleplayTable')} onToggle={toggleBlock}>
            <div className="beve-situation-box">
              <div className="beve-situation-label">Roleplay Assignments</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>YOU</div>
                  <BERichTextInput value={beData.challenge.roleplayTable.you}
                    onChange={(html) => updateSection('challenge', { roleplayTable: { ...beData.challenge.roleplayTable!, you: html } })}
                    placeholder="Your role" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>YOUR COWORKERS</div>
                  {beData.challenge.roleplayTable.coworkers.map((name, i) => (
                    <div key={i} className="beve-editable" contentEditable style={{ fontSize: 14 }}
                      onBlur={(e) => { const coworkers = [...beData.challenge.roleplayTable!.coworkers]; coworkers[i] = (e.target as HTMLElement).innerText; updateSection('challenge', { roleplayTable: { ...beData.challenge.roleplayTable!, coworkers } }); }}
                      dangerouslySetInnerHTML={{ __html: name }} />
                  ))}
                  <button className="beve-add-btn" style={{ marginTop: 6 }} onClick={() => { updateSection('challenge', { roleplayTable: { ...beData.challenge.roleplayTable!, coworkers: [...beData.challenge.roleplayTable!.coworkers, ''] } }); }}>
                    <i className="ri-add-line" /> Add Name</button>
                </div>
              </div>
            </div>
            </BlockWrapper>
          )}
          {renderActivityBlocksArea('challenge')}
          {renderHintBox()}
        </div>
        <div className="beve-col-tutor">
          <div className="beve-col-tutor-title"><i className="ri-booklet-line" /> Teaching Notes</div>
          <div className="beve-tutor-notes">
            {challengeLeadingNotes.map(({ note, index }, notePosition) => renderChallengeStandardTutorNote(
              note,
              index,
              notePosition > 0 ? challengeLeadingNotes[notePosition - 1].index : null,
              notePosition < challengeLeadingNotes.length - 1 ? challengeLeadingNotes[notePosition + 1].index : null,
            ))}
            <div className="beve-sub-heading" style={{ borderBottom: 'none', marginBottom: 6, marginTop: challengeLeadingNotes.length > 0 ? 16 : 0 }}>
              Prompt Questions
            </div>
            <div className="beve-guide-questions">
              {challengeQuestionEntries.map(({ note, index }, questionIndex) => (
                <div key={index} className="beve-guide-q">
                  <div className="beve-guide-q-row">
                    <span className="beve-guide-q-num">{questionIndex + 1}.</span>
                    <BERichTextInput
                      value={note.text}
                      compact
                      onChange={(html) => updateTutorNote('challenge', index, { text: html })}
                      placeholder="Prompt question"
                    />
                    <div className="beve-guide-q-actions">
                      <button
                        className="beve-icon-btn"
                        title="Move up"
                        disabled={questionIndex === 0}
                        onClick={() => moveTutorNoteInSectionByOffset(
                          'challenge',
                          index,
                          questionIndex > 0 ? challengeQuestionEntries[questionIndex - 1].index : null,
                        )}
                      >
                        <i className="ri-arrow-up-line" />
                      </button>
                      <button
                        className="beve-icon-btn"
                        title="Move down"
                        disabled={questionIndex === challengeQuestionEntries.length - 1}
                        onClick={() => moveTutorNoteInSectionByOffset(
                          'challenge',
                          index,
                          questionIndex < challengeQuestionEntries.length - 1
                            ? challengeQuestionEntries[questionIndex + 1].index
                            : null,
                        )}
                      >
                        <i className="ri-arrow-down-line" />
                      </button>
                    </div>
                    <button
                      className="beve-icon-btn danger beve-guide-q-delete"
                      title="Delete question"
                      onClick={() => removeTutorNote('challenge', index)}
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  </div>
                </div>
              ))}
              <button className="beve-tutor-add-note" onClick={addChallengeQuestionNote}>
                <i className="ri-add-line" /> Add Question
              </button>
            </div>
            {challengeTrailingNotes.length > 0 && (
              <div className="beve-challenge-tail-notes">
                {challengeTrailingNotes.map(({ note, index }, notePosition) => renderChallengeStandardTutorNote(
                  note,
                  index,
                  notePosition > 0 ? challengeTrailingNotes[notePosition - 1].index : null,
                  notePosition < challengeTrailingNotes.length - 1 ? challengeTrailingNotes[notePosition + 1].index : null,
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button className="beve-tutor-add-note" onClick={() => addTutorNote('challenge', 'instruction')}><i className="ri-add-line" /> Instruction</button>
              <button className="beve-tutor-add-note" onClick={() => addTutorNote('challenge', 'script')}><i className="ri-add-line" /> Script</button>
              <button className="beve-tutor-add-note" onClick={() => addTutorNote('challenge', 'tip')}><i className="ri-add-line" /> Tip</button>
            </div>
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>
    );
  };

  /** PAGE 6: ⑤ Challenge — Discussion Questions */
  const renderPage6 = () => (
    <div className="beve-page" id="beve-page6" ref={(el) => { pageRefs.current['page6'] = el; }}>
      {renderPageHeader(6)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(5, 'SIMULATION \u2014 OPEN TALK')}
          <div className="beve-situation-box">
            <BERichTextInput className="beve-situation-en" value={beData.discussion.instructionEn}
              onChange={(html) => updateSection('discussion', { instructionEn: html })} placeholder="Discussion instruction (English)" />
            <BERichTextInput className="beve-situation-kr" value={beData.discussion.instructionKr} compact
              onChange={(html) => updateSection('discussion', { instructionKr: html })} placeholder="토론 지시 (한국어)" />
          </div>
          <div className="beve-discussion-categories">
            {beData.discussion.categories.map((cat, ci) => (
              <div key={ci} className="beve-disc-cat">
                <BERichTextInput className="beve-disc-cat-title" value={cat.title}
                  onChange={(html) => { const cats = [...beData.discussion.categories]; cats[ci] = { ...cats[ci], title: html }; updateSection('discussion', { categories: cats }); }}
                  placeholder="Category title" singleLine />
                <div className="beve-disc-questions">
                  {cat.questions.map((q, qi) => (
                    <div key={qi} className="beve-disc-q" data-num={`${qi + 1}.`}>
                      <BERichTextInput value={q}
                        onChange={(html) => { const cats = [...beData.discussion.categories]; const qs = [...cats[ci].questions]; qs[qi] = html; cats[ci] = { ...cats[ci], questions: qs }; updateSection('discussion', { categories: cats }); }}
                        placeholder="Discussion question" />
                    </div>
                  ))}
                  <button className="beve-tutor-add-note" onClick={() => { const cats = [...beData.discussion.categories]; cats[ci] = { ...cats[ci], questions: [...cats[ci].questions, ''] }; updateSection('discussion', { categories: cats }); }}>
                    <i className="ri-add-line" /> Add Q</button>
                </div>
              </div>
            ))}
          </div>
          <button className="beve-add-btn" onClick={() => { updateSection('discussion', { categories: [...beData.discussion.categories, { title: 'NEW CATEGORY', questions: [''] }] }); }}>
            <i className="ri-add-line" /> Add Category</button>
          {renderActivityBlocksArea('discussion')}
        </div>
        <div className="beve-col-tutor">
          {renderTutorNotes('discussion')}
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  /** PAGE 7: ⑥ Feedback */
  const renderPage7 = () => (
    <div className="beve-page" id="beve-page7" ref={(el) => { pageRefs.current['page7'] = el; }}>
      {renderPageHeader(7)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(6, 'WRAP-UP')}

          {/* Lesson Goal — read-only mirror from Page 1 introduce section */}
          <div className="beve-goal-box beve-readonly-ref">
            <div className="beve-goal-label"><i className="ri-bookmark-line" style={{ marginRight: 4 }} /> Lesson Goal</div>
            <div className="beve-goal-en" dangerouslySetInnerHTML={{ __html: beData.introduce.goalEn || '<em style="color:#71717a">Goal not set — edit on Page 1</em>' }} />
            <div className="beve-goal-kr" dangerouslySetInnerHTML={{ __html: beData.introduce.goalKr || '<em style="color:#71717a">목표 미설정</em>' }} />
          </div>

          {/* Key Expressions — read-only mirror from Page 1 present.patterns */}
          <div className="beve-readonly-ref beve-key-expr-ref">
            <div className="beve-goal-label"><i className="ri-key-2-line" style={{ marginRight: 4 }} /> Key Expressions</div>
            {beData.present.patterns.length > 0 ? beData.present.patterns.map((p, i) => (
              <div key={i} className="beve-key-expr-row">
                <span className="beve-key-expr-num">{i + 1}.</span>
                <div>
                  <div className="beve-key-expr-en" dangerouslySetInnerHTML={{ __html: p.en || '' }} />
                  <div className="beve-key-expr-kr" dangerouslySetInnerHTML={{ __html: p.kr || '' }} />
                </div>
              </div>
            )) : (
              <div style={{ fontSize: 13, color: '#71717a', fontStyle: 'italic', padding: '8px 0' }}>
                <i className="ri-information-line" style={{ marginRight: 4 }} />
                No key expressions yet — add patterns on Page 1
              </div>
            )}
          </div>

          <BlockWrapper blockId="feedbackTemplate" label="Tutor's Review" icon="ri-chat-check-line" hidden={isBlockHidden('feedbackTemplate')} onToggle={toggleBlock}>
          <div className="beve-sub-heading" style={{ marginTop: 0 }}><i className="ri-chat-check-line" /> Tutor's Review</div>
          <div className="beve-feedback-template">
            <BERichTextInput value={beData.feedback.feedbackTemplate}
              onChange={(html) => updateSection('feedback', { feedbackTemplate: html })}
              placeholder="Feedback template" style={{ fontFamily: "'Courier New', monospace", whiteSpace: 'pre-wrap' }} />
          </div>
          </BlockWrapper>
          <BlockWrapper blockId="nextLesson" label="Next Lesson" icon="ri-arrow-right-circle-line" hidden={isBlockHidden('nextLesson')} onToggle={toggleBlock}>
          <div className="beve-next-lesson">
            <i className="ri-arrow-right-circle-line" />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', letterSpacing: .5, textTransform: 'uppercase', marginBottom: 2 }}>Next Lesson</div>
              <div>
                <span className="beve-editable" contentEditable
                  onBlur={(e) => updateSection('feedback', { nextLessonLabel: (e.target as HTMLElement).innerText })}
                  dangerouslySetInnerHTML={{ __html: beData.feedback.nextLessonLabel }} />
                {' \u2014 '}
                <strong><span className="beve-editable" contentEditable
                  onBlur={(e) => updateSection('feedback', { nextLessonName: (e.target as HTMLElement).innerText })}
                  dangerouslySetInnerHTML={{ __html: beData.feedback.nextLessonName }} /></strong>
              </div>
            </div>
          </div>
          </BlockWrapper>
        </div>
        <div className="beve-col-tutor">
          {renderTutorNotes('feedback')}
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  // ========================================================================
  // MAIN RENDER — all 7 pages as scrollable document
  // ========================================================================

  return (
    <div className={`beve ${theme}${isBusinessA4Pilot(lesson) ? ' beve--a4' : ''}`}>
      {/* AI Content Generator Widget */}
      <BEAIContentGenerator
        level={lesson.level}
        chapter={lesson.chapter}
        lessonNumber={lesson.lessonNumber}
        lessonName={lessonName}
        goalTextEn={goalTextEn}
        goalTextJp={goalTextJp}
        chapterName={chapterName}
        currentPresentData={{
          patterns: beData.present.patterns,
          vocabulary: beData.present.vocabulary.map(v => ({ word: v.word, pos: v.pos, translation: v.translation })),
        }}
        sectionStatus={{
          introduce: !!(beData.introduce.goalEn && beData.introduce.situationEn),
          present: !!(beData.present.patterns.length > 0 && beData.present.patterns[0].en),
          understand: !!(beData.understand.fillRows.length > 0),
          practice: !!(beData.practice.steps.length > 0 && beData.practice.steps[0].instructionEn),
          challenge: !!(beData.challenge.scenarioEn),
          discussion: !!(beData.discussion.categories.length > 0 && beData.discussion.categories[0].title),
          feedback: !!(beData.feedback.goalReviewEn),
        }}
        onGenerateIntroduce={(data) => {
          updateSection('introduce', {
            goalEn: data.goalEn || beData.introduce.goalEn,
            goalKr: data.goalKr || beData.introduce.goalKr,
            situationEn: data.situationEn || '',
            situationKr: data.situationKr || '',
            taskEn: data.taskEn || '',
            taskKr: data.taskKr || '',
            tutorNotes: data.tutorNotes || beData.introduce.tutorNotes,
          });
          if (data.goalEn) setGoalTextEn(data.goalEn);
          if (data.goalKr) setGoalTextJp(data.goalKr);
        }}
        onGeneratePresent={(data) => {
          updateSection('present', {
            patterns: data.patterns || beData.present.patterns,
            vocabulary: data.vocabulary || beData.present.vocabulary,
            pronunciation: data.pronunciation || beData.present.pronunciation,
            tutorNotes: data.tutorNotes || beData.present.tutorNotes,
          });
        }}
        onGenerateUnderstand={(data) => {
          const normalizedDrills = Array.isArray(data.patternDrills || beData.understand.patternDrills)
            ? (data.patternDrills || beData.understand.patternDrills).map((drill: any) => {
                const examples = Array.isArray(drill.examples) ? [...drill.examples] : [];
                while (examples.length < 5) examples.push({ en: '', kr: '' });
                return { ...drill, examples: examples.slice(0, 5) };
              })
            : beData.understand.patternDrills;
          updateSection('understand', {
            instruction: data.instruction || '',
            instructionKr: data.instructionKr || '',
            fillRows: data.fillRows || [],
            patternDrills: normalizedDrills,
            tutorNotes: data.tutorNotes || beData.understand.tutorNotes,
          });
        }}
        onGeneratePractice={(data) => {
          setBeData(prev => ({
            ...prev,
            practice: {
              ...prev.practice,
              steps: (data.steps || []).map((s: any, i: number) => ({
                ...normalizePracticeStep({
                  title: s.title || `Step ${i + 1}`,
                  instructionEn: s.instructionEn || '',
                  instructionKr: s.instructionKr || '',
                  content: s.content || '',
                  dialogue: s.dialogue,
                  wordBox: s.wordBox,
                  tutorNotes: s.tutorNotes || [],
                }, i),
              })),
            },
          }));
          triggerAutosave();
        }}
        onGenerateChallenge={(data) => {
          const normalizedTutorNotes = normalizeChallengeTutorNotes(
            data.tutorNotes || beData.challenge.tutorNotes,
            [],
          );
          updateSection('challenge', {
            scenarioEn: data.scenarioEn || '',
            scenarioKr: data.scenarioKr || '',
            roleplayTable: data.roleplayTable,
            activityBlocks: Array.isArray(data.activityBlocks) ? data.activityBlocks : [],
            tutorNotes: normalizedTutorNotes,
          });
        }}
        onGenerateDiscussion={(data) => {
          updateSection('discussion', {
            instructionEn: data.instructionEn || '',
            instructionKr: data.instructionKr || '',
            categories: data.categories || [],
            tutorNotes: data.tutorNotes || beData.discussion.tutorNotes,
          });
        }}
        onGenerateFeedback={(data) => {
          updateSection('feedback', {
            goalReviewEn: data.goalReviewEn || goalTextEn,
            goalReviewKr: data.goalReviewKr || goalTextJp,
            feedbackTemplate: data.feedbackTemplate || beData.feedback.feedbackTemplate,
            nextLessonLabel: data.nextLessonLabel || beData.feedback.nextLessonLabel,
            nextLessonName: data.nextLessonName || beData.feedback.nextLessonName,
            tutorNotes: data.tutorNotes || beData.feedback.tutorNotes,
          });
        }}
        currentSectionData={(section: BESectionType) => beData[section]}
      />

      {/* Toolbar */}
      <div className="beve-toolbar">
        <div className="beve-toolbar-left">
          <button className="beve-back-btn" onClick={() => window.location.href = '/business-english-editor'}>
            <i className="ri-arrow-left-line" /><span>Back</span>
          </button>
          <div className="beve-toolbar-divider" />
          <div className="beve-toolbar-title">
            <span className="beve-toolbar-badge">{LEVEL_BADGES[lesson.level] || `LEVEL ${lesson.level}`}</span>
            Lesson {lesson.lessonNumber}: {lessonName || 'Untitled'}
          </div>
        </div>
        <div className="beve-toolbar-center">
          <i className="ri-edit-line" /> Business English Editor
        </div>
        <div className="beve-toolbar-right">
          <button className="beve-toolbar-btn" onClick={handleOpenPreview}>
            <i className="ri-eye-line" />
            Preview
          </button>
          <button className="beve-toolbar-btn" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            <i className={theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line'} />
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          {autosaveStatus !== 'idle' && (
            <span
              className={`beve-save-status ${autosaveStatus}`}
              title={autosaveStatus === 'pending' ? 'Autosaving changes...' : 'All changes saved'}
            >
              <i className={autosaveStatus === 'pending' ? 'ri-loader-4-line' : 'ri-check-line'} />
              {autosaveStatus === 'pending' ? 'Autosaving…' : 'All changes saved'}
            </span>
          )}
          <button className="beve-toolbar-btn" onClick={handleManualSave} disabled={saving}>
            <i className={saving ? 'ri-loader-4-line' : 'ri-save-line'} />
            {saving ? 'Saving\u2026' : 'Save'}
          </button>
        </div>
      </div>

      {/* Body: Sidebar + Canvas */}
      <div className="beve-body">
        {isBusinessA4Pilot(lesson) ? <BusinessEnglishA4Document
          sections={businessA4Sections([renderPage1(), renderPage2(), renderPage3(), renderPage4(), renderPage5(), renderPage6(), renderPage7()])}
          renderHeader={renderPageHeader}
          renderFooter={renderPageFooter}
          layout={beData.a4Layout}
          onLayoutChange={layout => {
            setBeData(previous => ({ ...previous, a4Layout: layout }));
            triggerAutosave();
          }}
        /> : <>
        {/* Page Sidebar */}
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

        {/* Canvas — all 7 pages scroll */}
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
