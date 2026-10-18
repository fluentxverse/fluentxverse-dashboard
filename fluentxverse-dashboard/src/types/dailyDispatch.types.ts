/**
 * Daily Dispatch Types
 * Types for news article-style lesson materials
 */

// ============================================================================
// STORED LESSON (Main interface for Memgraph :DispatchArticle nodes)
// ============================================================================

export interface StoredLesson {
  // Database fields
  id: string;
  createdAt: string;
  updatedAt: string;

  // Lesson metadata
  title: string;
  postedDate: string;
  category: string;
  topic: string;

  // Warm-up section
  warmUpQuestions: string[];

  // Vocabulary section (5 words)
  vocabulary: VocabularyWord[];

  // Article section (7-8 paragraphs)
  articleContent: ArticleContent;

  // Summary question
  summaryQuestion: string;

  // Discussion sections
  discussionA: Discussion;
  discussionB: Discussion;
}

// ============================================================================
// VOCABULARY
// ============================================================================

export interface VocabularyWord {
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  exampleSentence: string;
  additionalInfo: string | null;
}

// ============================================================================
// ARTICLE CONTENT
// ============================================================================

export interface ArticleContent {
  paragraphs: Paragraph[];
  source: string;
}

export interface Paragraph {
  id?: string;
  text: string;
  comprehensionQuestion?: ArticleQuestion | null;
}

export interface ArticleQuestion {
  question: string;
  answer: string;
}

// ============================================================================
// DISCUSSION
// ============================================================================

export interface Discussion {
  topic: string;
  questions: string[];
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface DispatchArticleListItem {
  id: string;
  title: string;
  topic: string;
  category: string;
  postedDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface DispatchArticleFilters {
  category?: string;
  topic?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// FORM STATE TYPES (for editor)
// ============================================================================

export interface DailyDispatchFormState {
  // Metadata
  title: string;
  postedDate: string;
  category: string;
  topic: string;

  // Warm-up
  warmUpQuestions: string[];

  // Vocabulary (5 words)
  vocabulary: VocabularyWord[];

  // Article
  articleContent: ArticleContent;

  // Summary
  summaryQuestion: string;

  // Discussions
  discussionA: Discussion;
  discussionB: Discussion;
}

// ============================================================================
// CATEGORY OPTIONS
// ============================================================================

export const DISPATCH_CATEGORIES = [
  'Science',
  'Technology',
  'Health',
  'Environment',
  'Business',
  'Culture',
  'Sports',
  'Politics',
  'Education',
  'Entertainment',
] as const;

export type DispatchCategory = typeof DISPATCH_CATEGORIES[number];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function createEmptyDispatchArticle(): DailyDispatchFormState {
  return {
    title: '',
    postedDate: new Date().toISOString().split('T')[0],
    category: 'Science',
    topic: '',
    warmUpQuestions: ['', '', ''],
    vocabulary: [
      createEmptyVocabularyWord(),
      createEmptyVocabularyWord(),
      createEmptyVocabularyWord(),
      createEmptyVocabularyWord(),
      createEmptyVocabularyWord(),
    ],
    articleContent: {
      paragraphs: [
        { id: 'p1', text: '', comprehensionQuestion: null },
        { id: 'p2', text: '', comprehensionQuestion: { question: '', answer: '' } },
        { id: 'p3', text: '', comprehensionQuestion: null },
        { id: 'p4', text: '', comprehensionQuestion: { question: '', answer: '' } },
        { id: 'p5', text: '', comprehensionQuestion: null },
        { id: 'p6', text: '', comprehensionQuestion: { question: '', answer: '' } },
        { id: 'p7', text: '', comprehensionQuestion: null },
        { id: 'p8', text: '', comprehensionQuestion: { question: '', answer: '' } },
      ],
      source: '',
    },
    summaryQuestion: 'What was the article about?',
    discussionA: {
      topic: '',
      questions: ['', '', ''],
    },
    discussionB: {
      topic: '',
      questions: ['', '', ''],
    },
  };
}

export function createEmptyVocabularyWord(): VocabularyWord {
  return {
    word: '',
    pronunciation: '',
    partOfSpeech: 'n.',
    definition: '',
    exampleSentence: '',
    additionalInfo: null,
  };
}

export function mapStoredLessonToFormState(lesson: StoredLesson): DailyDispatchFormState {
  return {
    title: lesson.title,
    postedDate: lesson.postedDate,
    category: lesson.category,
    topic: lesson.topic,
    warmUpQuestions: lesson.warmUpQuestions,
    vocabulary: lesson.vocabulary,
    articleContent: lesson.articleContent,
    summaryQuestion: lesson.summaryQuestion,
    discussionA: lesson.discussionA,
    discussionB: lesson.discussionB,
  };
}
