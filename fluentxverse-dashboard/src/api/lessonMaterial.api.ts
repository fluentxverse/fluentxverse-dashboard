/**
 * Lesson Material API
 * API functions for managing lesson materials (Memgraph-backed)
 */
import apiClient from './apiClient';

// ============================================================================
// TYPES
// ============================================================================

export type Skill = 'speaking' | 'listening' | 'reading' | 'writing' | 'review';
export type LevelBadge = 'STARTER' | 'BEGINNER' | 'ELEMENTARY' | 'INTERMEDIATE' | 'ADVANCED' | 'HIGH BEGINNER' | 'HIGH INTERMEDIATE';

// Introduction Section Types
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

export interface IntroductionData {
  introTexts: IntroText[];
  introImage: string | null;
  lessonIssue: LessonIssue | null;
  lessonGoalDuration: string;
  lessonGoalSteps: LessonGoalStep[];
}

// Learn Section Types (Section 2 - Vocabulary/Expressions)
export type StepAType = 'vocabulary' | 'expressions';

export interface VocabularyItem {
  image: string;
  englishText: string;
  highlightedWord?: string;
  translation: string;
}

export interface ExpressionItem {
  image: string;
  definitionLine: string;
  exampleSentence: string;
  extraText?: string;
}

export interface DiscussionImage {
  image: string;
  label?: string;
  translation?: string;
}

export interface DiscussionPart {
  instruction: string;
  instructionTranslation?: string;
  images: DiscussionImage[];
  tutorSteps?: TutorStep[];
}

export interface PronunciationWord {
  word: string;
  translation: string;
  isHighlighted?: boolean;
}

export interface PronunciationColumn {
  soundSymbol: string;
  images: string[];
  words: PronunciationWord[];
}

export interface PronunciationPart {
  instruction: string;
  instructionTranslation: string;
  leftColumn: PronunciationColumn;
  rightColumn: PronunciationColumn;
  tutorSteps?: TutorStep[];
}

export interface TutorStep {
  instruction: string;
  script?: string | null;
  tip?: string | null;
}

export interface LearnStepData {
  stepType: StepAType;
  stepName: string;
  duration: string;
  partLabel: string;
  partTranslation?: string; // Optional translation
  vocabularyItems?: VocabularyItem[];
  expressionItems?: ExpressionItem[];
  discussionPart?: DiscussionPart;
  pronunciationPart?: PronunciationPart;
  tutorSteps: TutorStep[];
}

export interface LearnSectionData {
  sectionTitle: string;
  steps: LearnStepData[];
}

// Step B Section Types (Speak Your Mind / Grammar Tip / Pronunciation)
export type StepBType = 'speak-your-mind' | 'grammar-tip' | 'pronunciation';

export interface ConversationSpeaker {
  image: string;
  speechBubble: string; // Rich text HTML
}

export interface SpeakYourMindData {
  stepName: string;
  duration: string;
  explanation: string;
  explanationTranslation?: string;
  speaker1: ConversationSpeaker;
  speaker2: ConversationSpeaker;
  question: string;
  tutorSteps: TutorStep[];
}

// Grammar Tip types
export interface GrammarExample {
  sentence: string; // HTML with <strong> for highlighted word
  translation: string;
}

export interface GrammarExplanation {
  ruleText: string; // HTML - can have <em> for italics, <strong> for bold
  ruleTranslation: string;
  examplesTitle?: string; // e.g., "EXAMPLES" or "EXAMPLE"
  examples?: GrammarExample[];
}

export interface GrammarTipData {
  stepName: string;
  duration: string;
  explanations: GrammarExplanation[];
  tutorSteps: TutorStep[];
}

// Pronunciation types
export interface PronunciationPhrase {
  phrase: string;
  pronunciationGuide: string; // e.g., "/ cos-ta fortune /"
  exampleSentence: string; // HTML with <strong> for pronunciation highlight
}

export interface StepBPronunciationData {
  stepName: string;
  duration: string;
  tip: string; // HTML - can have bold for emphasis
  phrases: PronunciationPhrase[];
  tutorSteps: TutorStep[];
}

export interface StepBData {
  stepType: StepBType;
  speakYourMind?: SpeakYourMindData;
  grammarTip?: GrammarTipData;
  pronunciation?: StepBPronunciationData;
}

// ============================================================================
// APPLY SECTION TYPES (Section 3 - Speaking/Understanding)
// ============================================================================

export interface DialogueLine {
  speaker: string;
  text: string;
  isAction?: boolean;
}

export interface TutorScriptBullet {
  text: string;
}

export interface TutorTipItem {
  text: string;
}

export interface TutorQuestion {
  question: string;
  answer?: string;
}

export type ApplyActivityType = 'speaking' | 'listening' | 'reading';

export interface ApplyTutorStep {
  instruction: string;
  scripts?: TutorScriptBullet[];
  tips?: TutorTipItem[];
  questions?: TutorQuestion[];
  listeningScript?: string; // Rich text HTML for listening script
}

export interface TriviaTutorStep {
  instruction: string;
  scripts?: TutorScriptBullet[];
  questions?: TutorQuestion[];
}

export interface ApplySectionData {
  sectionNumber: number;
  sectionTitle: string;
  activityType: ApplyActivityType;
  activityTitle: string;
  activityDuration: string;
  situationText: string;
  situationTranslation?: string; // Optional translation
  situationImage: string;
  dialogueLines: DialogueLine[];
  readingText?: string; // Rich text HTML for reading passage
  readingImage?: string; // Optional image inside reading card
  readingImageLabel?: string; // Rich text label under reading image
  tutorSteps: ApplyTutorStep[];
  // Trivia Time (optional)
  triviaEnabled?: boolean;
  triviaText?: string;
  triviaTranslation?: string; // Optional translation
  triviaImage?: string;
  triviaDuration?: string;
  triviaTutorSteps?: TriviaTutorStep[];
}

// Exercise Section Types (Section 4)
export interface ExerciseItem {
  image: string;
  sentence: string;
}

export interface ExerciseAnswer {
  text: string;
}

export interface TutorAnswerKeyItem {
  text: string;
}

export interface ExerciseTutorStep {
  instruction: string;
  scripts?: TutorScriptBullet[];
  tips?: TutorTipItem[];
  answerKey?: TutorAnswerKeyItem[];
}

// Conversation-style exercise types
export interface ExerciseConversation {
  speakerImage: string;
  speechBubble: string; // Rich text HTML with blanks shown as _____
  position: 'left' | 'right';
}

// Choose exercise item
export interface ChooseExerciseItem {
  sentence: string; // Sentence with parenthetical choices like "(doesn't / don't)"
}

export interface ChangeExerciseItem {
  sentence: string; // Full sentence with underlined portion formatted with <u> tags
}

// Exercise Step A types
export type ExerciseStepAType = 'rephrase' | 'choose' | 'change';

// Exercise Step B types
export type ExerciseStepBType = 'conversation' | 'multiple-choice' | 'speech' | 'compare';

export interface MultipleChoiceItem {
  boldSentence: string;
  optionA: string;
  optionB: string;
}

// Compare exercise item for Step B (e.g., "(Restaurant B and C: romantic)")
export interface CompareExerciseItem {
  sentence: string; // The clue sentence like "(Restaurant B and C: romantic)"
}

// Compare image item for Step B
export interface CompareImageItem {
  image: string; // Image URL/base64
  label: string; // Label like "Restaurant A"
}

export interface ExerciseSectionData {
  sectionNumber: number;
  sectionTitle: string;
  duration: string;
  // Step A type
  stepAType: ExerciseStepAType;
  // Step A - Common
  stepAName: string;
  instructions: string;
  instructionsTranslation?: string; // Optional translation
  // Step A - Rephrase type
  showExpressions?: boolean;
  expressions: string[];
  showExample?: boolean;
  exampleSentence: string;
  exampleAnswer: string;
  exampleImage?: string;
  exerciseItems: ExerciseItem[];
  // Step A - Choose type
  chooseItems?: ChooseExerciseItem[];
  chooseImage?: string;
  // Step A - Change type
  changeItems?: ChangeExerciseItem[];
  changeImage?: string;
  // Common
  answers: ExerciseAnswer[];
  tutorSteps: ExerciseTutorStep[];
  // Step B (optional)
  hasStepB: boolean;
  stepBType: ExerciseStepBType;
  stepBName: string;
  stepBInstruction: string;
  stepBInstructionTranslation?: string;
  // Step B - Conversation type
  conversations: ExerciseConversation[];
  // Step B - Multiple Choice type
  multipleChoiceItems?: MultipleChoiceItem[];
  multipleChoiceImage?: string;
  // Step B - Speech type
  speechSpeakerImage?: string;
  speechContent?: string;
  // Step B - Compare type
  compareWordBox?: string[]; // Words like "a little", "far", "a lot", "easily"
  compareImages?: CompareImageItem[]; // Array of images with labels
  compareExample?: string; // Example sentence with formatted answer
  compareItems?: CompareExerciseItem[]; // Exercise items like "(Restaurant B and C: romantic)"
  // Step B - Tutor steps
  stepBTutorSteps: ExerciseTutorStep[];
}

export interface CreateLessonInput {
  course: string;
  level: number;
  chapter: number;
  chapterName?: string;
  lessonNumber: number;
  skill: Skill;
  lessonName: string;
  goalTextEn: string;
  goalTextJp: string;
}

export interface LessonMaterial {
  id: string;
  course: string;
  level: number;
  chapter: number;
  lessonNumber: number;
  skill: Skill;
  chapterName: string;
  lessonName: string;
  goalTextEn: string;
  goalTextJp: string;
  backgroundImage: string;
  overlayColor: string;
  status: 'draft' | 'published';
  introductionData?: IntroductionData;
  learnData?: LearnSectionData;
  stepBData?: StepBData;
  applyData?: ApplySectionData;
  exerciseData?: ExerciseSectionData;
  storyData?: StoryData;
  missionData?: any;
  missionData2?: any;
  feedbackData?: any;
  discussionQuestionsData?: any;
  beData?: any;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  levelBadge: LevelBadge;
  chapterLabel: string;
  lessonTitle: string;
}

// Story data types for K-Drama style learning
export interface StoryCharacter {
  id: string;
  name: string;
  koreanName?: string;
  role: 'main' | 'supporting' | 'minor';
  description: string;
  personality?: string;
  image?: string;
}

export interface StoryData {
  enabled: boolean;
  storyTitle: string;
  characters: StoryCharacter[];
  setting: string;
  previousSummary: string;
  currentPlotPoints: string[];
  currentEpisodeSummary: string;
  nextEpisodeHook: string;
  storyNotes: string;
}

export interface UpdateHeaderInput {
  backgroundImage?: string;
  overlayColor?: string;
  chapterName?: string;
  lessonName?: string;
  goalTextEn?: string;
  goalTextJp?: string;
  introductionData?: IntroductionData;
  learnData?: LearnSectionData;
  stepBData?: StepBData;
  applyData?: ApplySectionData;
  exerciseData?: ExerciseSectionData;
  storyData?: StoryData;
  missionData?: any;
  missionData2?: any;
  feedbackData?: any;
  discussionQuestionsData?: any;
  beData?: any;
}

export interface ChapterInfo {
  chapter: number;
  chapterName: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Create a new lesson
 */
export async function createLesson(input: CreateLessonInput): Promise<LessonMaterial> {
  const response = await apiClient.post('/lesson-materials', input);
  return response.data.lesson;
}

/**
 * Get a lesson by ID
 */
export async function getLessonById(id: string): Promise<LessonMaterial> {
  const response = await apiClient.get(`/lesson-materials/${id}`);
  return response.data.lesson;
}

/**
 * Get a published lesson by ID (public, no auth required)
 * Used for preview pages that may be viewed from student/tutor apps
 */
export async function getPublicLessonById(id: string): Promise<LessonMaterial> {
  const response = await apiClient.get(`/lesson-materials/public/${id}`);
  return response.data.lesson;
}

/**
 * List all lessons for a course
 */
export async function listLessonsByCourse(course: string): Promise<LessonMaterial[]> {
  const response = await apiClient.get(`/lesson-materials/course/${course}`);
  return response.data.lessons;
}

/**
 * Get existing chapters for a course/level (for auto-fill)
 */
export async function getChapters(course: string, level: number): Promise<ChapterInfo[]> {
  const response = await apiClient.get(`/lesson-materials/chapters/${course}/${level}`);
  return response.data.chapters;
}

/**
 * Get existing chapter name if any
 */
export async function getExistingChapterName(course: string, level: number, chapter: number): Promise<string | null> {
  const response = await apiClient.get(`/lesson-materials/chapter-name/${course}/${level}/${chapter}`);
  return response.data.chapterName;
}

/**
 * Check if a lesson combination already exists
 */
export async function checkDuplicate(
  course: string,
  level: number,
  chapter: number,
  lessonNumber: number,
  skill: Skill
): Promise<boolean> {
  const response = await apiClient.get('/lesson-materials/check-duplicate', {
    params: { course, level, chapter, lessonNumber, skill }
  });
  return response.data.exists;
}

/**
 * Update lesson header styling
 */
export async function updateLessonHeader(id: string, input: UpdateHeaderInput): Promise<LessonMaterial> {
  const response = await apiClient.patch(`/lesson-materials/${id}/header`, input);
  return response.data.lesson;
}

/**
 * Duplicate a lesson
 */
export async function duplicateLesson(id: string): Promise<LessonMaterial> {
  const response = await apiClient.post<{ lesson: LessonMaterial }>(`/lesson-materials/${id}/duplicate`);
  return response.data.lesson;
}

/**
 * Delete a lesson
 */
export async function deleteLesson(id: string): Promise<void> {
  await apiClient.delete(`/lesson-materials/${id}`);
}

/**
 * Publish a lesson
 */
export async function publishLesson(id: string): Promise<LessonMaterial> {
  const response = await apiClient.post<{ lesson: LessonMaterial }>(`/lesson-materials/${id}/publish`);
  return response.data.lesson;
}

/**
 * Unpublish a lesson (set back to draft)
 */
export async function unpublishLesson(id: string): Promise<LessonMaterial> {
  const response = await apiClient.post<{ lesson: LessonMaterial }>(`/lesson-materials/${id}/unpublish`);
  return response.data.lesson;
}

// ============================================================================
// COURSE METADATA  (Level topics + Chapter themes/names)
// ============================================================================

export interface CourseMetadata {
  levels: Record<number, { mainTopic: string }>;
  chapters: Record<string, { theme: string; name: string }>;
}

/**
 * Get all metadata for a course
 */
export async function getCourseMetadata(course: string): Promise<CourseMetadata> {
  const response = await apiClient.get(`/lesson-materials/metadata/${course}`);
  return { levels: response.data.levels || {}, chapters: response.data.chapters || {} };
}

/**
 * Save level main-topic
 */
export async function saveLevelTopic(course: string, level: number, mainTopic: string): Promise<void> {
  await apiClient.put(`/lesson-materials/metadata/${course}/level/${level}`, { mainTopic });
}

/**
 * Save chapter theme and/or name
 */
export async function saveChapterMeta(
  course: string,
  level: number,
  chapter: number,
  data: { theme?: string; name?: string }
): Promise<void> {
  await apiClient.put(`/lesson-materials/metadata/${course}/chapter/${level}/${chapter}`, data);
}

// ============================================================================
// LEVEL ADMIN ASSIGNMENT
// ============================================================================

export interface LevelAssignment {
  adminId: string;
  adminName: string;
}

/**
 * Assign an admin to a level
 */
export async function assignLevelAdmin(
  course: string,
  level: number,
  adminId: string,
  adminName: string
): Promise<void> {
  await apiClient.put(`/lesson-materials/metadata/${course}/level/${level}/assign`, { adminId, adminName });
}

/**
 * Unassign admin from a level
 */
export async function unassignLevelAdmin(course: string, level: number): Promise<void> {
  await apiClient.delete(`/lesson-materials/metadata/${course}/level/${level}/assign`);
}

/**
 * Get level assignments for a course
 */
export async function getLevelAssignments(
  course: string
): Promise<Record<number, LevelAssignment>> {
  const response = await apiClient.get(`/lesson-materials/metadata/${course}/assignments`);
  return response.data.assignments || {};
}

/**
 * Batch-save AI-generated course structure for a level
 */
export async function saveCourseStructure(
  course: string,
  level: number,
  data: { mainTopic: string; chapters: Array<{ chapter: number; theme: string; name: string }> }
): Promise<void> {
  await apiClient.put(`/lesson-materials/metadata/${course}/level/${level}/structure`, data);
}
