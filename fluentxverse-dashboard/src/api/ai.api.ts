/**
 * AI Content Generation API
 * Functions for generating lesson content with AI assistance
 */
import apiClient from './apiClient';

// ============================================================================
// TYPES
// ============================================================================

export interface IntroText {
  language: string;
  text: string;
}

export interface LessonIssue {
  title: string;
  points: string[];
}

export interface LessonGoalStep {
  instruction: string;
  script?: string | null;
  question?: string | null;
}

export interface GenerateIntroductionResponse {
  success: boolean;
  data?: {
    introTexts: IntroText[];
    lessonIssue: LessonIssue;
    lessonGoalDuration: string;
    lessonGoalSteps: LessonGoalStep[];
  };
  error?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Generate introduction content for a lesson
 */
export async function generateIntroductionContent(
  topic: string,
  skillLevel: string,
  skill: 'speaking' | 'listening' | 'reading' | 'writing',
  customPrompt?: string,
  currentContent?: any,
  baseInstructions?: string,
  level?: number,
  chapter?: number,
  lessonNumber?: number,
  generationMode?: 'new' | 'improve',
  includeLessonIssue?: boolean,
  lessonGoal?: string,
  learnType?: 'vocabulary' | 'expressions',
  stepBType?: 'speak-your-mind' | 'grammar-tip' | 'pronunciation',
  includeTranslation?: boolean,
  translationLanguage?: 'japanese' | 'korean' | 'vietnamese' | 'chinese',
  vocabularyCount?: number,
  expressionCount?: number,
  applyType?: 'speaking' | 'listening' | 'reading',
  dialogueLineCount?: number,
  generateTrivia?: boolean,
  exerciseType?: string,
  exerciseStep?: 'stepA' | 'stepB',
  exerciseItemCount?: number,
  missionType?: 'speaking' | 'discussion' | 'reading' | 'listening',
  missionQuestionCount?: number,
  isMission2?: boolean,
  storyData?: {
    enabled: boolean;
    storyTitle: string;
    characters: Array<{
      id: string;
      name: string;
      koreanName?: string;
      role: 'main' | 'supporting' | 'minor';
      description: string;
      personality?: string;
    }>;
    setting: string;
    previousSummary: string;
    currentPlotPoints: string[];
    storyNotes: string;
  },
  currentLearnData?: {
    steps?: Array<{
      id: string;
      label: string;
      items?: Array<{
        foreign: string;
        foreignLabel?: string;
        native: string;
        audio?: string;
        image?: string;
      }>;
    }>;
    stepBType?: 'speak-your-mind' | 'grammar-tip' | 'pronunciation';
    grammarTip?: {
      title?: string;
      items?: Array<{
        pattern?: string;
        explanation?: string;
        example?: string;
      }>;
    };
  },
  currentApplyData?: {
    activityType: 'speaking' | 'listening' | 'reading';
    situationText?: string;
    dialogueLines?: Array<{ speaker: string; text: string }>;
    readingText?: string;
    tutorSteps?: Array<{ instruction?: string; scripts?: Array<{ text: string }>; listeningScript?: string }>;
  }
): Promise<GenerateIntroductionResponse> {
  try {
    const response = await apiClient.post('/ai/generate-introduction', {
      topic,
      skillLevel,
      skill,
      customPrompt: customPrompt || null,
      currentContent: currentContent || null,
      baseInstructions: baseInstructions || null,
      level: level || null,
      chapter: chapter || null,
      lessonNumber: lessonNumber || null,
      generationMode: generationMode || null,
      includeLessonIssue: includeLessonIssue || false,
      lessonGoal: lessonGoal || '',
      includeTranslation: includeTranslation !== false, // Default to true
      translationLanguage: translationLanguage || 'japanese',
      vocabularyCount: vocabularyCount || null,
      expressionCount: expressionCount || null,
      ...(learnType ? { learnType } : {}),
      ...(stepBType ? { stepBType } : {}),
      ...(applyType ? { applyType } : {}),
      ...(dialogueLineCount ? { dialogueLineCount } : {}),
      ...(generateTrivia ? { generateTrivia } : {}),
      ...(exerciseType ? { exerciseType } : {}),
      ...(exerciseStep ? { exerciseStep } : {}),
      ...(exerciseItemCount ? { exerciseItemCount } : {}),
      ...(missionType ? { missionType } : {}),
      ...(missionQuestionCount ? { missionQuestionCount } : {}),
      ...(isMission2 ? { isMission2 } : {}),
      ...(storyData?.enabled ? { storyData } : {}),
      ...(currentLearnData ? { currentLearnData } : {}),
      ...(currentApplyData ? { currentApplyData } : {}),
    });
    return response.data;
  } catch (error: any) {
    console.error('Error generating introduction content:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate content',
    };
  }
}

// ============================================================================
// STORY EPISODE SUMMARY GENERATION
// ============================================================================

export interface GenerateEpisodeSummaryResponse {
  success: boolean;
  data?: {
    currentEpisodeSummary: string;
    nextEpisodeHook: string;
  };
  error?: string;
}

/**
 * Generate episode summary after Mission content is created
 * This creates continuity for the next lesson's story
 */
export async function generateEpisodeSummary(
  storyData: {
    storyTitle: string;
    characters: Array<{ name: string; role: string; description: string }>;
    setting: string;
    previousSummary: string;
    currentPlotPoints: string[];
  },
  missionContent: {
    situation: string;
    instruction: string;
    questions?: Array<{ question: string }>;
    topics?: Array<{ title: string; questions: string[] }>;
  },
  lessonTopic: string
): Promise<GenerateEpisodeSummaryResponse> {
  try {
    const response = await apiClient.post('/ai/generate-episode-summary', {
      storyData,
      missionContent,
      lessonTopic,
    });
    return response.data;
  } catch (error: any) {
    console.error('Error generating episode summary:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate episode summary',
    };
  }
}

// ============================================================================
// DISCUSSION QUESTIONS GENERATION
// ============================================================================

export interface GenerateDiscussionQuestionsResponse {
  success: boolean;
  data?: {
    questions: string[];
  };
  error?: string;
}

/**
 * Generate discussion questions based on topic, level, and count.
 */
export async function generateDiscussionQuestions(
  topic: string,
  level: number,
  questionCount: number,
  customPrompt?: string,
): Promise<GenerateDiscussionQuestionsResponse> {
  try {
    const response = await apiClient.post('/ai/generate-discussion-questions', {
      topic,
      level,
      questionCount,
      customPrompt: customPrompt || null,
    });
    return response.data;
  } catch (error: any) {
    console.error('Error generating discussion questions:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate discussion questions',
    };
  }
}

// ============================================================================
// COURSE STRUCTURE GENERATION
// ============================================================================

export interface CourseStructureChapter {
  chapter: number;
  theme: string;
  name: string;
}

export interface GenerateCourseStructureResponse {
  success: boolean;
  data?: {
    mainTopic: string;
    chapters: CourseStructureChapter[];
  };
  error?: string;
}

/**
 * Generate course structure (level topic + chapter themes/names) using AI
 */
export async function generateCourseStructure(
  level: number,
  existingTopic?: string | null,
  existingChapters?: Array<{ chapter: number; theme?: string; name?: string }> | null,
  customPrompt?: string | null
): Promise<GenerateCourseStructureResponse> {
  try {
    const response = await apiClient.post('/ai/generate-course-structure', {
      level,
      existingTopic: existingTopic || null,
      existingChapters: existingChapters || null,
      customPrompt: customPrompt || null,
    });
    return response.data;
  } catch (error: any) {
    console.error('Error generating course structure:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate course structure',
    };
  }
}

// ============================================================================
// LESSON STRUCTURE GENERATION
// ============================================================================

export interface LessonStructureItem {
  lessonNumber: number;
  lessonName: string;
  goalTextEn: string;
  goalTextJp: string;
}

export interface GenerateLessonStructureResponse {
  success: boolean;
  data?: {
    lessons: LessonStructureItem[];
  };
  error?: string;
}

/**
 * Generate lesson names and goals for a chapter using AI
 */
export async function generateLessonStructure(
  level: number,
  chapter: number,
  levelTopic: string,
  chapterTheme: string,
  chapterName: string,
  customPrompt?: string | null,
  course?: string | null
): Promise<GenerateLessonStructureResponse> {
  try {
    const response = await apiClient.post('/ai/generate-lesson-structure', {
      level,
      chapter,
      levelTopic,
      chapterTheme,
      chapterName,
      customPrompt: customPrompt || null,
      course: course || null,
    });
    return response.data;
  } catch (error: any) {
    console.error('Error generating lesson structure:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate lesson structure',
    };
  }
}

// ============================================================================
// BUSINESS ENGLISH CONTENT GENERATION
// ============================================================================

export type BESectionType = 'introduce' | 'present' | 'understand' | 'practice' | 'challenge' | 'discussion' | 'feedback';

export interface GenerateBEContentResponse {
  success: boolean;
  data?: {
    introduce?: any;
    present?: any;
    understand?: any;
    practice?: any;
    challenge?: any;
    discussion?: any;
    feedback?: any;
  };
  error?: string;
}

/**
 * Generate Business English PCPP lesson content for a specific section
 */
export async function generateBusinessEnglishContent(
  section: BESectionType,
  level: number,
  chapter: number,
  lessonNumber: number,
  lessonName: string,
  goalTextEn: string,
  goalTextJp: string,
  chapterName: string,
  customPrompt?: string | null,
  currentContent?: any | null,
  generationMode?: 'new' | 'improve' | null,
  currentPresentData?: {
    patterns?: Array<{ en: string; kr: string }>;
    vocabulary?: Array<{ word: string; pos: string; translation: string }>;
  } | null,
): Promise<GenerateBEContentResponse> {
  try {
    const response = await apiClient.post('/ai/generate-be-content', {
      section,
      level,
      chapter,
      lessonNumber,
      lessonName,
      goalTextEn: goalTextEn || '',
      goalTextJp: goalTextJp || '',
      chapterName: chapterName || '',
      customPrompt: customPrompt || null,
      currentContent: currentContent || null,
      generationMode: generationMode || null,
      currentPresentData: currentPresentData || null,
    });
    return response.data;
  } catch (error: any) {
    console.error('Error generating BE content:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate Business English content',
    };
  }
}
