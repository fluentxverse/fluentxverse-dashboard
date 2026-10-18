/**
 * ConversationalSkillsVisualEditor
 * WYSIWYG visual editor - edit content directly on the styled layout
 * This is the "no-code" page builder experience
 */
import { useState, useEffect, useRef } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import {
  getLessonById,
  updateLessonHeader,
  type LessonMaterial,
} from '../api/lessonMaterial.api';
import { toast } from '../Components/Toast/Toast';
import { TutorGuide, type UniversalTutorStep, type TutorGuideFeatures } from '../components/TutorGuideStep';
import { AIContentGenerator } from '../components/AIContentGenerator';
import { FixedFeedbackGuide } from '../components/FixedFeedbackGuide';
import './ConversationalSkillsVisualEditor.css';
import '../components/TutorGuideStep.css';

// Autosave constants
const AUTOSAVE_DELAY_MS = 5000; // 5 seconds
type ConversationalTheme = 'light' | 'dark';

const getStoredConversationalTheme = (): ConversationalTheme => {
  try {
    return (localStorage.getItem('csve-theme') as ConversationalTheme) || 'light';
  } catch {
    return 'light';
  }
};

// ============================================================================
// SHARED TYPES
// ============================================================================

interface IntroText {
  language: string;
  text: string;
}

interface LessonIssue {
  title: string;
  points: string[];
}

interface LessonGoalStep {
  instruction: string;
  script?: string | null;
  question?: string | null;
}

interface IntroductionData {
  introTexts: IntroText[];
  introImage: string | null;
  lessonIssue: LessonIssue | null;
  lessonGoalDuration: string;
  lessonGoalSteps: LessonGoalStep[];
}

// ============================================================================
// STORY TYPES (K-Drama Style Immersive Learning)
// ============================================================================

interface StoryCharacter {
  id: string;
  name: string;
  koreanName?: string; // Optional Korean name
  role: 'main' | 'supporting' | 'minor';
  description: string;
  personality?: string;
  image?: string;
}

interface StoryData {
  enabled: boolean; // Toggle story mode on/off
  storyTitle: string; // Episode title
  characters: StoryCharacter[];
  setting: string; // Current scene location
  previousSummary: string; // What happened in previous lesson
  currentPlotPoints: string[]; // Key story beats for this lesson
  currentEpisodeSummary: string; // Generated summary of this episode
  nextEpisodeHook: string; // Teaser for next lesson
  storyNotes: string; // Additional notes for AI context
}

const DEFAULT_STORY_DATA: StoryData = {
  enabled: false,
  storyTitle: '',
  characters: [],
  setting: '',
  previousSummary: '',
  currentPlotPoints: [],
  currentEpisodeSummary: '',
  nextEpisodeHook: '',
  storyNotes: '',
};

// Default introduction data
const DEFAULT_INTRODUCTION_DATA: IntroductionData = {
  introTexts: [
    { 
      language: "en", 
      text: "Many Italians love to communicate not only through words but also through gestures. Knowing the meaning behind their gestures can save you from a lot of trouble!" 
    }
  ],
  introImage: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=600&h=400&fit=crop",
  lessonIssue: null,
  lessonGoalDuration: "1 minute",
  lessonGoalSteps: [
    { instruction: "Introduce the lesson topic.", script: "Today, let's talk about gestures.", question: null },
    { instruction: "Read the lesson objective and ask if it's clear.", script: null, question: null },
    { instruction: "Read the Introduce explanation.", script: null, question: null },
    { instruction: "Ask the question below.", script: null, question: null },
    { instruction: "Transition to the next section.", script: "Good! Let's go to the next part!", question: null }
  ]
};

// ============================================================================
// LEARN SECTION TYPES & DEFAULTS
// ============================================================================

// Step A can be either VOCABULARY or EXPRESSIONS
type StepAType = 'vocabulary' | 'expressions';

interface VocabularyItem {
  image: string;
  englishText: string;
  highlightedWord?: string;
  translation: string;
}

// ExpressionItem now uses rich text (HTML) for the definition line
// Users can bold/italic any text with Ctrl+B/Ctrl+I
interface ExpressionItem {
  image: string;
  definitionLine: string; // Rich text HTML like "To <strong>cost an arm and a leg</strong> means to be very expensive."
  exampleSentence: string; // Rich text HTML for example sentence
  extraText?: string; // Optional additional text below example
  translation?: string; // Optional translation (Japanese, Korean, Vietnamese, Chinese)
}

interface DiscussionImage {
  image: string;
  label?: string;
  translation?: string;
}

interface DiscussionPart {
  instruction: string;
  instructionTranslation?: string;
  images: DiscussionImage[]; // Up to 3 images
  tutorSteps?: TutorStep[];
}

// Pronunciation Part III structure
interface PronunciationWord {
  word: string;
  translation: string;
  isHighlighted?: boolean; // Show in green/bold
}

interface PronunciationColumn {
  soundSymbol: string; // e.g., "/d/"
  images: string[]; // 1-3 images showing mouth position
  words: PronunciationWord[];
}

interface PronunciationPart {
  instruction: string; // "III. Practice reading the words."
  instructionTranslation: string;
  leftColumn: PronunciationColumn;
  rightColumn: PronunciationColumn;
  tutorSteps?: TutorStep[];
}

interface TutorStep {
  instruction: string;
  script?: string | null;
  tip?: string | null;
  question?: string | null; // Question to ask the student
}

interface LearnStepData {
  stepType: StepAType;
  stepName: string;
  duration: string;
  partLabel: string;
  partTranslation?: string; // Optional translation
  // For vocabulary type
  vocabularyItems?: VocabularyItem[];
  // For expressions type
  expressionItems?: ExpressionItem[];
  // Part II - Discussion (for both vocabulary and expressions)
  discussionPart?: DiscussionPart;
  // Part III - Pronunciation (for both, can be Part II if discussionPart is not set)
  pronunciationPart?: PronunciationPart;
  // Common
  tutorSteps: TutorStep[];
}

interface LearnSectionData {
  sectionTitle: string;
  steps: LearnStepData[];
}

// Default VOCABULARY template
const DEFAULT_VOCABULARY_STEP: LearnStepData = {
  stepType: 'vocabulary',
  stepName: "STEP A VOCABULARY",
  duration: "2 minutes",
  partLabel: "I. Listen and repeat.",
  partTranslation: undefined,
  vocabularyItems: [
    { image: "", englishText: "wake up", translation: "起きる" },
    { image: "", englishText: "do my hair", highlightedWord: "do", translation: "髪を整える" },
    { image: "", englishText: "eat breakfast", translation: "朝ごはんを食べる" },
    { image: "", englishText: "brush my teeth", translation: "歯を磨く" },
  ],
  tutorSteps: [
    { instruction: "Introduce Learn.", script: "Now, let's try Learn. First we have Step A Vocabulary. Let's do Part I. Can you see the pictures and text?", tip: null },
    { instruction: "Read the instructions.", script: null, tip: null },
    { instruction: "Read the first vocabulary and ask the student to repeat. Correct their pronunciation if necessary.", script: null, tip: null },
    { instruction: "Repeat Step 3 with the remaining vocabulary.", script: null, tip: null },
    { instruction: "Transition to the next part.", script: "Great! Let's go to the next part!", tip: null },
  ]
};

// Default EXPRESSIONS template
const DEFAULT_EXPRESSIONS_STEP: LearnStepData = {
  stepType: 'expressions',
  stepName: "STEP A EXPRESSIONS",
  duration: "4 minutes",
  partLabel: "I. Go over the expressions with your tutor.",
  partTranslation: undefined,
  expressionItems: [
    { 
      image: "",
      definitionLine: "To <strong>cost an arm and a leg</strong> means to be very expensive.",
      exampleSentence: "<em>Staying at a five-star hotel will <strong>cost an arm and a leg</strong>.</em>"
    },
    { 
      image: "",
      definitionLine: "To <strong>cost a fortune</strong> requires a lot of money.",
      exampleSentence: "<em>The taxi ride from the airport <strong>cost a fortune</strong> last night!</em>"
    },
    { 
      image: "",
      definitionLine: "<strong>Dirt cheap</strong> means very inexpensive.",
      exampleSentence: "<em>The souvenirs I bought were <strong>dirt cheap</strong>.</em>"
    },
  ],
  tutorSteps: [
    { instruction: "Introduce Present.", script: "Now, let's try Present. First we have Step A Expressions. Let's do Part I. Can you see the pictures and text?", tip: null },
    { instruction: "Read the instructions.", script: null, tip: null },
    { instruction: "Read the first expression's explanation.", script: null, tip: null },
    { instruction: "Read the italicized example sentence and ask the student to repeat. Correct their pronunciation if necessary.", script: null, tip: null },
    { instruction: "Repeat Steps 3-4 with the remaining expressions.", script: null, tip: null },
    { instruction: "Transition to the next part.", script: "Great! Let's go to the next part!", tip: null },
  ]
};

const DEFAULT_LEARN_DATA: LearnSectionData = {
  sectionTitle: "LEARN",
  steps: [DEFAULT_VOCABULARY_STEP]
};

// ============================================================================
// STEP B SECTION TYPES & DEFAULTS
// ============================================================================

// Step B can be different templates
type StepBType = 'speak-your-mind' | 'grammar-tip' | 'pronunciation';

// A conversation exchange (speaker + speech bubble)
interface ConversationSpeaker {
  image: string;
  speechBubble: string; // Rich text HTML - can contain <strong> for highlighted phrase
}

// Speak Your Mind template structure
interface SpeakYourMindData {
  stepName: string; // "STEP B SPEAK YOUR MIND"
  duration: string;
  explanation: string; // Bold text at top explaining the grammar concept
  explanationTranslation?: string; // Optional translation for the explanation
  speaker1: ConversationSpeaker; // Left speaker (asks question)
  speaker2: ConversationSpeaker; // Right speaker (gives response with grammar phrase)
  question: string; // Question at the bottom for student to answer
  tutorSteps: TutorStep[];
}

// Grammar Tip example item (sentence + translation)
interface GrammarExample {
  sentence: string; // HTML with <strong> for highlighted word
  translation: string;
}

// Grammar Tip explanation block (rule + translation + optional examples box)
interface GrammarExplanation {
  ruleText: string; // HTML - can have <em> for italics
  ruleTranslation: string;
  examplesTitle?: string; // e.g., "EXAMPLES" or "EXAMPLE"
  examples?: GrammarExample[];
}

// Grammar Tip template structure
interface GrammarTipData {
  stepName: string; // "STEP B GRAMMAR TIP"
  duration: string;
  explanations: GrammarExplanation[];
  tutorSteps: TutorStep[];
}

// Step B Pronunciation types
interface PronunciationPhrase {
  phrase: string; // e.g., "cost a fortune"
  pronunciationGuide: string; // e.g., "/ cos-ta fortune /"
  exampleSentence: string; // HTML with <strong> for pronunciation highlight
}

interface StepBPronunciationData {
  stepName: string; // "STEP B PRONUNCIATION"
  duration: string;
  tip: string; // The bold pronunciation tip at the top
  phrases: PronunciationPhrase[];
  tutorSteps: TutorStep[];
}

interface StepBData {
  stepType: StepBType;
  speakYourMind?: SpeakYourMindData;
  grammarTip?: GrammarTipData;
  pronunciation?: StepBPronunciationData;
}

// ============================================================================
// APPLY SECTION TYPES (Section 3 - Speaking/Listening/Reading)
// ============================================================================

type ApplyActivityType = 'speaking' | 'listening' | 'reading';

// Dialogue line with speaker name and text (for SPEAKING)
interface DialogueLine {
  speaker: string; // e.g., "Heinz", "Naoki"
  text: string; // HTML - can have underlined words for emphasis
  isAction?: boolean; // e.g., "(laughs)" - shown in italics
}

// Script bullet point in tutor guide
interface TutorScriptBullet {
  text: string; // Script text (shown in green italic)
}

// Tip in tutor guide (shown in red)
interface TutorTipItem {
  text: string;
}

// Question in the questions box
interface TutorQuestion {
  question: string;
  answer?: string; // Answer hint (shown in green)
}

// Trivia tutor step
interface TriviaTutorStep {
  instruction: string;
  scripts?: TutorScriptBullet[];
  questions?: TutorQuestion[]; // Questions with answers
}

// Complex tutor step for APPLY section
interface ApplyTutorStep {
  instruction: string;
  scripts?: TutorScriptBullet[]; // Multiple script bullets
  tips?: TutorTipItem[]; // Multiple tips (red text)
  questions?: TutorQuestion[]; // Questions with answers
  listeningScript?: string; // Rich text HTML for listening script (green box)
}

interface ApplySectionData {
  sectionNumber: number; // Usually 3
  sectionTitle: string; // "APPLY"
  activityType: ApplyActivityType; // 'speaking', 'listening', or 'reading'
  activityTitle: string; // "SPEAKING", "LISTENING", or "READING"
  activityDuration: string; // "3 minutes"
  situationText: string; // Situation description (bold)
  situationTranslation?: string; // Optional translation of situation
  situationImage: string; // Main image
  // Speaking-specific
  dialogueLines: DialogueLine[];
  // Reading-specific
  readingText?: string; // Rich text HTML for reading passage
  readingImage?: string; // Optional image inside reading card (like profile)
  readingImageLabel?: string; // Rich text label under reading image
  // Listening-specific (script is in tutorSteps)
  tutorSteps: ApplyTutorStep[];
  // Trivia Time (optional, available for all activity types)
  triviaEnabled?: boolean;
  triviaText?: string; // Trivia content
  triviaTranslation?: string; // Optional translation of trivia
  triviaImage?: string; // Optional centered image in trivia box
  triviaDuration?: string; // e.g., "1 minute"
  triviaTutorSteps?: TriviaTutorStep[];
}

// Default APPLY section template (Speaking)
const DEFAULT_APPLY_SPEAKING: ApplySectionData = {
  sectionNumber: 3,
  sectionTitle: "APPLY",
  activityType: "speaking",
  activityTitle: "SPEAKING",
  activityDuration: "3 minutes",
  situationText: "Naoki is having coffee with a German coworker.",
  situationImage: "",
  dialogueLines: [
    { speaker: "Heinz", text: "Ah, it's finally Friday! Do you have any plans for the weekend?" },
    { speaker: "Naoki", text: "Hmm... No, not really. Back in Japan, I normally play golf on weekends, but I guess for now, I'll just take a look around the city." },
    { speaker: "Heinz", text: "Oh, wow! You play golf?" },
    { speaker: "Naoki", text: "Yeah! I'm actually a member of a golf club back home. Originally, I only signed up because my boss invited me, but I'm glad I did. There are so many benefits!" },
    { speaker: "Heinz", text: "Really? Like what?" },
    { speaker: "Naoki", text: "Like meeting a lot of people! I get to interact with a lot of big names in our club, and I've been able to build a good network through it. Now I <u>have connections</u> in several industries!" },
    { speaker: "Heinz", text: "Oh, nice!" },
    { speaker: "Naoki", text: "Yeah, it's really good for business. Like, if you <u>know the right person</u> in a company, it's as good as <u>getting your foot in the door</u> for future partnerships. By the way, are there clubs like that here in Germany?" },
    { speaker: "Heinz", text: "Absolutely. Have you heard of hobby horsing clubs? They're pretty interesting." },
    { speaker: "Naoki", text: "Really? Cool! Are you a member?" },
    { speaker: "Heinz", text: "(laughs) No, I'm not. It's a club where people ride wooden stick horses.", isAction: true },
    { speaker: "Naoki", text: "Really?!" },
  ],
  tutorSteps: [
    {
      instruction: "Introduce Understand.",
      scripts: [
        { text: "Okay, now let's do Understand." },
        { text: "First we have a speaking activity." }
      ]
    },
    {
      instruction: "Set up the story.",
      scripts: [
        { text: "Do you remember Naoki from before?" }
      ],
      tips: [
        { text: "If the student doesn't remember, say that Naoki is a hardworking employee of a trading company who is aiming for a promotion. He's on a business trip in Germany." }
      ]
    },
    {
      instruction: "Read the situation."
    },
    {
      instruction: "Set up the dialogue.",
      scripts: [
        { text: "Let's read their dialogue." },
        { text: "I'll be your coworker Heinz. Please be Naoki." },
        { text: "Is it clear?" },
        { text: "Okay, I'll start." }
      ]
    },
    {
      instruction: "Read the dialogue with the student."
    },
    {
      instruction: "After you finish the dialogue, correct their pronunciation mistakes.",
      tips: [
        { text: "Limit this to 2-3 corrections." },
        { text: "If the student made a lot of mistakes, focus on the biggest ones." }
      ]
    },
    {
      instruction: "Ask the questions below.",
      questions: [
        { question: "According to Naoki, what is one benefit of being part of a sports club?", answer: "One of the benefits of being in a sports club is getting to meet a lot of people." },
        { question: "Would you also join a sports club to expand your social circle/network?", answer: "(student's own answer)" }
      ]
    },
    {
      instruction: "Transition to the next part.",
      scripts: [
        { text: "Great! Let's go to the next part!" }
      ]
    }
  ],
  triviaEnabled: true,
  triviaText: "",
  triviaImage: "",
  triviaDuration: "1 minute",
  triviaTutorSteps: [
    {
      instruction: "Introduce the Trivia.",
      scripts: [{ text: "Let's look at the Trivia." }]
    },
    { instruction: "Read the trivia." },
    {
      instruction: "Confirm the student's understanding.",
      scripts: [{ text: "Is it clear?" }]
    },
    {
      instruction: "Ask the question below.",
      questions: [{ question: "", answer: "(student's own answer)" }]
    },
    {
      instruction: "Transition to the next section.",
      scripts: [{ text: "Excellent! Let's go to the next section!" }]
    }
  ]
};

// Default APPLY section template (Listening)
const DEFAULT_APPLY_LISTENING: ApplySectionData = {
  sectionNumber: 3,
  sectionTitle: "APPLY",
  activityType: "listening",
  activityTitle: "LISTENING",
  activityDuration: "3 minutes",
  situationText: "Satoshi is doing a homestay in Italy. He's talking with Marco, a member of the family he's staying with.",
  situationImage: "",
  dialogueLines: [],
  tutorSteps: [
    {
      instruction: "Introduce Understand.",
      scripts: [
        { text: "Okay, now let's do Understand." },
        { text: "First we have a listening activity." }
      ]
    },
    {
      instruction: "Read the situation."
    },
    {
      instruction: "Set up the listening.",
      scripts: [
        { text: "Let's listen to Marco." },
        { text: "I'll be Marco." },
        { text: "Is it clear?" },
        { text: "Okay, I'll start." }
      ]
    },
    {
      instruction: "Read the listening script below, emphasizing the underlined words.",
      listeningScript: "Hey, Satoshi, it's nice to see that you're getting used to life in Italy now, but there's one thing you should be careful about. While you were talking with Matteo earlier, I noticed <u>you were using some gestures that have negative connotations</u>. Like when <u>you pointed at the side of your head</u>. Do you know what that means? ... Well, it's like <u>you're saying that he's stupid</u>. Not so nice, eh? <em>(laugh)</em> I think you also moved your arm to your stomach like this... Be careful: It doesn't mean you're hungry. We only do that when we want to tell someone that they're really annoying. <em>(laugh)</em> <u>Matteo knows you and understands you aren't trying to say anything bad about him, but it's dangerous to make gestures you don't understand with strangers</u>. <u>They might assume that you know they're insults and want to start a fight</u>. <u>I know you're trying to act more Italian, but you could get into serious trouble with the gestures!</u> My advice? Just focus on improving your Italian. <u>Don't gesticulate too much and you'll be fine!</u>"
    },
    {
      instruction: "Ask the questions below.",
      questions: [
        { question: "Why did Marco give Satoshi advice about gestures?", answer: "Because Marco noticed Satoshi was using gestures with negative connotations and is afraid that he could get in serious trouble." },
        { question: "If you were Satoshi, would you follow Marco's advice?", answer: "(student's own answer)" }
      ]
    },
    {
      instruction: "Transition to the next part.",
      scripts: [
        { text: "Great! Let's go to the next part!" }
      ]
    }
  ],
  triviaEnabled: true,
  triviaText: "",
  triviaImage: "",
  triviaDuration: "1 minute",
  triviaTutorSteps: [
    {
      instruction: "Introduce the Trivia.",
      scripts: [{ text: "Let's look at the Trivia." }]
    },
    { instruction: "Read the trivia." },
    {
      instruction: "Confirm the student's understanding.",
      scripts: [{ text: "Is it clear?" }]
    },
    {
      instruction: "Ask the question below.",
      questions: [{ question: "", answer: "(student's own answer)" }]
    },
    {
      instruction: "Transition to the next section.",
      scripts: [{ text: "Excellent! Let's go to the next section!" }]
    }
  ]
};

// Default APPLY section template (Reading)
const DEFAULT_APPLY_READING: ApplySectionData = {
  sectionNumber: 3,
  sectionTitle: "APPLY",
  activityType: "reading",
  activityTitle: "READING",
  activityDuration: "3 minutes",
  situationText: "Naoki is reading an email from Saori.",
  situationImage: "",
  dialogueLines: [],
  readingText: "Naoki, I've been thinking about this a lot, and I've finally made a decision. Aoi-chan and I are going to live in Fukuoka with you. I know you love us, and I know how much you love your job there... You don't have to choose between the two things you love anymore. I feel so foolish for thinking that Aoi-chan's fancy preschool here in Tokyo was more important than us being together.\n\nI'm sorry that we had to fight over this, but my head is clearer now. You're doing a <u>remarkable</u> job there, and I don't want to take that away from you. You're passionate and hardworking, which is why I fell in love with you in the first place. I think I had almost forgotten about those traits these past few months... But really, <u>I think the world of you</u> because of them.\n\nAnd just in case I haven't said it enough, I want to <u>tell you what a good husband and father you are</u>. I really hope Aoi-chan grows up to be just like you.\n\nWe'll see you very soon!\n\nLove,\n\nSaori",
  readingImage: "",
  readingImageLabel: "",
  tutorSteps: [
    {
      instruction: "Introduce Understand.",
      scripts: [
        { text: "Okay, now let's do Understand." },
        { text: "First we have a reading activity." }
      ]
    },
    {
      instruction: "Set up the story.",
      scripts: [
        { text: "Do you remember Naoki from before?" }
      ],
      tips: [
        { text: "If the student doesn't remember, say that he's Saori's husband. He's away in Fukuoka because of his job, while Saori is in Tokyo with their child." }
      ]
    },
    {
      instruction: "Read the situation."
    },
    {
      instruction: "Set up the reading.",
      scripts: [
        { text: "Let's read the email." }
      ]
    },
    {
      instruction: "Have the student read the reading text aloud."
    },
    {
      instruction: "After they finish reading, correct their pronunciation mistakes.",
      tips: [
        { text: "Limit this to 2-3 corrections." },
        { text: "If the student made a lot of mistakes, focus on the biggest ones." }
      ]
    },
    {
      instruction: "Ask the questions below.",
      questions: [
        { question: "Why does Saori think the world of Naoki?", answer: "(She thinks the world of him because he's passionate and hardworking.)" },
        { question: "What characteristics would make you think the world of someone?", answer: "(student's own answer)" }
      ]
    },
    {
      instruction: "Transition to the next part.",
      scripts: [
        { text: "Great! Let's go to the next part!" }
      ]
    }
  ],
  triviaEnabled: true,
  triviaText: "",
  triviaImage: "",
  triviaDuration: "1 minute",
  triviaTutorSteps: [
    {
      instruction: "Introduce the Trivia.",
      scripts: [{ text: "Let's look at the Trivia." }]
    },
    { instruction: "Read the trivia." },
    {
      instruction: "Confirm the student's understanding.",
      scripts: [{ text: "Is it clear?" }]
    },
    {
      instruction: "Ask the question below.",
      questions: [{ question: "", answer: "(student's own answer)" }]
    },
    {
      instruction: "Transition to the next section.",
      scripts: [{ text: "Excellent! Let's go to the next section!" }]
    }
  ]
};

const DEFAULT_APPLY_DATA: ApplySectionData = DEFAULT_APPLY_SPEAKING;

// ============================================================================
// EXERCISE SECTION TYPES (Section 4)
// ============================================================================

// Conversation exercise - speaker with fill-in-the-blank speech
interface ExerciseConversation {
  speakerImage: string;
  speechBubble: string; // Rich text HTML with blanks shown as _____
  position: 'left' | 'right';
}

// Exercise item - an image with a numbered sentence
interface ExerciseItem {
  image: string;
  sentence: string; // The sentence to rephrase
}

// Answer in the answer key box
interface ExerciseAnswer {
  text: string; // The rephrased answer
}

// Exercise tutor step answer key item
interface TutorAnswerKeyItem {
  text: string;
}

// Exercise tutor step
interface ExerciseTutorStep {
  instruction: string;
  scripts?: TutorScriptBullet[];
  tips?: TutorTipItem[];
  answerKey?: TutorAnswerKeyItem[];
}

// Exercise Step A types
type ExerciseStepAType = 'rephrase' | 'choose' | 'change';

// Exercise Step B types
type ExerciseStepBType = 'conversation' | 'multiple-choice' | 'speech' | 'compare';

// Choose exercise item (for "choose the correct word" type)
interface ChooseExerciseItem {
  sentence: string; // Sentence with parenthetical choices like "(doesn't / don't)"
}

// Change exercise item (for "change the underlined" type)
interface ChangeExerciseItem {
  sentence: string; // Full sentence with underlined portion formatted with <u> tags
}

// Multiple choice item for Step B
interface MultipleChoiceItem {
  boldSentence: string; // Bold sentence with blank at end
  optionA: string; // First option
  optionB: string; // Second option
}

// Compare exercise item for Step B
interface CompareExerciseItem {
  sentence: string; // The clue sentence like "(Restaurant B and C: romantic)"
}

// Compare image item for Step B
interface CompareImageItem {
  image: string; // Image URL/base64
  label: string; // Label like "Restaurant A"
}

// Info Box column for comparison table
interface InfoBoxColumn {
  header: string; // Column header (e.g., "Bangkok", "Ko Samui", "Phuket")
  rows: string[]; // Values for each row (e.g., "$", "❤️❤️❤️", "🙂🙂")
}

// Info Box data for comparison table
interface InfoBoxData {
  title: string; // Title (e.g., "Top Vacation Spots in Thailand")
  rowLabels: string[]; // Row labels shown on left (e.g., ["$", "❤️", "🙂"])
  columns: InfoBoxColumn[]; // Array of columns with headers and values
}

interface ExerciseSectionData {
  sectionNumber: number; // Usually 4
  sectionTitle: string; // "EXERCISE"
  duration: string; // "3 minutes"
  // Step A type
  stepAType: ExerciseStepAType; // 'rephrase' or 'choose'
  // Step A - Common fields
  stepAName: string; // "STEP A" - shown when Step B is enabled
  instructions: string; // Bold instructions at top
  instructionsTranslation?: string; // Optional translation of instructions
  // Step A - Rephrase type fields
  showExpressions: boolean; // Whether to show expression box
  expressions: string[]; // Words in the expression box
  showExample: boolean; // Whether to show example
  exampleSentence: string; // e.g., "Lizzy always moves her hands around when she argues."
  exampleAnswer: string; // e.g., "Lizzy always gesticulates when she argues."
  exampleImage?: string; // Optional image for example
  exerciseItems: ExerciseItem[];
  // Step A - Choose type fields
  chooseItems: ChooseExerciseItem[]; // Items for choose the correct word
  chooseImage?: string; // Optional image at bottom
  // Step A - Change type fields
  changeItems: ChangeExerciseItem[]; // Items for change the underlined
  // Step A - Info Box (optional comparison table)
  showInfoBox: boolean; // Whether to show info box
  infoBox?: InfoBoxData; // Info box data
  // Common fields
  answers: ExerciseAnswer[]; // Answer key shown in tutor guide
  tutorSteps: ExerciseTutorStep[];
  // Step B - (optional)
  hasStepB: boolean; // Whether Step B is enabled
  stepBType: ExerciseStepBType; // 'conversation' or 'multiple-choice'
  stepBName: string; // "STEP B" heading
  stepBInstruction: string; // e.g., "Complete the speech using your own information."
  stepBInstructionTranslation?: string;
  // Step B - Conversation type
  conversations: ExerciseConversation[];
  // Step B - Multiple Choice type
  multipleChoiceItems: MultipleChoiceItem[];
  multipleChoiceImage?: string; // Optional image at bottom
  // Step B - Speech type (single speaker with speech bubble)
  speechSpeakerImage?: string;
  speechContent?: string; // Rich text content with blanks and parenthetical choices
  // Step B - Compare type
  compareWordBox: string[]; // Words like "a little", "far", "a lot", "easily"
  compareImages: CompareImageItem[]; // Array of images with labels
  compareExample?: string; // Example sentence with formatted answer
  compareItems: CompareExerciseItem[]; // Exercise items like "(Restaurant B and C: romantic)"
  stepBTutorSteps: ExerciseTutorStep[];
}

// ============================================================================
// SECTION 5: MISSION TYPES
// ============================================================================

// Mission type - 'speaking' for roleplay, 'discussion' for topic-based discussion
type MissionType = 'speaking' | 'discussion' | 'reading' | 'listening';

// Mission tutor step with questions support
interface MissionTutorStep {
  instruction: string;
  scripts?: { text: string }[];
  prompts?: { text: string }[];
  tips?: { text: string }[];
  listeningScript?: string; // Listening script (for listening type)
}

// Mission question with sub-hints
interface MissionQuestion {
  question: string; // Main question text
  hints?: string[]; // Green sub-bullet hints/options
}

// Discussion topic with questions (for Challenge 2)
interface MissionTopic {
  title: string; // Topic title (e.g., "COOKING")
  questions: string[]; // List of questions for this topic
}

// Reading passage block (text or image)
interface ReadingBlock {
  type: 'paragraph' | 'images';
  content?: string; // For paragraph
  images?: string[]; // For images (array of URLs)
}

// Reading passage data
interface ReadingPassage {
  title: string;
  showAuthor?: boolean;
  author?: string;
  headerAlignment?: 'left' | 'center' | 'right';
  blocks: ReadingBlock[];
  closingQuestion?: string;
}

// Mission Section Data (Speaking type)
interface MissionSectionData {
  sectionNumber: number; // Usually 5
  sectionTitle: string; // "CHALLENGE" or "MISSION"
  missionType: MissionType; // 'speaking' or 'discussion' or 'reading'
  // Challenge info
  challengeNumber: number; // 1, 2, etc.
  challengeName: string; // "Challenge 1"
  duration: string; // "5-6 minutes"
  // Student view
  situation: string; // The scenario text
  situationTranslation?: string; // Japanese translation
  instruction: string; // "Tell him what you think."
  instructionTranslation?: string; // Japanese translation
  // Optional grammar tip
  showGrammarTip: boolean;
  grammarTipTitle: string; // "Today's grammar tip"
  grammarTipItems: string[]; // Bullet points
  // Image
  image?: string;
  // Tutor guide
  tutorSteps: MissionTutorStep[];
  // Questions section (for speaking type)
  questionsIntro?: string; // Yellow box intro text
  questions: MissionQuestion[];
  // Discussion specific fields (for discussion type)
  isOptional?: boolean; // "If Time Allows" badge
  topics?: MissionTopic[]; // Topic cards with questions
  // Reading specific fields (for reading type)
  readingPassage?: ReadingPassage;
  // Listening specific fields (for listening type)
  listeningScript?: string; // The listening passage text
}

// ============================================================================
// FEEDBACK SECTION TYPES (Section 6)
// ============================================================================

interface FeedbackExample {
  youSaid: string;
  correction: string;
  correctionLabel: string; // "Correct:" or "Better:"
}

interface FeedbackCategory {
  id: string; // 'range' | 'accuracy' | 'fluency'
  title: string; // "RANGE", "ACCURACY", "FLUENCY"
  titleJp: string; // Japanese subtitle
  focusOn: string; // Description of what this category focuses on
  exampleFeedbackItems: string[]; // e.g. "words the student learned", "grammar mistakes"
  vocabularyExample?: string; // For RANGE: "the latest - something that is the newest version"
  examples: FeedbackExample[];
}

interface RubricLevel {
  score: number;
  label: string;
  description: string;
}

interface FeedbackTutorStep {
  instruction: string;
  scripts?: { text: string }[];
  prompts?: { text: string }[];
  tips?: { text: string }[];
}

interface FeedbackSectionData {
  sectionNumber: number;
  sectionTitle: string;
  duration: string;
  // Goal section
  goal: string;
  goalJp: string;
  // Rubric
  rubricTitle: string;
  rubricLevels: RubricLevel[];
  // Categories header
  personalizedFeedbackTitle: string;
  // Tutor guide
  tutorSteps: FeedbackTutorStep[];
  rememberNote: string;
  // Feedback guide table
  feedbackGuideTitle: string;
  categories: FeedbackCategory[];
}

const DEFAULT_FEEDBACK_DATA: FeedbackSectionData = {
  sectionNumber: 6,
  sectionTitle: "FEEDBACK",
  duration: "2 minutes",
  // Goal
  goal: "I can listen to and understand a description of food.",
  goalJp: "食べ物の説明を聞いて理解できるようになる。",
  // Rubric
  rubricTitle: "LESSON OBJECTIVE ACHIEVEMENT",
  rubricLevels: [
    { score: 4, label: "Very Good", description: "Could complete the task with ease" },
    { score: 3, label: "Good", description: "Could complete the task with some clarifications" },
    { score: 2, label: "Fair", description: "Could complete the task with additional instructions" },
    { score: 1, label: "Poor", description: "Could somehow complete the task with difficulty" }
  ],
  // Categories header
  personalizedFeedbackTitle: "PERSONALIZED FEEDBACK",
  // Feedback guide table
  feedbackGuideTitle: "PERSONALIZED FEEDBACK GUIDE",
  rememberNote: "Effective feedback is specific to the student's actual performance.\n\nUse this template to give the student feedback.",
  tutorSteps: [
    {
      instruction: "Introduce Feedback.",
      scripts: [{ text: "Okay, now let's do Feedback." }]
    },
    {
      instruction: "Have the student read the lesson objective."
    },
    {
      instruction: "Ask if they achieved the lesson objective.",
      scripts: [{ text: "Did you achieve the lesson objective?" }]
    },
    {
      instruction: "Give the student a score for their objective achievement using the rubric.",
      tips: [{ text: "Base your score mainly on Challenge 1." }]
    },
    {
      instruction: "Give feedback on the student's range, accuracy, and fluency using the guide below."
    },
    {
      instruction: "Wrap up the lesson.",
      scripts: [{ text: "You did a great job today. Thank you very much!" }]
    }
  ],
  categories: [
    {
      id: 'range',
      title: 'RANGE',
      titleJp: '表現の幅\n語彙をどの程度使えるか',
      focusOn: 'the ability to use a wide variety of vocabulary',
      exampleFeedbackItems: ['words the student learned', 'words the student overused'],
      vocabularyExample: 'the latest - something that is the newest version',
      examples: [
        {
          youSaid: 'My job is VERY fun. I like it VERY much, but I\'m VERY busy.',
          correction: 'My job is A LOT OF fun. I like it VERY much, but I\'m QUITE busy.',
          correctionLabel: 'Better:'
        }
      ]
    },
    {
      id: 'accuracy',
      title: 'ACCURACY',
      titleJp: '正確さ\n文法が正しく使えているかどうか',
      focusOn: 'the ability to speak correctly',
      exampleFeedbackItems: ['grammar mistakes'],
      examples: [
        {
          youSaid: 'I GO to the park yesterday.',
          correction: 'I WENT to the park yesterday.',
          correctionLabel: 'Correct:'
        },
        {
          youSaid: 'I HAVE NOT started yet.',
          correction: 'I HAVEN\'T started yet.',
          correctionLabel: 'Better:'
        }
      ]
    },
    {
      id: 'fluency',
      title: 'FLUENCY',
      titleJp: '流暢さ\n円滑に喋ることができるかどうか',
      focusOn: 'the ability to speak smoothly without pauses or fillers',
      exampleFeedbackItems: ['unnaturally long pauses', 'Japanese or English fillers (etto..., ano..., um..., etc.)'],
      examples: [
        {
          youSaid: 'I went shopping. ... It was fun.',
          correction: 'I went shopping. It was fun.',
          correctionLabel: 'Better:'
        },
        {
          youSaid: 'I went shopping. ETTO, it was fun.',
          correction: 'I went shopping. It was fun.',
          correctionLabel: 'Better:'
        }
      ]
    }
  ]
};

const DEFAULT_MISSION_DATA: MissionSectionData = {
  sectionNumber: 5,
  sectionTitle: "MISSION",
  missionType: "speaking",
  challengeNumber: 1,
  challengeName: "Challenge 1",
  duration: "5-6 minutes",
  situation: "You were invited by your chef friend to attend the opening of his restaurant. After the meal, he came to you to ask your opinion about his food.",
  situationTranslation: "シェフをしている友達から招待されて、彼のレストランのオープニングに参加しました。食事の後、彼が食事についての意見を聞きにきました。",
  instruction: "Tell him what you think.",
  instructionTranslation: "あなたの感想を言いましょう。",
  showGrammarTip: true,
  grammarTipTitle: "Today's grammar tip",
  grammarTipItems: ["(way/a bit) too", "(not) enough"],
  image: "",
  tutorSteps: [
    {
      instruction: "Introduce Challenge 1.",
      scripts: [
        { text: "Okay, now let's do the Challenge." },
        { text: "First we have Challenge 1." }
      ]
    },
    { instruction: "Read the situation." },
    {
      instruction: "Confirm the student's understanding.",
      scripts: [{ text: "Is it clear?" }]
    },
    {
      instruction: "Set up the roleplay.",
      scripts: [
        { text: "Now, I'll be your chef friend." },
        { text: "Please talk about the food as much as you can." },
        { text: "Remember to use today's grammar tip." },
        { text: "Is it clear?" },
        { text: "I'll start." }
      ]
    },
    {
      instruction: "Ask the questions below.",
      tips: [
        { text: "Use the questions below only as guides. Ask other questions based on the flow of the conversation." },
        { text: "Make sure that you simulate a real-life situation." },
        { text: "Change your tone according to the character you are playing." }
      ]
    }
  ],
  questionsIntro: "(Casual talk like: Ask the student how they are today.)",
  questions: [
    {
      question: "How was your meal?",
      hints: [
        "(Let the student do a monologue. Then, proceed to 5.)",
        "(If the student does not lead the conversation, ask questions 2-4.)"
      ]
    },
    {
      question: "How did you like our appetizers?",
      hints: [
        "(If the student is struggling, indicate some appetizers below.)",
        "shrimp",
        "salad",
        "soup",
        "spicy noodles"
      ]
    },
    {
      question: "How about the main course?",
      hints: [
        "(If the student is struggling, indicate some main courses below.)",
        "chicken curry",
        "beef steak"
      ]
    },
    {
      question: "Did you also enjoy the dessert?",
      hints: [
        "(If the student is struggling, indicate some desserts below.)",
        "mango cake",
        "coffee jelly"
      ]
    },
    { question: "Which part of the meal did you enjoy the most? The appetizer, main course, or dessert?" },
    { question: "That's great! So, how would you describe your overall experience?" },
    { question: "What do you think we should improve?" },
    { question: "Any other suggestions?" }
  ]
};

// Default data for Challenge 2 (Discussion type)
const DEFAULT_DISCUSSION_DATA: MissionSectionData = {
  sectionNumber: 5,
  sectionTitle: "MISSION",
  missionType: "discussion",
  challengeNumber: 2,
  challengeName: "Challenge 2",
  duration: "2-3 minutes",
  situation: "",
  instruction: "Discuss your ideas.",
  instructionTranslation: "あなたの意見を言いましょう。",
  showGrammarTip: false,
  grammarTipTitle: "",
  grammarTipItems: [],
  image: "",
  isOptional: true, // "If Time Allows"
  topics: [
    {
      title: "COOKING",
      questions: [
        "When was the last time you cooked?",
        "What kind of cooking is common in Japan (ex. boiling, smoking)?",
        "What Japanese dish do you think is hard to cook?",
        "What was the most delicious dish you've ever cooked? Describe it."
      ]
    },
    {
      title: "OMIYAGE AND SOUVENIRS",
      questions: [
        "What kind of souvenirs do you usually buy for yourself?",
        "Do you always look forward to omiyage from friends or coworkers?",
        "Have you ever received omiyage that you didn't like? What was it?",
        "What omiyage are popular in your hometown?"
      ]
    },
    {
      title: "FOREIGN FOOD",
      questions: [
        "What foreign dish do you want to try?",
        "What's your favorite foreign dish?",
        "What foreign dishes do you dislike?",
        "Which do you eat more, Japanese food or foreign food?"
      ]
    }
  ],
  tutorSteps: [
    {
      instruction: "Introduce Challenge 2.",
      scripts: [{ text: "Okay, now let's do Challenge 2." }]
    },
    { instruction: "Read the instructions." },
    {
      instruction: "Read the topics and ask the student to choose one.",
      tips: [{ text: "If the student cannot decide, choose a topic for them." }]
    },
    {
      instruction: "Ask the questions for that topic, adding follow-up questions and comments to make the conversation natural.",
      tips: [{ text: "Continue as time allows. You do not have to ask all the questions." }]
    },
    {
      instruction: "Transition to the last section.",
      scripts: [{ text: "Well done! Let's go to the last section!" }]
    }
  ],
  questionsIntro: "",
  questions: []
};

// Default data for Reading type
const DEFAULT_READING_DATA: MissionSectionData = {
  sectionNumber: 5,
  sectionTitle: "MISSION",
  missionType: "reading",
  challengeNumber: 1,
  challengeName: "Challenge 1",
  duration: "5-6 minutes",
  situation: "You want to invite a coworker to dinner.",
  situationTranslation: "あなたは同僚を夕食に誘いたいと思っています。",
  instruction: "Read a review of some new restaurants in your area. Then, talk to your coworker and decide which restaurant to go to.",
  instructionTranslation: "近所のいくつかの新しいレストランの批評を読み、同僚と話をしてどのレストランに行くか決めましょう。",
  showGrammarTip: true,
  grammarTipTitle: "Today's grammar tip",
  grammarTipItems: ["a little", "slightly", "far", "a lot", "much", "easily", "by far"],
  image: "",
  readingPassage: {
    title: "Crazy for Foodie",
    author: "Nicole Khallie",
    blocks: [
      {
        type: "paragraph",
        content: "Three new restaurants opened this month, and of course, we went to try them!"
      },
      {
        type: "paragraph",
        content: "The first restaurant we went to, Food Hub, is a good place to just hang out. It is easily the most affordable of the three restaurants. Try their steak and fries or lamb chop for your main course. They serve great desserts too!"
      },
      {
        type: "images",
        images: []
      },
      {
        type: "paragraph",
        content: "Next we visited Rare Basil. It is slightly classier than Food Hub and is great for a girls' night out. They serve amazing pasta. All pasta dishes come with a side of fish fillet, steak, or chicken."
      },
      {
        type: "images",
        images: []
      },
      {
        type: "paragraph",
        content: "The third restaurant, Palate Palace, is easily the classiest restaurant we visited. The food here is a little cheaper than at Rare Basil. They serve unique dishes like chicken with white chocolate sauce and chocolate cake with chili."
      },
      {
        type: "images",
        images: []
      }
    ],
    closingQuestion: "Have you visited these restaurants? Share your favorite dish in the comments section below!"
  },
  tutorSteps: [
    {
      instruction: "Introduce Challenge 1.",
      scripts: [
        { text: "Okay, now let's do the Challenge." },
        { text: "First we have Challenge 1." }
      ]
    },
    { instruction: "Read the situation." },
    {
      instruction: "Confirm the student's understanding.",
      scripts: [{ text: "Is it clear?" }]
    },
    {
      instruction: "Set up the reading.",
      scripts: [{ text: "Let's read the online article." }]
    },
    { instruction: "Have the student read the reading text aloud." },
    {
      instruction: "After they finish reading, correct their pronunciation mistakes.",
      tips: [
        { text: "Limit this to 2-3 corrections." },
        { text: "If the student made a lot of mistakes, focus on the biggest ones." }
      ]
    },
    {
      instruction: "Set up the roleplay.",
      scripts: [
        { text: "Now, I'll be your coworker." },
        { text: "Please talk to me about which restaurant to go to." },
        { text: "Remember to use today's grammar tip." },
        { text: "Is it clear?" },
        { text: "I'll start." }
      ]
    },
    {
      instruction: "Ask the questions below.",
      tips: [
        { text: "Use the questions below only as guides. Ask other questions based on the flow of the conversation." },
        { text: "Make sure that you simulate a real-life situation." },
        { text: "Change your tone according to the character you are playing." }
      ]
    }
  ],
  questionsIntro: "(Talk about your day first.)",
  questions: [
    {
      question: "I'm tired and hungry! How about you?",
      hints: []
    },
    {
      question: "Do you know any new restaurants we can try?",
      hints: []
    },
    {
      question: "What kind of food do they serve at (restaurant name)?",
      hints: ["(Ask about the other restaurants.)"]
    },
    {
      question: "Which has the most interesting dishes?",
      hints: []
    },
    {
      question: "Which is the most affordable?",
      hints: []
    },
    {
      question: "I can't decide... They all sound good. Which one do you want to go to?",
      hints: []
    },
    {
      question: "Can we go there without a reservation?",
      hints: ["(Thank the student for suggesting new restaurants.)"]
    }
  ]
};

// Default data for Listening type
const DEFAULT_LISTENING_DATA: MissionSectionData = {
  sectionNumber: 5,
  sectionTitle: "MISSION",
  missionType: "listening",
  challengeNumber: 1,
  challengeName: "Challenge 1",
  duration: "5-6 minutes",
  situation: "Listen to your friend talk about some dishes that he/she ate at a Thai restaurant.",
  situationTranslation: "友達がタイ料理屋で食べた料理についての話を聞きましょう。",
  instruction: "Then, go to the restaurant and try to order the same dishes.",
  instructionTranslation: "それから、そのレストランに行って、同じものを注文してみましょう。",
  showGrammarTip: true,
  grammarTipTitle: "Today's grammar tip",
  grammarTipItems: ["past participle adjectives"],
  image: "",
  tutorSteps: [
    {
      instruction: "Introduce Challenge 1.",
      scripts: [
        { text: "Okay, now let's do the Challenge." },
        { text: "First we have Challenge 1." }
      ]
    },
    { instruction: "Read the situation." },
    {
      instruction: "Confirm the student's understanding.",
      scripts: [{ text: "Is it clear?" }]
    },
    {
      instruction: "Set up the listening.",
      scripts: [
        { text: "First, let's listen to your friend talk about some dishes he/she ate." },
        { text: "I'll be your friend." },
        { text: "Is it clear?" },
        { text: "Okay, I'll start." }
      ]
    },
    {
      instruction: "Read the listening script below, emphasizing the underlined words.",
      listeningScript: `Hey, (student's name)! I found this amazing Thai restaurant. The dishes were so good! The dish names were all in Thai, so I forgot them. Sorry. Anyway, for your appetizer, I recommend the <u>sweet and spicy salad with sliced green beans and tomatoes</u>. It also has <u>salted crab and crushed peanuts</u>. It's delicious. You should try it! For your main meal, try their <u>fried rice with sliced cucumber on the side</u>. Oh, the soup is also really nice. It has <u>sliced chicken in coconut and spices</u>. For dessert, try their special fruit shake. It's <u>blended with fruits like mango and pineapple</u>.`
    },
    {
      instruction: "Set up the roleplay.",
      scripts: [
        { text: "Now, I'll be the waiter/waitress." },
        { text: "Please order the dishes your friend talked about." },
        { text: "Remember to use today's grammar tip." },
        { text: "Is it clear?" },
        { text: "I'll start." }
      ]
    },
    {
      instruction: "Ask the questions below.",
      tips: [
        { text: "Use the questions below only as guides. Ask other questions based on the flow of the conversation." },
        { text: "Make sure that you simulate a real-life situation." },
        { text: "Change your tone according to the character you are playing." }
      ]
    }
  ],
  questionsIntro: "(Greet the customer.)",
  questions: [
    { question: "Table for how many?", hints: [] },
    { question: "Would you like a seat inside the restaurant or outside for fresh air?", hints: [] },
    { question: "Have you eaten here before?", hints: [] },
    {
      question: "What would you like for an appetizer?",
      hints: [
        "(For an appetizer, if the student is struggling, offer the following.)",
        "spicy soup with fresh shrimp (tom yum)",
        "stir-fried noodles (pad thai)",
        "sweet and spicy salad with green beans and tomatoes, with salted crab and crushed peanuts (som tum)"
      ]
    },
    {
      question: "What would you like for your main course?",
      hints: [
        "(For main course, if the student is struggling, offer the following.)",
        "fried rice with sliced cucumbers (khao pad)",
        "soup with sliced chicken in coconut and spices (tom kha kai)",
        "smoked duck",
        "roast beef"
      ]
    },
    {
      question: "How about for your dessert? Or drinks?",
      hints: [
        "(For dessert or drinks, if the student is struggling, offer the following.)",
        "fruit shake (blended with two kinds of fruits)",
        "fried banana with ice cream",
        "iced coffee",
        "freshly squeezed mango juice"
      ]
    },
    { question: "Do you need anything else?", hints: ["(Repeat the student's order and say how long it will take the order to arrive.)"] }
  ]
};

const DEFAULT_EXERCISE_DATA: ExerciseSectionData = {
  sectionNumber: 4,
  sectionTitle: "EXERCISE",
  duration: "3 minutes",
  // Step A type
  stepAType: "rephrase",
  // Step A - Rephrase
  stepAName: "STEP A",
  instructions: "Rephrase the sentences using the expressions in the box. Some expressions may be used more than once, and the form of some expressions may need to be changed.",
  instructionsTranslation: undefined,
  showExpressions: false,
  expressions: ["a negative connotation", "an insult", "gesticulate"],
  showExample: false,
  exampleSentence: "ex. Lizzy always moves her hands around when she argues.",
  exampleAnswer: "Lizzy always gesticulates when she argues.",
  exampleImage: "",
  exerciseItems: [
    { image: "", sentence: "In some countries, it's considered offensive to tip a waiter." },
    { image: "", sentence: "Carl just found out that the word mashi in Japanese doesn't have a positive meaning. He thought it was just used to describe the better of two options!" },
    { image: "", sentence: "Two men were arguing and waving their hands and arms wildly on the train this morning." },
    { image: "", sentence: "Linda wasn't aware that the American slang word she used had a bad meaning in the UK." },
    { image: "", sentence: "In China, it's considered rude to point the spout of a teapot at someone when serving tea." }
  ],
  // Step A - Choose (empty by default)
  chooseItems: [
    { sentence: "He (doesn't / don't) eat breakfast." },
    { sentence: "She does (she / her) hair for an hour!" },
    { sentence: "I (get / gets) dressed before breakfast." },
    { sentence: "They (doesn't / don't) drink tea for breakfast." }
  ],
  chooseImage: "",
  // Step A - Change type defaults
  changeItems: [
    { sentence: "I need to find a place to stay tonight. <u>Is there a nice hotel around here?</u>" },
    { sentence: "I want to go shopping for clothes tomorrow. <u>Where's the mall?</u>" },
    { sentence: "That restaurant has really good reviews. <u>Is it expensive?</u>" },
    { sentence: "I'd like to buy some fresh fruits and vegetables. <u>Where's the market?</u>" }
  ],
  // Step A - Info Box (disabled by default)
  showInfoBox: false,
  infoBox: {
    title: "Comparison Table",
    rowLabels: ["$", "❤️", "🙂"],
    columns: [
      { header: "Option A", rows: ["$", "❤️❤️", "🙂🙂🙂"] },
      { header: "Option B", rows: ["$$", "❤️❤️❤️", "🙂🙂"] },
      { header: "Option C", rows: ["$$$", "❤️", "🙂"] }
    ]
  },
  answers: [
    { text: "In some countries, it's an insult to tip a waiter." },
    { text: "Carl just found out that the word mashi in Japanese has a negative connotation. He thought it was just used to describe the better of two options!" },
    { text: "Two men were arguing and gesticulating wildly on the train this morning." },
    { text: "Linda wasn't aware that the American slang word she used had a negative connotation in the UK." },
    { text: "In China, it's an insult to point the spout of a teapot at someone when serving tea." }
  ],
  tutorSteps: [
    {
      instruction: "Introduce Exercise.",
      scripts: [
        { text: "Okay, now let's do Exercise." },
        { text: "We're going to practice the expressions we learned earlier." }
      ]
    },
    { instruction: "Read the instructions." },
    { instruction: "Read the example." },
    {
      instruction: "Confirm the student's understanding.",
      scripts: [{ text: "Is it clear?" }]
    },
    { instruction: "Have the student read the first sentence." },
    {
      instruction: "Ask them to rephrase the sentence.",
      scripts: [{ text: "Please rephrase the sentence using one of the expressions in the box." }],
      tips: [{ text: "The student should read the full sentence." }]
    },
    {
      instruction: "Repeat Steps 5-6 with the remaining sentences.",
      tips: [{ text: "Student's answers may vary. Accept any grammatically correct answers." }]
    },
    {
      instruction: "Transition to the next section.",
      scripts: [{ text: "Great! Let's go to the next section!" }]
    }
  ],
  // Step B - (optional)
  hasStepB: false,
  stepBType: "conversation",
  stepBName: "STEP B",
  stepBInstruction: "Complete the speech using your own information.",
  stepBInstructionTranslation: undefined,
  // Step B - Conversation type
  conversations: [
    { speakerImage: '', speechBubble: 'Hi! My name is _____. I\'m from _____.', position: 'left' },
    { speakerImage: '', speechBubble: 'Nice to meet you! What do you do?', position: 'right' }
  ],
  // Step B - Multiple Choice type
  multipleChoiceItems: [
    { boldSentence: "Dante Mercado's Fireworks by the River is such a remarkable film.", optionA: "It's very similar to many other movies made that year.", optionB: "It stands out from many other movies made that year." },
    { boldSentence: "If I had the courage to talk to her, I'd tell her what an excellent pianist she is.", optionA: "The way she plays is very emotional and moving.", optionB: "I don't think she understands what you need to become good at playing the piano." },
    { boldSentence: "James thinks the world of his mother.", optionA: "He thinks she focused on her work too much when he was growing up.", optionB: "He recognizes how tough it must have been to raise five children while working." }
  ],
  multipleChoiceImage: "",
  // Step B - Speech type
  speechSpeakerImage: "",
  speechContent: "I (often / sometimes / rarely) go to karaoke. I think that it's _____ to sing your heart out. I usually go (alone / with _____) because I feel like going wild in front of other people is _____. My favorite song to sing at karaoke is _____. I think I sound great when I sing it! I'm a little off-key when I sing _____, though, so I rarely choose to do that song.",
  // Step B - Compare type
  compareWordBox: ["a little", "far", "a lot", "easily"],
  compareImages: [
    { image: "", label: "Restaurant A" },
    { image: "", label: "Restaurant B" },
    { image: "", label: "Restaurant C" }
  ],
  compareExample: undefined,
  compareItems: [
    { sentence: "(Restaurant B and C: romantic)" },
    { sentence: "(Restaurant A, B, and C: exclusive)" },
    { sentence: "(Restaurant A and C: pricy)" }
  ],
  stepBTutorSteps: [
    {
      instruction: "Introduce Step B.",
      scripts: [{ text: "Now let's practice a conversation." }]
    },
    { instruction: "Read the instructions." },
    {
      instruction: "Have the student complete the speech bubbles.",
      tips: [{ text: "Encourage the student to use their own information." }]
    }
  ]
};

// Default Speak Your Mind template
const DEFAULT_SPEAK_YOUR_MIND: SpeakYourMindData = {
  stepName: "STEP B SPEAK YOUR MIND",
  duration: "1 minute",
  explanation: "Sometimes you want to say what you would do if you were in someone else's situation.",
  explanationTranslation: undefined,
  speaker1: {
    image: "",
    speechBubble: "My coworker watches cat videos online at work all day. Do you think I should tell my boss?"
  },
  speaker2: {
    image: "",
    speechBubble: "<strong>If I were you, I would</strong> just ignore it. Don't you always text me while you're at work?"
  },
  question: "",
  tutorSteps: [
    { instruction: "Introduce Step B.", script: "Okay, now let's do Step B Speak Your Mind.", tip: null },
    { instruction: "Read the bold explanation.", script: null, tip: null },
    { instruction: "Do the conversation with the student.", script: null, tip: "The student should read the speech bubble with the bolded phrase." },
    { instruction: "Highlight the bolded part as today's Speak Your Mind phrase.", script: "Okay, the bolded part is today's Speak Your Mind phrase.", tip: null },
    { instruction: "Read just the bolded part one more time and have the student repeat.", script: null, tip: null },
    { instruction: "Ask the question below.", script: null, tip: "The student doesn't have to talk a lot. We just want to test their understanding of the phrase.", question: "What advice would you give the man on the left?" },
    { instruction: "Transition to the next step.", script: "Fantastic! Let's go to the next step!", tip: null },
  ]
};

const DEFAULT_STEP_B_DATA: StepBData = {
  stepType: 'speak-your-mind',
  speakYourMind: DEFAULT_SPEAK_YOUR_MIND
};

// Default Grammar Tip template
const DEFAULT_GRAMMAR_TIP: GrammarTipData = {
  stepName: "STEP B GRAMMAR TIP",
  duration: "1 minute",
  explanations: [
    {
      ruleText: "<strong>Use simple present tense to talk about facts or routine.</strong>",
      ruleTranslation: "現在形を使って事実や日課について話すことができます。",
      examplesTitle: undefined,
      examples: undefined
    },
    {
      ruleText: "Use the dictionary form of the verb with <em>I</em>, <em>you</em>, <em>we</em>, and <em>they</em>.",
      ruleTranslation: "主語がI、you、we、theyのときには、動詞の原形を使いましょう。",
      examplesTitle: "EXAMPLES",
      examples: [
        { sentence: "I <strong>wake up</strong> at 7 a.m.", translation: "私は午前7時に起きます。" },
        { sentence: "You <strong>wash</strong> the dishes.", translation: "あなたは皿を洗います。" },
        { sentence: "We <strong>make</strong> waffles.", translation: "私たちはワッフルを作ります。" },
        { sentence: "They <strong>eat</strong> breakfast every day.", translation: "彼らは毎日朝ごはんを食べます。" }
      ]
    },
    {
      ruleText: "For negative sentences, add <em>don't</em> before the verb.",
      ruleTranslation: "否定文では、動詞の前にdon't を置きます。",
      examplesTitle: "EXAMPLE",
      examples: [
        { sentence: "I <strong>don't wake up</strong> at 7 a.m.", translation: "私は午前7時に起きません。" }
      ]
    }
  ],
  tutorSteps: [
    { instruction: "Introduce Step B Grammar Tip.", script: "Okay, now let's do Step B Grammar Tip.", tip: null },
    { instruction: "Read the bold grammar tip.", script: null, tip: null },
    { instruction: "Read the unbolded explanation part(s). Have the student read the example sentences.", script: null, tip: null },
    { instruction: "Confirm the student's understanding.", script: "Is it clear?", tip: null },
    { instruction: "Transition to the next section.", script: "Very good! Let's go to the next section!", tip: null },
  ]
};

// Default Pronunciation template
const DEFAULT_STEPB_PRONUNCIATION: StepBPronunciationData = {
  stepName: "STEP B PRONUNCIATION",
  duration: "1-2 minutes",
  tip: "When one word ends with a consonant sound and the next word starts with a vowel sound, they are often linked together.",
  phrases: [
    {
      phrase: "cost a fortune",
      pronunciationGuide: "/ cos-ta fortune /",
      exampleSentence: "The taxi ride from the airport <strong>/ cos-ta fortune /</strong>!"
    },
    {
      phrase: "cost an arm and a leg",
      pronunciationGuide: "/ cos-ta-nar-man-da leg /",
      exampleSentence: "Staying at a five-star hotel will <strong>/ cos-ta-nar-man-da leg /</strong>."
    }
  ],
  tutorSteps: [
    { instruction: "Introduce Step B.", script: "Okay, now let's do Step B.", tip: null },
    { instruction: "Read the bold pronunciation tip.", script: null, tip: null },
    { instruction: "Read the first phrase and have the student repeat.", script: null, tip: "Use the bold pronunciation guide under the phrase." },
    { instruction: "Read the example sentence and have the student repeat.", script: null, tip: null },
    { instruction: "Repeat Steps 3-4 with the remaining phrase(s) and example sentence(s).", script: null, tip: null },
    { instruction: "Transition to the next step.", script: "Fantastic! Let's go to the next step!", tip: null },
  ]
};

// ============================================================================
// RICH TEXT INPUT COMPONENT
// Supports Ctrl+B for bold, Ctrl+I for italic
// ============================================================================

interface RichTextInputProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  singleLine?: boolean;
}

function RichTextInput({ value, onChange, placeholder, className = '', singleLine = true }: RichTextInputProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasFocus, setHasFocus] = useState(false);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold', false);
      // Trigger change after command
      if (ref.current) {
        onChange(ref.current.innerHTML);
      }
    }
    // Ctrl+I for italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic', false);
      if (ref.current) {
        onChange(ref.current.innerHTML);
      }
    }
    // Ctrl+U for underline
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      document.execCommand('underline', false);
      if (ref.current) {
        onChange(ref.current.innerHTML);
      }
    }
    // Prevent Enter in single line mode
    if (singleLine && e.key === 'Enter') {
      e.preventDefault();
    }
  };

  // Handle input changes
  const handleInput = () => {
    if (ref.current) {
      onChange(ref.current.innerHTML);
    }
  };

  // Handle paste - strip non-formatting HTML
  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
  };

  // Update content when value prop changes (but not during editing)
  useEffect(() => {
    if (ref.current && !hasFocus) {
      // Only update if different to avoid cursor jumping
      if (ref.current.innerHTML !== value) {
        ref.current.innerHTML = value || '';
      }
    }
  }, [value, hasFocus]);

  // Initial setup
  useEffect(() => {
    if (ref.current && !ref.current.innerHTML) {
      ref.current.innerHTML = value || '';
    }
  }, []);

  const showPlaceholder = !value && !hasFocus;

  return (
    <div className={`csve-rich-text-wrapper ${className}`}>
      <div
        ref={ref}
        className={`csve-rich-text-input ${showPlaceholder ? 'csve-placeholder' : ''}`}
        contentEditable
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        data-placeholder={placeholder}
        spellcheck={false}
      />
      <div className="csve-rich-text-hint">
        <kbd>Ctrl</kbd>+<kbd>B</kbd> bold &nbsp; <kbd>Ctrl</kbd>+<kbd>I</kbd> italic
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/** Heuristic: lines starting with a number+punctuation are tutor dialogue */
const DIALOGUE_RE = /^\s*\d+[.):]/ ;
const isDialogueScript = (text: string) => !text || DIALOGUE_RE.test(text);

/** Build an interleaved list of scripts + prompts for the editor, distributing prompts BEFORE each numbered question */
function interleaveForEditor(
  scripts: { text: string }[],
  prompts: { text: string }[],
): { text: string; kind: 'script' | 'prompt'; sourceIdx: number; isDialogue: boolean }[] {
  const out: { text: string; kind: 'script' | 'prompt'; sourceIdx: number; isDialogue: boolean }[] = [];
  const NUMBERED_RE = /^\s*\d+[.):/]/;
  // Find the index of the first and last numbered script
  let firstNum = -1, lastNum = -1;
  for (let i = 0; i < scripts.length; i++) {
    if (NUMBERED_RE.test(scripts[i].text)) {
      if (firstNum === -1) firstNum = i;
      lastNum = i;
    }
  }
  // Separate: before-intro scripts, numbered scripts, after-closing scripts
  const beforeIdxs: number[] = [];
  const numberedIdxs: number[] = [];
  const afterIdxs: number[] = [];
  for (let i = 0; i < scripts.length; i++) {
    if (NUMBERED_RE.test(scripts[i].text)) numberedIdxs.push(i);
    else if (firstNum === -1 || i < firstNum) beforeIdxs.push(i);
    else afterIdxs.push(i);
  }
  // Helper: scripts are dialogue (green) unless they are parenthetical directions
  const scriptIsDlg = (text: string) => !/^\s*\(/.test(text);

  // Intro scripts at top
  for (const si of beforeIdxs) {
    out.push({ text: scripts[si].text, kind: 'script', sourceIdx: si, isDialogue: scriptIsDlg(scripts[si].text) });
  }
  if (numberedIdxs.length > 0 && prompts.length > 0) {
    const perQ = Math.ceil(prompts.length / numberedIdxs.length);
    let pi = 0;
    numberedIdxs.forEach((si, qIdx) => {
      const take = qIdx === numberedIdxs.length - 1 ? prompts.length - pi : perQ;
      for (let j = 0; j < take && pi < prompts.length; j++, pi++)
        out.push({ text: prompts[pi].text, kind: 'prompt', sourceIdx: pi, isDialogue: false });
      out.push({ text: scripts[si].text, kind: 'script', sourceIdx: si, isDialogue: true });
    });
    while (pi < prompts.length) { out.push({ text: prompts[pi].text, kind: 'prompt', sourceIdx: pi, isDialogue: false }); pi++; }
  } else {
    for (const si of numberedIdxs) {
      out.push({ text: scripts[si].text, kind: 'script', sourceIdx: si, isDialogue: true });
    }
    for (let pi = 0; pi < prompts.length; pi++) {
      out.push({ text: prompts[pi].text, kind: 'prompt', sourceIdx: pi, isDialogue: false });
    }
  }
  // Closing scripts at bottom
  for (const si of afterIdxs) {
    out.push({ text: scripts[si].text, kind: 'script', sourceIdx: si, isDialogue: scriptIsDlg(scripts[si].text) });
  }
  return out;
}

export default function ConversationalSkillsVisualEditor() {
  const { params } = useRoute();
  const [lesson, setLesson] = useState<LessonMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'pending' | 'saved'>('idle');
  const [showHelpManual, setShowHelpManual] = useState(false);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasUnsavedChangesRef = useRef(false);

  // Editable state - styling
  const [backgroundImage, setBackgroundImage] = useState('');
  const [overlayColor, setOverlayColor] = useState('#134e4acc');
  
  // Editable state - text content
  const [chapterName, setChapterName] = useState('');
  const [lessonName, setLessonName] = useState('');
  const [goalTextEn, setGoalTextEn] = useState('');
  const [goalTextJp, setGoalTextJp] = useState('');
  
  // Introduction section state (lifted up from IntroductionSectionEditor)
  const [introductionData, setIntroductionData] = useState<IntroductionData>(DEFAULT_INTRODUCTION_DATA);
  
  // Learn section state
  const [learnData, setLearnData] = useState<LearnSectionData>(DEFAULT_LEARN_DATA);
  
  // Step B section state
  const [stepBData, setStepBData] = useState<StepBData>(DEFAULT_STEP_B_DATA);
  
  // Apply section state (Section 3 - Understanding/Speaking)
  const [applyData, setApplyData] = useState<ApplySectionData>(DEFAULT_APPLY_DATA);
  
  // Exercise section state (Section 4)
  const [exerciseData, setExerciseData] = useState<ExerciseSectionData>(DEFAULT_EXERCISE_DATA);
  
  // Mission section state (Section 5)
  const [missionData, setMissionData] = useState<MissionSectionData>(DEFAULT_MISSION_DATA);
  const [missionData2, setMissionData2] = useState<MissionSectionData>(DEFAULT_DISCUSSION_DATA);
  
  // Feedback section state (Section 6)
  const [feedbackData, setFeedbackData] = useState<FeedbackSectionData>(DEFAULT_FEEDBACK_DATA);
  
  // Story data (K-Drama Style Immersive Learning)
  const [storyData, setStoryData] = useState<StoryData>(DEFAULT_STORY_DATA);
  
  // UI state
  const [activeElement, setActiveElement] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [theme, setTheme] = useState<ConversationalTheme>(getStoredConversationalTheme);

  const id = params?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      loadLesson(id);
    }
  }, [id]);

  const loadLesson = async (lessonId: string) => {
    try {
      setLoading(true);
      const data = await getLessonById(lessonId);
      setLesson(data);
      setBackgroundImage(data.backgroundImage || '');
      setOverlayColor(data.overlayColor || '#134e4acc');
      setChapterName(data.chapterName || '');
      setLessonName(data.lessonName || '');
      setGoalTextEn(data.goalTextEn || '');
      setGoalTextJp(data.goalTextJp || '');
      
      // Load introduction data from lesson if available
      if (data.introductionData) {
        setIntroductionData(data.introductionData);
      }
      
      // Load learn data from lesson if available
      if (data.learnData) {
        setLearnData(data.learnData);
      }
      
      // Load step B data from lesson if available
      if (data.stepBData) {
        setStepBData(data.stepBData);
      }
      
      // Load apply data from lesson if available
      if (data.applyData) {
        setApplyData(data.applyData);
      }
      
      // Load exercise data from lesson if available
      if (data.exerciseData) {
        const loadedExercise = data.exerciseData as Partial<ExerciseSectionData>;
        setExerciseData({
          ...DEFAULT_EXERCISE_DATA,
          ...loadedExercise,
          showExpressions: loadedExercise.showExpressions ?? false,
          showExample: loadedExercise.showExample ?? false,
        });
      }
      
      // Load story data from lesson if available
      if (data.storyData) {
        setStoryData({ ...DEFAULT_STORY_DATA, ...data.storyData });
      }

      // Load mission data from lesson if available
      if (data.missionData) {
        setMissionData(data.missionData);
      }

      // Load mission 2 data from lesson if available
      if (data.missionData2) {
        setMissionData2(data.missionData2);
      }

      // Load feedback data from lesson if available
      if (data.feedbackData) {
        setFeedbackData(data.feedbackData);
      }
    } catch (err) {
      console.error('Failed to load lesson:', err);
      setError('Failed to load lesson');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!lesson) return;
    
    setSaving(true);
    try {
      const updated = await updateLessonHeader(lesson.id, {
        backgroundImage,
        overlayColor,
        chapterName,
        lessonName,
        goalTextEn,
        goalTextJp,
        introductionData,
        learnData,
        stepBData,
        applyData,
        exerciseData,
        storyData,
        missionData,
        missionData2,
        feedbackData,
      });
      setLesson(updated);
      setAutosaveStatus('saved');
      hasUnsavedChangesRef.current = false;
      
      // Only show toast if it's a manual save (when not triggered by autosave)
      // Autosave will show a subtle indicator instead
      if (autosaveStatus !== 'pending') {
        toast.success('Changes saved!');
      }
      
      // Clear saved status after 2 seconds
      setTimeout(() => {
        setAutosaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('Failed to save:', err);
      if (autosaveStatus !== 'pending') {
        toast.error('Failed to save changes');
      }
      setAutosaveStatus('idle');
    } finally {
      setSaving(false);
    }
  };

  // Trigger autosave with debounce
  const triggerAutosave = () => {
    hasUnsavedChangesRef.current = true;
    setAutosaveStatus('pending');
    
    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    
    // Set new timer
    autosaveTimerRef.current = setTimeout(() => {
      if (hasUnsavedChangesRef.current) {
        handleSave();
      }
    }, AUTOSAVE_DELAY_MS);
  };

  // Autosave effect - watches for changes in all editable fields
  useEffect(() => {
    triggerAutosave();
  }, [
    backgroundImage,
    overlayColor,
    chapterName,
    lessonName,
    goalTextEn,
    goalTextJp,
    introductionData,
    learnData,
    stepBData,
    applyData,
    exerciseData,
    missionData,
    missionData2,
    feedbackData,
  ]);

  const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setBackgroundImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenPreview = (layout: 1 | 2) => {
    if (!lesson) return;
    sessionStorage.setItem(`preview-${lesson.id}`, JSON.stringify({
      levelBadge: lesson.levelBadge,
      skill: lesson.skill,
      chapter: lesson.chapter,
      lessonNumber: lesson.lessonNumber,
      theme,
      backgroundImage,
      overlayColor,
      chapterName,
      lessonName,
      goalTextEn,
      goalTextJp,
      introductionData,
      learnData,
      stepBData,
      applyData,
      exerciseData,
      missionData,
      missionData2,
      feedbackData,
    }));
    const url = `/conversational-skills-preview/${lesson.id}${layout === 2 ? '?layout=2' : ''}`;
    window.open(url, '_blank');
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('csve-theme', next);
    } catch {}
  };

  const handleBack = () => {
    window.location.href = `/conversational-skills-editor`;
  };

  // Parse overlay color
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

  // ============================================================================
  // LOADING & ERROR STATES
  // ============================================================================

  if (loading) {
    return (
      <div className="csve-fullpage csve-loading">
        <div className="csve-loader">
          <i className="ri-loader-4-line" />
          <p>Loading editor...</p>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="csve-fullpage csve-error">
        <i className="ri-error-warning-line" />
        <h2>{error || 'Lesson not found'}</h2>
        <button onClick={handleBack}>Go Back</button>
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`csve-fullpage csve-${theme}`}>
      {/* AI Content Generator Widget */}
      <AIContentGenerator
        topic={lessonName}
        skillLevel={lesson.levelBadge}
        skill={lesson.skill}
        currentIntroductionData={introductionData}
        onGenerateIntroduction={setIntroductionData}
        onGenerateLearn={setLearnData}
        onGenerateStepB={setStepBData}
        onGenerateApply={setApplyData}
        onGenerateTrivia={(triviaPayload) => {
          // Update only the trivia-related fields in applyData
          setApplyData((prev) => ({
            ...prev,
            triviaEnabled: triviaPayload.triviaEnabled ?? true,
            triviaText: triviaPayload.triviaText || '',
            triviaTranslation: triviaPayload.triviaTranslation || '',
            triviaImage: triviaPayload.triviaImage || '',
            triviaDuration: triviaPayload.triviaDuration || '1 minute',
            triviaTutorSteps: triviaPayload.triviaTutorSteps || [],
          }));
        }}
        level={lesson.level}
        chapter={lesson.chapter}
        lessonNumber={lesson.lessonNumber}
        lessonGoal={goalTextEn || lessonName}
        currentStepAType={learnData.steps[0]?.stepType || 'vocabulary'}
        currentStepBType={stepBData.stepType}
        vocabularyCount={learnData.steps[0]?.vocabularyItems?.length || 0}
        expressionCount={learnData.steps[0]?.expressionItems?.length || 0}
        currentApplyType={applyData.activityType}
        dialogueLineCount={applyData.dialogueLines?.length || 0}
        currentExerciseStepAType={exerciseData.stepAType}
        currentExerciseStepBType={exerciseData.stepBType}
        exerciseItemCount={
          exerciseData.stepAType === 'rephrase' ? exerciseData.exerciseItems?.length :
          exerciseData.stepAType === 'choose' ? exerciseData.chooseItems?.length :
          exerciseData.changeItems?.length || 0
        }
        hasExerciseStepB={exerciseData.hasStepB}
        onGenerateExercise={(payload) => {
          // Update exerciseData based on payload step
          if (payload.exerciseStep === 'stepA') {
            setExerciseData((prev) => ({
              ...prev,
              stepAType: payload.exerciseType,
              instructions: payload.instructions || prev.instructions,
              instructionsTranslation: payload.instructionsTranslation || prev.instructionsTranslation,
              showExpressions: payload.showExpressions ?? prev.showExpressions,
              expressions: payload.expressions?.length > 0 ? payload.expressions : prev.expressions,
              showExample: payload.showExample ?? prev.showExample,
              exampleSentence: payload.exampleSentence || prev.exampleSentence,
              exampleAnswer: payload.exampleAnswer || prev.exampleAnswer,
              exerciseItems: payload.exerciseItems?.length > 0 ? payload.exerciseItems : prev.exerciseItems,
              chooseItems: payload.chooseItems?.length > 0 ? payload.chooseItems : prev.chooseItems,
              changeItems: payload.changeItems?.length > 0 ? payload.changeItems : prev.changeItems,
              answers: payload.answers?.length > 0 ? payload.answers : prev.answers,
              tutorSteps: payload.tutorSteps?.length > 0 ? payload.tutorSteps : prev.tutorSteps,
            }));
          } else {
            // Step B
            setExerciseData((prev) => ({
              ...prev,
              stepBType: payload.exerciseType,
              stepBInstruction: payload.stepBInstruction || prev.stepBInstruction,
              stepBInstructionTranslation: payload.stepBInstructionTranslation || prev.stepBInstructionTranslation,
              conversations: payload.conversations?.length > 0 ? payload.conversations : prev.conversations,
              multipleChoiceItems: payload.multipleChoiceItems?.length > 0 ? payload.multipleChoiceItems : prev.multipleChoiceItems,
              speechContent: payload.speechContent || prev.speechContent,
              compareWordBox: payload.compareWordBox?.length > 0 ? payload.compareWordBox : prev.compareWordBox,
              compareImages: payload.compareImages?.length > 0 ? payload.compareImages : prev.compareImages,
              compareExample: payload.compareExample || prev.compareExample,
              compareItems: payload.compareItems?.length > 0 ? payload.compareItems : prev.compareItems,
              stepBTutorSteps: payload.stepBTutorSteps?.length > 0 ? payload.stepBTutorSteps : prev.stepBTutorSteps,
            }));
          }
        }}
        currentMissionType={missionData.missionType}
        missionQuestionCount={missionData.questions?.length || 0}
        onGenerateMission={(payload) => {
          // Update missionData based on payload missionType
          setMissionData((prev) => ({
            ...prev,
            missionType: payload.missionType || prev.missionType,
            challengeNumber: payload.challengeNumber || prev.challengeNumber,
            challengeName: payload.challengeName || prev.challengeName,
            duration: payload.duration || prev.duration,
            situation: payload.situation || prev.situation,
            situationTranslation: payload.situationTranslation || prev.situationTranslation,
            instruction: payload.instruction || prev.instruction,
            instructionTranslation: payload.instructionTranslation || prev.instructionTranslation,
            showGrammarTip: payload.showGrammarTip ?? prev.showGrammarTip,
            grammarTipTitle: payload.grammarTipTitle || prev.grammarTipTitle,
            grammarTipItems: payload.grammarTipItems?.length > 0 ? payload.grammarTipItems : prev.grammarTipItems,
            tutorSteps: payload.tutorSteps?.length > 0 ? payload.tutorSteps : prev.tutorSteps,
            questionsIntro: payload.questionsIntro || prev.questionsIntro,
            questions: payload.questions?.length > 0 ? payload.questions : prev.questions,
            // Discussion type specific
            isOptional: payload.isOptional ?? prev.isOptional,
            topics: payload.topics?.length > 0 ? payload.topics : prev.topics,
            // Reading type specific
            readingPassage: payload.readingPassage || prev.readingPassage,
            // Listening type specific (handled via tutorSteps with listeningScript)
          }));
        }}
        currentMission2Type={missionData2.missionType}
        mission2QuestionCount={missionData2.questions?.length || missionData2.topics?.reduce((acc, t) => acc + (t.questions?.length || 0), 0) || 0}
        onGenerateMission2={(payload) => {
          // Update missionData2 based on payload missionType
          setMissionData2((prev) => ({
            ...prev,
            missionType: payload.missionType || prev.missionType,
            challengeNumber: 2,
            challengeName: payload.challengeName || prev.challengeName,
            duration: payload.duration || prev.duration,
            situation: payload.situation || prev.situation,
            situationTranslation: payload.situationTranslation || prev.situationTranslation,
            instruction: payload.instruction || prev.instruction,
            instructionTranslation: payload.instructionTranslation || prev.instructionTranslation,
            showGrammarTip: payload.showGrammarTip ?? prev.showGrammarTip,
            grammarTipTitle: payload.grammarTipTitle || prev.grammarTipTitle,
            grammarTipItems: payload.grammarTipItems?.length > 0 ? payload.grammarTipItems : prev.grammarTipItems,
            tutorSteps: payload.tutorSteps?.length > 0 ? payload.tutorSteps : prev.tutorSteps,
            questionsIntro: payload.questionsIntro || prev.questionsIntro,
            questions: payload.questions?.length > 0 ? payload.questions : prev.questions,
            // Discussion type specific
            isOptional: payload.isOptional ?? prev.isOptional,
            topics: payload.topics?.length > 0 ? payload.topics : prev.topics,
            // Reading type specific
            readingPassage: payload.readingPassage || prev.readingPassage,
          }));
        }}
        sectionStatus={{
          introduce: !!(introductionData.introTexts?.some(t => t.text?.trim()) || introductionData.lessonGoalSteps?.length > 0),
          learn: !!((learnData.steps[0]?.vocabularyItems?.length ?? 0) > 0 || (learnData.steps[0]?.expressionItems?.length ?? 0) > 0),
          apply: !!(applyData.situationText?.trim() || applyData.dialogueLines?.length > 0 || applyData.readingText?.trim()),
          trivia: !!(applyData.triviaEnabled && applyData.triviaText?.trim()),
          exercise: !!(exerciseData.exerciseItems?.length > 0 || exerciseData.chooseItems?.length > 0 || exerciseData.changeItems?.length > 0),
          mission: !!(missionData.situation?.trim() || missionData.questions?.length > 0 || (missionData.topics?.length ?? 0) > 0),
          mission2: !!(missionData2.situation?.trim() || missionData2.questions?.length > 0 || (missionData2.topics?.length ?? 0) > 0),
        }}
        storyData={storyData}
        onUpdateStory={setStoryData}
        currentLearnData={{
          steps: learnData.steps.map(step => ({
            id: step.stepType || 'vocabulary',
            label: step.stepType === 'vocabulary' ? 'Vocabulary' : 'Expressions',
            items: step.stepType === 'vocabulary' 
              ? (step.vocabularyItems || []).map(item => ({
                  foreign: item.englishText || '',
                  foreignLabel: item.highlightedWord || '',
                  native: item.translation || '',
                }))
              : (step.expressionItems || []).map(item => ({
                  foreign: item.definitionLine?.replace(/<[^>]*>/g, '') || '',
                  foreignLabel: '',
                  native: item.translation || '',
                })),
          })),
          stepBType: stepBData.stepType,
          grammarTip: stepBData.stepType === 'grammar-tip' && stepBData.grammarTip ? {
            title: stepBData.grammarTip.stepName || 'Grammar Tip',
            items: stepBData.grammarTip.explanations?.map(exp => ({
              pattern: exp.ruleText?.replace(/<[^>]*>/g, '') || '',
              explanation: exp.ruleTranslation || '',
              example: exp.examples?.[0]?.sentence?.replace(/<[^>]*>/g, '') || '',
            })),
          } : undefined,
        }}
        currentApplyData={{
          activityType: applyData.activityType,
          situationText: applyData.situationText,
          dialogueLines: applyData.dialogueLines?.map(d => ({ speaker: d.speaker, text: d.text })),
          readingText: applyData.readingText,
          tutorSteps: applyData.tutorSteps?.map(s => ({
            instruction: s.instruction,
            scripts: s.scripts?.map(sc => ({ text: sc.text })),
            listeningScript: (s as any).listeningScript,
          })),
        }}
      />

      {/* Editor Toolbar - Fixed at top */}
      <div className="csve-toolbar">
        <div className="csve-toolbar-left">
          <button className="csve-toolbar-btn csve-back-btn" onClick={handleBack}>
            <i className="ri-arrow-left-line" />
            <span>Back</span>
          </button>
          <div className="csve-toolbar-divider" />
          <span className="csve-toolbar-title">
            <span className="csve-badge">{lesson.levelBadge}</span>
            Lesson {lesson.lessonNumber}: {lessonName}
          </span>
        </div>
        <div className="csve-toolbar-center">
          <span className="csve-edit-mode">
            <i className="ri-edit-line" />
            Visual Editor
          </span>
        </div>
        <div className="csve-toolbar-right">
          <button
            className="csve-toolbar-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} material theme`}
          >
            <i className={theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line'} />
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <button className="csve-toolbar-btn" onClick={() => setShowHelpManual(true)} title="Editor Manual">
            <i className="ri-question-line" />
            <span>Help</span>
          </button>
          <button className="csve-toolbar-btn csve-preview-btn" onClick={() => handleOpenPreview(1)}>
            <i className="ri-eye-line" />
            <span>Preview</span>
          </button>
          <button className="csve-toolbar-btn csve-preview-btn" onClick={() => handleOpenPreview(2)} title="Open the alternate lesson layout">
            <i className="ri-layout-grid-line" />
            <span>Preview 2</span>
          </button>
          <button 
            className="csve-toolbar-btn csve-save-btn" 
            onClick={handleSave}
            disabled={saving}
            title={autosaveStatus === 'pending' ? 'Autosaving...' : autosaveStatus === 'saved' ? 'Autosaved!' : 'Save or wait 5 seconds for autosave'}
          >
            <i className={`${
              autosaveStatus === 'saved' ? 'ri-check-line' : 
              autosaveStatus === 'pending' ? 'ri-loader-4-line' : 
              'ri-save-line'
            }`} />
            <span>
              {saving ? 'Saving...' : autosaveStatus === 'pending' ? 'Autosaving...' : autosaveStatus === 'saved' ? 'Saved!' : 'Save'}
            </span>
          </button>
        </div>
      </div>

      {/* Help Manual Modal */}
      {showHelpManual && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setShowHelpManual(false)}>
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(0,255,65,0.2)', borderRadius: '12px', width: '720px', maxWidth: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 40px rgba(0,255,65,0.08)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(0,255,65,0.15)' }}>
              <span style={{ color: '#00ff41', fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ri-book-open-line" /> Lesson Material Maker — Quick Manual
              </span>
              <button onClick={() => setShowHelpManual(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '20px', padding: '4px' }}>
                <i className="ri-close-line" />
              </button>
            </div>
            <div style={{ overflow: 'auto', padding: '20px 24px', color: '#ccc', fontSize: '13.5px', lineHeight: 1.7 }}>
              <style>{`.help-manual h2{color:#00ff41;font-size:16px;margin:20px 0 8px;border-bottom:1px solid rgba(0,255,65,.15);padding-bottom:6px}.help-manual h3{color:#4ade80;font-size:14px;margin:16px 0 6px}.help-manual h4{color:#86efac;font-size:13px;margin:12px 0 4px}.help-manual p,.help-manual li{color:#bbb;margin:4px 0}.help-manual ul,.help-manual ol{padding-left:20px;margin:4px 0}.help-manual strong{color:#e2e8f0}.help-manual table{width:100%;border-collapse:collapse;margin:8px 0}.help-manual th,.help-manual td{text-align:left;padding:6px 10px;border:1px solid rgba(255,255,255,.08)}.help-manual th{background:rgba(0,255,65,.06);color:#4ade80;font-weight:600}.help-manual td{color:#bbb}.help-manual hr{border:none;border-top:1px solid rgba(255,255,255,.06);margin:16px 0}.help-manual h2:first-child{margin-top:0}`}</style>
              <div className="help-manual">
                <h2>Overview</h2>
                <p>The Visual Editor is a WYSIWYG page builder for creating conversational English lesson materials. It provides inline text editing, section editors, a floating AI assistant, autosave, and an optional Story Mode for immersive K-drama style lessons.</p>

                <hr />
                <h2>Toolbar</h2>
                <table><thead><tr><th>Feature</th><th>Description</th></tr></thead><tbody>
                  <tr><td><strong>Back</strong></td><td>Returns to the lesson list</td></tr>
                  <tr><td><strong>Preview</strong></td><td>Opens student-facing preview in a new tab</td></tr>
                  <tr><td><strong>Save</strong></td><td>Manual save (autosave triggers 5 sec after any edit)</td></tr>
                </tbody></table>

                <hr />
                <h2>Hero Header</h2>
                <p>Click the header to open a side panel with:</p>
                <ul>
                  <li>Background image upload</li>
                  <li>Overlay color picker + opacity slider</li>
                  <li>Editable: <strong>Chapter Name</strong>, <strong>Lesson Name</strong>, <strong>Goal (EN)</strong>, <strong>Goal (JP/KR)</strong></li>
                </ul>

                <hr />
                <h2>Lesson Sections</h2>

                <h3>1. Introduce</h3>
                <ul>
                  <li>Intro paragraphs (multilingual) + optional image</li>
                  <li>Lesson Issue callout (title + bullet points)</li>
                  <li>Lesson Objective Steps (tutor guide)</li>
                </ul>

                <h3>2. Learn (Step A + Step B)</h3>
                <p><strong>Step A</strong> — choose one:</p>
                <ul>
                  <li><strong>Vocabulary</strong>: image + English text + highlighted word + translation</li>
                  <li><strong>Expressions</strong>: rich-text definition + example sentence + translation</li>
                </ul>
                <p><strong>Step B</strong> — choose one:</p>
                <ul>
                  <li><strong>Speak Your Mind</strong>: explanation + two-speaker dialogue + question</li>
                  <li><strong>Grammar Tip</strong>: grammar rules with translations + examples</li>
                  <li><strong>Pronunciation</strong>: tip + phrases with pronunciation guides</li>
                </ul>

                <h3>3. Apply</h3>
                <p>Choose one activity type:</p>
                <ul>
                  <li><strong>Speaking</strong>: situation + dialogue lines + tutor steps</li>
                  <li><strong>Listening</strong>: situation + listening script + comprehension questions</li>
                  <li><strong>Reading</strong>: situation + reading passage + tutor steps</li>
                </ul>
                <p>Optional <strong>Trivia Time</strong> sub-section available for all types.</p>

                <h3>4. Exercise (Step A + optional Step B)</h3>
                <p><strong>Step A</strong>: Rephrase / Choose / Change</p>
                <p><strong>Step B</strong> (optional): Conversation / Multiple Choice / Speech / Compare</p>
                <p>Both include Answer Keys and Tutor Guide Steps.</p>

                <h3>5. Mission (Challenge 1) &amp; Mission 2 (Challenge 2)</h3>
                <p>Choose one type per challenge:</p>
                <ul>
                  <li><strong>Speaking</strong>: roleplay scenario + questions with hints</li>
                  <li><strong>Discussion</strong>: topic cards with grouped personal questions</li>
                  <li><strong>Reading</strong>: reading passage + roleplay follow-up</li>
                  <li><strong>Listening</strong>: listening script + roleplay follow-up</li>
                </ul>

                <h3>6. Feedback (auto-populated)</h3>
                <p>4-point rubric + personalized feedback: Range, Accuracy, Fluency.</p>

                <hr />
                <h2>AI Content Generator</h2>
                <p>Toggle the floating <strong>magic wand</strong> button to open the AI panel.</p>

                <h3>Section Tabs</h3>
                <p>Seven tabs: Introduce, Learn, Apply, Trivia, Exercise, Mission, Mission 2. A <strong>✓</strong> badge shows which sections have content.</p>

                <h3>How to Generate</h3>
                <ol>
                  <li>Select the section tab you want</li>
                  <li>(Optional) Edit <strong>Base Instructions</strong> or add <strong>Additional Notes</strong></li>
                  <li>Click <strong>Generate [Section]</strong> — or <strong>Generate All</strong> for batch</li>
                  <li>Preview the result → click <strong>Insert Content</strong> to apply</li>
                </ol>

                <h3>Options</h3>
                <ul>
                  <li><strong>Generation Mode</strong>: Generate New or Improve Existing</li>
                  <li><strong>Include Translations</strong>: toggle + pick language (JP/KR/VN/CN)</li>
                  <li><strong>Step A/B toggle</strong>: for Learn and Exercise sections</li>
                </ul>

                <h3>Story Mode</h3>
                <p>When enabled, story context (characters, setting, plot points) is injected into AI generation.</p>
                <p><strong>Important</strong>: Generate sections in order (Introduce → Learn → Apply → Exercise → Mission) so each section continues the story. Apply must be generated before Mission.</p>

                <hr />
                <h2>Workflow Tips</h2>
                <ol>
                  <li><strong>Fill the header first</strong> — lesson name and goal are used by the AI</li>
                  <li><strong>AI reads your editor</strong> — it matches your current item counts and types</li>
                  <li><strong>Use Step A/B toggles</strong> — generate Learn and Exercise steps independently</li>
                  <li><strong>Preview often</strong> — check the student-facing view before saving</li>
                  <li><strong>Base Instructions persist</strong> — saved to your browser across sessions</li>
                  <li><strong>Autosave is active</strong> — changes save automatically after 5 seconds</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Canvas - The actual lesson layout */}
      <div className="csve-canvas" onClick={() => { setActiveElement(null); setEditingField(null); }}>
        {/* Top Navigation Bar */}
        <nav className="csve-topbar">
          <div className="csve-topbar-content">
            <span className="csve-course-info">
              Conversational Skills {lesson.levelBadge} | {lesson.skill.toUpperCase()} | Chapter {lesson.chapter}: {chapterName}
            </span>
          </div>
        </nav>

        {/* Hero Header Section - Clickable to edit */}
        <header
          className={`csve-hero ${activeElement === 'hero' ? 'csve-active' : ''}`}
          style={{
            backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          }}
          onClick={(e) => { e.stopPropagation(); setActiveElement('hero'); }}
        >
          <div className="csve-hero-overlay" style={{ backgroundColor: overlayColor }} />

          {/* Geometric accent shapes */}
          <div className="csve-hero-shape csve-hero-shape--tr1" />
          <div className="csve-hero-shape csve-hero-shape--tr2" />
          <div className="csve-hero-shape csve-hero-shape--bl1" />

          <div className="csve-hero-content">
            {/* Lesson Label */}
            <p className="csve-lesson-label">
              Lesson {lesson.lessonNumber}
            </p>
            
            {/* Lesson Name - Editable */}
            <h1 className="csve-lesson-name">
              <EditableText
                value={lessonName}
                onChange={setLessonName}
                isEditing={editingField === 'lessonName'}
                onStartEdit={() => setEditingField('lessonName')}
                onEndEdit={() => setEditingField(null)}
                placeholder="Lesson Name"
              />
            </h1>
            
            <div className="csve-goal-wrapper">
              <div className="csve-goal-row">
                <span className="csve-goal-badge">LESSON OBJECTIVE</span>
                {/* Goal Text English - Editable */}
                <p className="csve-goal-en">
                  <EditableText
                    value={goalTextEn}
                    onChange={setGoalTextEn}
                    isEditing={editingField === 'goalTextEn'}
                    onStartEdit={() => setEditingField('goalTextEn')}
                    onEndEdit={() => setEditingField(null)}
                    placeholder="Goal (English)"
                  />
                </p>
              </div>
              {/* Goal Text Korean/Japanese - Editable */}
              <p className="csve-goal-jp">
                <EditableText
                  value={goalTextJp}
                  onChange={setGoalTextJp}
                  isEditing={editingField === 'goalTextJp'}
                  onStartEdit={() => setEditingField('goalTextJp')}
                  onEndEdit={() => setEditingField(null)}
                  placeholder="Goal (Korean/Japanese)"
                />
              </p>
            </div>
          </div>

          {/* Edit indicator */}
          {!editingField && (
            <div className="csve-edit-indicator">
              <i className="ri-edit-line" />
              Click text to edit • Click header for styling
            </div>
          )}
        </header>

        {/* Content Sections */}
        <main className="csve-main">
          <div className="csve-sections">
            {/* Story Overview Section - K-Drama Style */}
            <StoryOverviewEditor
              data={storyData}
              onChange={(newData) => {
                setStoryData(newData);
                hasUnsavedChangesRef.current = true;
                triggerAutosave();
              }}
              lessonId={id || ''}
            />
            
            {/* Introduction Section - Matches Preview */}
            <IntroductionSectionEditor 
              data={introductionData}
              onChange={setIntroductionData}
            />
            
            <LearnSectionEditor 
              data={learnData}
              onChange={setLearnData}
            />
            
            <StepBSectionEditor 
              data={stepBData}
              onChange={setStepBData}
            />
            
            <ApplySectionEditor 
              data={applyData}
              onChange={setApplyData}
            />
            
            <ExerciseSectionEditor 
              data={exerciseData}
              onChange={setExerciseData}
            />
            
            <MissionSectionEditor 
              data={missionData}
              onChange={setMissionData}
            />
            
            <MissionSectionEditor 
              data={missionData2}
              onChange={setMissionData2}
              hideHeader={true}
            />
            
            <FeedbackSectionEditor 
              data={feedbackData}
              onChange={setFeedbackData}
            />
          </div>
        </main>
      </div>

      {/* Side Panel - Context-sensitive editing */}
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
                {['#0369a1', '#1e3a5f', '#134e4a', '#4c1d95', '#9f1239', '#1f2937'].map(color => (
                  <button
                    key={color}
                    className={`csve-preset ${baseColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                  />
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="csve-panel-divider" />

            {/* Text Fields Section */}
            <div className="csve-control">
              <label>Chapter Name</label>
              <input
                type="text"
                className="csve-text-input"
                value={chapterName}
                onChange={e => setChapterName((e.target as HTMLInputElement).value)}
                placeholder="e.g., All About Me"
              />
            </div>

            <div className="csve-control">
              <label>Lesson Name</label>
              <input
                type="text"
                className="csve-text-input"
                value={lessonName}
                onChange={e => setLessonName((e.target as HTMLInputElement).value)}
                placeholder="e.g., Greetings"
              />
            </div>

            <div className="csve-control">
              <label>Goal (English)</label>
              <input
                type="text"
                className="csve-text-input"
                value={goalTextEn}
                onChange={e => setGoalTextEn((e.target as HTMLInputElement).value)}
                placeholder="e.g., I can say basic greetings."
              />
            </div>

            <div className="csve-control">
              <label>Goal (Korean/Japanese)</label>
              <input
                type="text"
                className="csve-text-input"
                value={goalTextJp}
                onChange={e => setGoalTextJp((e.target as HTMLInputElement).value)}
                placeholder="e.g., 기본 인사를 할 수 있다."
              />
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

// ============================================================================
// EDITABLE TEXT COMPONENT
// ============================================================================

function EditableText({
  value,
  onChange,
  isEditing,
  onStartEdit,
  onEndEdit,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="csve-inline-input"
        value={value}
        onChange={e => onChange((e.target as HTMLInputElement).value)}
        onBlur={onEndEdit}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            onEndEdit();
          }
        }}
        onClick={e => e.stopPropagation()}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      className={`csve-editable-text ${!value ? 'csve-placeholder' : ''}`}
      onClick={e => {
        e.stopPropagation();
        onStartEdit();
      }}
      title="Click to edit"
    >
      {value || placeholder}
    </span>
  );
}

// ============================================================================
// PLACEHOLDER SECTION
// ============================================================================

function PlaceholderSection({ icon, title }: { icon: string; title: string }) {
  return (
    <section className="csve-section csve-section-placeholder">
      <div className="csve-section-header">
        <i className={icon} />
        <h2>{title}</h2>
      </div>
      <div className="csve-section-body">
        <p>Section editor coming soon...</p>
      </div>
    </section>
  );
}

// ============================================================================
// STORY OVERVIEW EDITOR - K-DRAMA STYLE IMMERSIVE LEARNING
// ============================================================================

interface StoryOverviewEditorProps {
  data: StoryData;
  onChange: (data: StoryData) => void;
  lessonId: string;
}

function StoryOverviewEditor({ data, onChange, lessonId }: StoryOverviewEditorProps) {
  const [isExpanded, setIsExpanded] = useState(data.enabled);
  const [newPlotPoint, setNewPlotPoint] = useState('');
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);

  const toggleStoryMode = () => {
    const newEnabled = !data.enabled;
    onChange({ ...data, enabled: newEnabled });
    if (newEnabled) setIsExpanded(true);
  };

  const addCharacter = () => {
    const newCharacter: StoryCharacter = {
      id: `char_${Date.now()}`,
      name: '',
      koreanName: '',
      role: 'supporting',
      description: '',
      personality: '',
    };
    onChange({ ...data, characters: [...data.characters, newCharacter] });
    setEditingCharacter(newCharacter.id);
  };

  const updateCharacter = (id: string, updates: Partial<StoryCharacter>) => {
    onChange({
      ...data,
      characters: data.characters.map(c => c.id === id ? { ...c, ...updates } : c)
    });
  };

  const removeCharacter = (id: string) => {
    onChange({
      ...data,
      characters: data.characters.filter(c => c.id !== id)
    });
  };

  const addPlotPoint = () => {
    if (!newPlotPoint.trim()) return;
    onChange({
      ...data,
      currentPlotPoints: [...data.currentPlotPoints, newPlotPoint.trim()]
    });
    setNewPlotPoint('');
  };

  const removePlotPoint = (index: number) => {
    onChange({
      ...data,
      currentPlotPoints: data.currentPlotPoints.filter((_, i) => i !== index)
    });
  };

  const updatePlotPoint = (index: number, value: string) => {
    const newPoints = [...data.currentPlotPoints];
    newPoints[index] = value;
    onChange({ ...data, currentPlotPoints: newPoints });
  };

  return (
    <section className={`csve-section csve-story-section ${data.enabled ? 'story-enabled' : ''}`}>
      <div className="csve-section-header csve-story-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="csve-story-header-left">
          <i className="ri-movie-2-line" />
          <h2>📺 Story Mode</h2>
          <span className="csve-story-badge">Story Series</span>
        </div>
        <div className="csve-story-header-right">
          <label className="csve-story-toggle" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={data.enabled}
              onChange={toggleStoryMode}
            />
            <span className="csve-toggle-slider" />
            <span className="csve-toggle-label">{data.enabled ? 'Enabled' : 'Disabled'}</span>
          </label>
          <button className="csve-expand-btn">
            <i className={isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="csve-section-body csve-story-body">
          {!data.enabled ? (
            <div className="csve-story-disabled-notice">
              <i className="ri-film-line" />
              <p>Enable Story Mode to create an immersive K-drama style learning experience!</p>
              <p className="csve-story-hint">
                Story elements will appear in Apply, Exercise, and Mission sections.
              </p>
            </div>
          ) : (
            <>
              {/* Episode Title */}
              <div className="csve-story-field">
                <label>
                  <i className="ri-quill-pen-line" /> Episode Title
                </label>
                <input
                  type="text"
                  value={data.storyTitle}
                  onChange={(e) => onChange({ ...data, storyTitle: (e.target as HTMLInputElement).value })}
                  placeholder="e.g., 'The First Encounter'"
                />
              </div>

              {/* Setting */}
              <div className="csve-story-field">
                <label>
                  <i className="ri-map-pin-line" /> Scene Setting
                </label>
                <input
                  type="text"
                  value={data.setting}
                  onChange={(e) => onChange({ ...data, setting: (e.target as HTMLInputElement).value })}
                  placeholder="e.g., 'A cozy coffee shop in Gangnam'"
                />
              </div>

              {/* Characters Section */}
              <div className="csve-story-field csve-story-characters">
                <label>
                  <i className="ri-group-line" /> Characters
                  <button className="csve-add-btn" onClick={addCharacter}>
                    <i className="ri-add-line" /> Add
                  </button>
                </label>
                
                {data.characters.length === 0 ? (
                  <div className="csve-story-empty">
                    <p>No characters yet. Add your story's cast!</p>
                  </div>
                ) : (
                  <div className="csve-characters-list">
                    {data.characters.map((char) => (
                      <div key={char.id} className={`csve-character-card ${editingCharacter === char.id ? 'editing' : ''}`}>
                        <div className="csve-char-header">
                          <span className={`csve-char-role csve-role-${char.role}`}>
                            {char.role === 'main' ? '⭐' : char.role === 'supporting' ? '🌟' : '✨'}
                          </span>
                          <input
                            type="text"
                            className="csve-char-name"
                            value={char.name}
                            onChange={(e) => updateCharacter(char.id, { name: (e.target as HTMLInputElement).value })}
                            placeholder="Character name"
                          />
                          <input
                            type="text"
                            className="csve-char-korean"
                            value={char.koreanName || ''}
                            onChange={(e) => updateCharacter(char.id, { koreanName: (e.target as HTMLInputElement).value })}
                            placeholder="Name in support language"
                          />
                          <button 
                            className="csve-char-remove"
                            onClick={() => removeCharacter(char.id)}
                          >
                            <i className="ri-close-line" />
                          </button>
                        </div>
                        
                        <div className="csve-char-details">
                          <select
                            value={char.role}
                            onChange={(e) => updateCharacter(char.id, { role: (e.target as HTMLSelectElement).value as StoryCharacter['role'] })}
                          >
                            <option value="main">Main Character</option>
                            <option value="supporting">Supporting</option>
                            <option value="minor">Minor</option>
                          </select>
                          <input
                            type="text"
                            value={char.personality || ''}
                            onChange={(e) => updateCharacter(char.id, { personality: (e.target as HTMLInputElement).value })}
                            placeholder="Personality traits"
                          />
                        </div>
                        
                        <textarea
                          value={char.description}
                          onChange={(e) => updateCharacter(char.id, { description: (e.target as HTMLTextAreaElement).value })}
                          placeholder="Brief description of this character..."
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Previous Episode Summary */}
              <div className="csve-story-field">
                <label>
                  <i className="ri-history-line" /> Previous Episode Summary
                  <span className="csve-field-hint">(Auto-populated from previous lesson or enter manually)</span>
                </label>
                <textarea
                  value={data.previousSummary}
                  onChange={(e) => onChange({ ...data, previousSummary: (e.target as HTMLTextAreaElement).value })}
                  placeholder="What happened in the previous lesson's story..."
                  rows={3}
                />
              </div>

              {/* Current Episode Plot Points */}
              <div className="csve-story-field csve-story-plot-points">
                <label>
                  <i className="ri-list-ordered" /> Plot Points for This Episode
                </label>
                
                <div className="csve-plot-points-list">
                  {data.currentPlotPoints.map((point, index) => (
                    <div key={index} className="csve-plot-point">
                      <span className="csve-plot-number">{index + 1}</span>
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => updatePlotPoint(index, (e.target as HTMLInputElement).value)}
                      />
                      <button onClick={() => removePlotPoint(index)}>
                        <i className="ri-delete-bin-line" />
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="csve-add-plot-point">
                  <input
                    type="text"
                    value={newPlotPoint}
                    onChange={(e) => setNewPlotPoint((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPlotPoint()}
                    placeholder="Add a plot point..."
                  />
                  <button onClick={addPlotPoint}>
                    <i className="ri-add-line" /> Add
                  </button>
                </div>
              </div>

              {/* Next Episode Hook */}
              <div className="csve-story-field">
                <label>
                  <i className="ri-arrow-right-double-line" /> Next Episode Hook
                </label>
                <textarea
                  value={data.nextEpisodeHook}
                  onChange={(e) => onChange({ ...data, nextEpisodeHook: (e.target as HTMLTextAreaElement).value })}
                  placeholder="Teaser for the next lesson's story continuation..."
                  rows={2}
                />
              </div>

              {/* Additional Story Notes */}
              <div className="csve-story-field">
                <label>
                  <i className="ri-sticky-note-line" /> Story Notes (AI Context)
                </label>
                <textarea
                  value={data.storyNotes}
                  onChange={(e) => onChange({ ...data, storyNotes: (e.target as HTMLTextAreaElement).value })}
                  placeholder="Additional context for AI generation: tone, themes, cultural references..."
                  rows={3}
                />
              </div>

              {/* Story Tips */}
              <div className="csve-story-tips">
                <h4><i className="ri-lightbulb-line" /> Story Tips</h4>
                <ul>
                  <li>The student interacts with characters but isn't the protagonist</li>
                  <li>Each lesson continues from where the previous one ended</li>
                  <li>Plot points help AI generate consistent dialogue in sections</li>
                  <li>Use the AI widget to refine and improve generated story content</li>
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// INTRODUCTION SECTION EDITOR - FULLY EDITABLE
// ============================================================================

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'ko', label: 'Korean (한국어)' },
  { code: 'zh', label: 'Chinese (中文)' },
  { code: 'vi', label: 'Vietnamese (Tiếng Việt)' },
];

interface IntroductionSectionEditorProps {
  data: IntroductionData;
  onChange: (data: IntroductionData) => void;
}

function IntroductionSectionEditor({ data, onChange }: IntroductionSectionEditorProps) {
  const introImageInputRef = useRef<HTMLInputElement>(null);
  
  // Extract from props for easier access
  const { introTexts, introImage, lessonIssue, lessonGoalDuration, lessonGoalSteps } = data;

  // UI state
  const [editingIntroText, setEditingIntroText] = useState<number | null>(null);
  const [showAddLanguage, setShowAddLanguage] = useState(false);

  // ============================================================================
  // HELPER: Update data
  // ============================================================================
  
  const updateData = (updates: Partial<IntroductionData>) => {
    onChange({ ...data, ...updates });
  };

  // ============================================================================
  // INTRO TEXT HANDLERS
  // ============================================================================
  
  const handleIntroTextChange = (index: number, text: string) => {
    const updated = [...introTexts];
    updated[index] = { ...updated[index], text };
    updateData({ introTexts: updated });
  };

  const handleAddIntroText = (language: string) => {
    if (introTexts.some(t => t.language === language)) {
      toast.error('This language already exists');
      return;
    }
    updateData({ introTexts: [...introTexts, { language, text: '' }] });
    setShowAddLanguage(false);
    setEditingIntroText(introTexts.length);
  };

  const handleRemoveIntroText = (index: number) => {
    if (introTexts.length === 1) {
      toast.error('At least one language is required');
      return;
    }
    updateData({ introTexts: introTexts.filter((_, i) => i !== index) });
  };

  // ============================================================================
  // IMAGE HANDLERS
  // ============================================================================

  const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateData({ introImage: reader.result as string });
    reader.readAsDataURL(file);
  };

  // ============================================================================
  // LESSON ISSUE HANDLERS
  // ============================================================================

  const handleAddLessonIssue = () => {
    updateData({ lessonIssue: { title: '', points: [''] } });
  };

  const handleRemoveLessonIssue = () => {
    updateData({ lessonIssue: null });
  };

  const handleIssueTitleChange = (title: string) => {
    if (lessonIssue) {
      updateData({ lessonIssue: { ...lessonIssue, title } });
    }
  };

  const handleIssuePointChange = (index: number, text: string) => {
    if (lessonIssue) {
      const points = [...lessonIssue.points];
      points[index] = text;
      updateData({ lessonIssue: { ...lessonIssue, points } });
    }
  };

  const handleAddIssuePoint = () => {
    if (lessonIssue) {
      updateData({ lessonIssue: { ...lessonIssue, points: [...lessonIssue.points, ''] } });
    }
  };

  const handleRemoveIssuePoint = (index: number) => {
    if (lessonIssue && lessonIssue.points.length > 1) {
      updateData({ 
        lessonIssue: { 
          ...lessonIssue, 
          points: lessonIssue.points.filter((_, i) => i !== index) 
        } 
      });
    }
  };

  // ============================================================================
  // LESSON GOAL HANDLERS
  // ============================================================================

  const handleStepChange = (index: number, field: keyof LessonGoalStep, value: string | null) => {
    const updated = [...lessonGoalSteps];
    updated[index] = { ...updated[index], [field]: value };
    updateData({ lessonGoalSteps: updated });
  };

  const handleAddStep = () => {
    updateData({ lessonGoalSteps: [...lessonGoalSteps, { instruction: '', script: null, question: null }] });
  };

  const handleRemoveStep = (index: number) => {
    if (lessonGoalSteps.length > 1) {
      updateData({ lessonGoalSteps: lessonGoalSteps.filter((_, i) => i !== index) });
    }
  };

  const handleDurationChange = (duration: string) => {
    updateData({ lessonGoalDuration: duration });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <section className="csve-intro-section">
      <div className="csve-intro-layout">
        {/* Left Column - Main Content */}
        <div className="csve-intro-left">
          {/* FIXED: Section number and title */}
          <div className="csve-section-number">
            <span className="csve-number-badge">1</span>
            <h2 className="csve-section-title">INTRODUCE</h2>
            <div className="csve-section-line" />
          </div>
          
          {/* EDITABLE: Intro texts with multiple language support */}
          <div className="csve-intro-texts">
            {introTexts.map((introText, i) => (
              <div key={i} className="csve-intro-text-block">
                <div className="csve-intro-text-header">
                  {introTexts.length > 1 && (
                    <button 
                      className="csve-remove-btn"
                      onClick={() => handleRemoveIntroText(i)}
                      title="Remove this translation"
                    >
                      <i className="ri-close-line" />
                    </button>
                  )}
                </div>
                {editingIntroText === i ? (
                  <textarea
                    className="csve-intro-textarea"
                    value={introText.text}
                    onChange={e => handleIntroTextChange(i, (e.target as HTMLTextAreaElement).value)}
                    onBlur={() => setEditingIntroText(null)}
                    placeholder={`Enter introduction text in ${LANGUAGE_OPTIONS.find(l => l.code === introText.language)?.label || introText.language}...`}
                    autoFocus
                  />
                ) : (
                  <p 
                    className="csve-intro-text csve-editable-block"
                    onClick={() => setEditingIntroText(i)}
                  >
                    {introText.text || <span className="csve-placeholder-text">Click to add text...</span>}
                  </p>
                )}
              </div>
            ))}
            
            {/* Add Language Button */}
            <div className="csve-add-language">
              {showAddLanguage ? (
                <div className="csve-language-picker">
                  {LANGUAGE_OPTIONS.filter(lang => !introTexts.some(t => t.language === lang.code)).map(lang => (
                    <button key={lang.code} onClick={() => handleAddIntroText(lang.code)}>
                      {lang.label}
                    </button>
                  ))}
                  <button className="csve-cancel-btn" onClick={() => setShowAddLanguage(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  className="csve-add-btn"
                  onClick={() => setShowAddLanguage(true)}
                  disabled={introTexts.length >= LANGUAGE_OPTIONS.length}
                >
                  <i className="ri-add-line" />
                  Add Translation
                </button>
              )}
            </div>
          </div>
          
          {/* EDITABLE: Intro image */}
          <div className="csve-intro-image-wrapper">
            {introImage ? (
              <div className="csve-intro-image csve-editable-block">
                <img src={introImage} alt="Introduction visual" />
                <div className="csve-image-overlay">
                  <button onClick={() => introImageInputRef.current?.click()}>
                    <i className="ri-image-edit-line" />
                    Change
                  </button>
                  <button onClick={() => updateData({ introImage: null })}>
                    <i className="ri-delete-bin-line" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button 
                className="csve-add-image-btn"
                onClick={() => introImageInputRef.current?.click()}
              >
                <i className="ri-image-add-line" />
                Add Image
              </button>
            )}
            <input
              ref={introImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csve-intro-right">
          {/* EDITABLE & OPTIONAL: Lesson Issue */}
          {lessonIssue ? (
            <div className="csve-lesson-issue csve-editable-card">
              <div className="csve-issue-header">
                <span>THIS LESSON'S ISSUE</span>
                <div className="csve-issue-badges">
                  <small>For tutors only.</small>
                  <small className="csve-warning">DO NOT SHARE WITH THE STUDENT!</small>
                </div>
                <button 
                  className="csve-card-remove-btn"
                  onClick={handleRemoveLessonIssue}
                  title="Remove Lesson Issue"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              <div className="csve-issue-content">
                <input
                  type="text"
                  className="csve-issue-title-input"
                  value={lessonIssue.title}
                  onChange={e => handleIssueTitleChange((e.target as HTMLInputElement).value)}
                  placeholder="Issue title (e.g., Gestures)"
                />
                <ul className="csve-issue-points">
                  {lessonIssue.points.map((point, i) => (
                    <li key={i} className="csve-issue-point-item">
                      <textarea
                        className="csve-issue-point-input"
                        value={point}
                        onChange={e => {
                          const textarea = e.target as HTMLTextAreaElement;
                          textarea.style.height = 'auto';
                          textarea.style.height = textarea.scrollHeight + 'px';
                          handleIssuePointChange(i, textarea.value);
                        }}
                        onFocus={e => {
                          const textarea = e.target as HTMLTextAreaElement;
                          textarea.style.height = 'auto';
                          textarea.style.height = textarea.scrollHeight + 'px';
                        }}
                        placeholder="Enter a point..."
                        rows={1}
                      />
                      {lessonIssue.points.length > 1 && (
                        <button 
                          className="csve-point-remove"
                          onClick={() => handleRemoveIssuePoint(i)}
                        >
                          <i className="ri-close-line" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <button className="csve-add-point-btn" onClick={handleAddIssuePoint}>
                  <i className="ri-add-line" />
                  Add Point
                </button>
              </div>
            </div>
          ) : (
            <button className="csve-add-card-btn" onClick={handleAddLessonIssue}>
              <i className="ri-add-circle-line" />
              Add Lesson Issue
              <span className="csve-add-card-hint">Optional tutor-only information</span>
            </button>
          )}

          {/* EDITABLE: Lesson Goal */}
          <div className="csve-lesson-goal-box csve-editable-card">
            <TutorGuide
              title="LESSON OBJECTIVE"
              duration={lessonGoalDuration}
              steps={lessonGoalSteps.map(s => ({ ...s, tip: s.question })) as UniversalTutorStep[]}
              onStepsChange={(steps) => updateData({ 
                lessonGoalSteps: steps.map(s => ({ 
                  instruction: s.instruction, 
                  script: s.script, 
                  question: s.tip 
                })) as LessonGoalStep[] 
              })}
              onDurationChange={handleDurationChange}
              features={{ showScripts: true, showTips: true, legacyMode: true }}
              className=""
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// LEARN SECTION EDITOR
// ============================================================================

interface LearnSectionEditorProps {
  data: LearnSectionData;
  onChange: (data: LearnSectionData) => void;
}

function LearnSectionEditor({ data, onChange }: LearnSectionEditorProps) {
  const vocabImageInputRef = useRef<HTMLInputElement>(null);
  const exprImageInputRef = useRef<HTMLInputElement>(null);
  const discussImageInputRef = useRef<HTMLInputElement>(null);
  const [activeVocabIndex, setActiveVocabIndex] = useState<{stepIdx: number, vocabIdx: number} | null>(null);
  const [activeExprIndex, setActiveExprIndex] = useState<{stepIdx: number, exprIdx: number} | null>(null);
  const [activeDiscussIndex, setActiveDiscussIndex] = useState<{stepIdx: number, imgIdx: number} | null>(null);

  // Helper to update data
  const updateData = (updates: Partial<LearnSectionData>) => {
    onChange({ ...data, ...updates });
  };

  const updateStep = (stepIndex: number, updates: Partial<LearnStepData>) => {
    const newSteps = [...data.steps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates };
    updateData({ steps: newSteps });
  };

  // Switch step type handler
  const handleSwitchStepType = (stepIdx: number, newType: StepAType) => {
    if (newType === 'vocabulary') {
      updateStep(stepIdx, {
        ...DEFAULT_VOCABULARY_STEP,
        stepType: 'vocabulary',
      });
    } else {
      updateStep(stepIdx, {
        ...DEFAULT_EXPRESSIONS_STEP,
        stepType: 'expressions',
      });
    }
  };

  // Vocabulary handlers
  const handleVocabChange = (stepIdx: number, vocabIdx: number, field: keyof VocabularyItem, value: string) => {
    const step = data.steps[stepIdx];
    const newVocab = [...(step.vocabularyItems || [])];
    newVocab[vocabIdx] = { ...newVocab[vocabIdx], [field]: value };
    updateStep(stepIdx, { vocabularyItems: newVocab });
  };

  const handleAddVocab = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const newVocab = [...(step.vocabularyItems || []), { image: '', englishText: '', translation: '' }];
    updateStep(stepIdx, { vocabularyItems: newVocab });
  };

  const handleRemoveVocab = (stepIdx: number, vocabIdx: number) => {
    const step = data.steps[stepIdx];
    if ((step.vocabularyItems || []).length <= 1) {
      toast.error('At least one vocabulary item is required');
      return;
    }
    updateStep(stepIdx, { vocabularyItems: (step.vocabularyItems || []).filter((_, i) => i !== vocabIdx) });
  };

  const handleVocabImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !activeVocabIndex) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleVocabChange(activeVocabIndex.stepIdx, activeVocabIndex.vocabIdx, 'image', reader.result as string);
      setActiveVocabIndex(null);
    };
    reader.readAsDataURL(file);
  };

  // Expression handlers
  const handleExprChange = (stepIdx: number, exprIdx: number, field: keyof ExpressionItem, value: string) => {
    const step = data.steps[stepIdx];
    const newExpr = [...(step.expressionItems || [])];
    newExpr[exprIdx] = { ...newExpr[exprIdx], [field]: value };
    updateStep(stepIdx, { expressionItems: newExpr });
  };

  const handleAddExpr = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const newExpr = [...(step.expressionItems || []), { image: '', definitionLine: 'To <strong>expression</strong> means...', exampleSentence: '<em>Example sentence here.</em>' }];
    updateStep(stepIdx, { expressionItems: newExpr });
  };

  const handleRemoveExpr = (stepIdx: number, exprIdx: number) => {
    const step = data.steps[stepIdx];
    if ((step.expressionItems || []).length <= 1) {
      toast.error('At least one expression is required');
      return;
    }
    updateStep(stepIdx, { expressionItems: (step.expressionItems || []).filter((_, i) => i !== exprIdx) });
  };

  const handleExprImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !activeExprIndex) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleExprChange(activeExprIndex.stepIdx, activeExprIndex.exprIdx, 'image', reader.result as string);
      setActiveExprIndex(null);
    };
    reader.readAsDataURL(file);
  };

  // Discussion part handlers
  const handleDiscussInstructionChange = (stepIdx: number, value: string) => {
    const step = data.steps[stepIdx];
    updateStep(stepIdx, { 
      discussionPart: { 
        ...(step.discussionPart || { instruction: '', images: [] }), 
        instruction: value 
      } 
    });
  };

  const handleDiscussImageChange = (stepIdx: number, imgIdx: number, field: keyof DiscussionImage, value: string) => {
    const step = data.steps[stepIdx];
    const currentImages = step.discussionPart?.images || [];
    const newImages = [...currentImages];
    newImages[imgIdx] = { ...newImages[imgIdx], [field]: value };
    updateStep(stepIdx, { 
      discussionPart: { 
        ...(step.discussionPart || { instruction: '' }), 
        images: newImages 
      } 
    });
  };

  const handleAddDiscussImage = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const currentImages = step.discussionPart?.images || [];
    if (currentImages.length >= 3) {
      toast.error('Maximum 3 images allowed');
      return;
    }
    updateStep(stepIdx, { 
      discussionPart: { 
        ...(step.discussionPart || { instruction: '' }), 
        images: [...currentImages, { image: '', label: '', translation: '' }] 
      } 
    });
  };

  const handleRemoveDiscussImage = (stepIdx: number, imgIdx: number) => {
    const step = data.steps[stepIdx];
    const currentImages = step.discussionPart?.images || [];
    updateStep(stepIdx, { 
      discussionPart: { 
        ...(step.discussionPart || { instruction: '' }), 
        images: currentImages.filter((_, i) => i !== imgIdx) 
      } 
    });
  };

  const handleDiscussImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !activeDiscussIndex) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleDiscussImageChange(activeDiscussIndex.stepIdx, activeDiscussIndex.imgIdx, 'image', reader.result as string);
      setActiveDiscussIndex(null);
    };
    reader.readAsDataURL(file);
  };

  // Add/Remove Discussion Part
  const handleAddDiscussionPart = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const partNum = step.pronunciationPart ? 'III' : 'II';
    updateStep(stepIdx, {
      discussionPart: {
        instruction: `${partNum}. Discussion question goes here.`,
        instructionTranslation: '',
        images: [{ image: '', label: '', translation: '' }],
        tutorSteps: [
          { instruction: 'Read the instructions.', script: null, tip: null },
          { instruction: 'Ask the student to describe the pictures.', script: null, tip: null },
          { instruction: 'Transition to the next part.', script: "Great! Let's go to the next part!", tip: null },
        ]
      }
    });
  };

  const handleRemoveDiscussionPart = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const { discussionPart, ...rest } = step;
    updateStep(stepIdx, { discussionPart: undefined });
  };

  // Pronunciation Part handlers
  const handleAddPronunciationPart = (stepIdx: number) => {
    updateStep(stepIdx, {
      pronunciationPart: {
        instruction: 'Practice reading the words.',
        instructionTranslation: '単語を読む練習をしましょう。',
        leftColumn: {
          soundSymbol: '/d/',
          images: [''],
          words: [
            { word: 'do', translation: 'する', isHighlighted: true },
            { word: 'dressed', translation: '服を着た', isHighlighted: true },
            { word: 'dust', translation: 'ほこり' },
          ]
        },
        rightColumn: {
          soundSymbol: '/dʒ/',
          images: [''],
          words: [
            { word: 'Jew', translation: 'ユダヤ人' },
            { word: 'jest', translation: '冗談' },
            { word: 'just', translation: 'ちょうど' },
          ]
        },
        tutorSteps: [
          { instruction: 'Read the instructions.', script: null, tip: null },
          { instruction: 'Read the words in the left column and ask the student to repeat.', script: null, tip: null },
          { instruction: 'Read the words in the right column and ask the student to repeat.', script: null, tip: null },
          { instruction: 'Transition to the next part.', script: "Great! Let's go to the next part!", tip: null },
        ]
      }
    });
  };

  const handleRemovePronunciationPart = (stepIdx: number) => {
    updateStep(stepIdx, { pronunciationPart: undefined });
  };

  const handlePronunciationChange = (
    stepIdx: number, 
    column: 'leftColumn' | 'rightColumn', 
    field: string, 
    value: any
  ) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    updateStep(stepIdx, {
      pronunciationPart: {
        ...step.pronunciationPart,
        [column]: {
          ...step.pronunciationPart[column],
          [field]: value
        }
      }
    });
  };

  const handlePronunciationWordChange = (
    stepIdx: number,
    column: 'leftColumn' | 'rightColumn',
    wordIdx: number,
    field: keyof PronunciationWord,
    value: string | boolean
  ) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    const newWords = [...step.pronunciationPart[column].words];
    newWords[wordIdx] = { ...newWords[wordIdx], [field]: value };
    handlePronunciationChange(stepIdx, column, 'words', newWords);
  };

  const handleAddPronunciationWord = (stepIdx: number, column: 'leftColumn' | 'rightColumn') => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    const newWords = [...step.pronunciationPart[column].words, { word: '', translation: '' }];
    handlePronunciationChange(stepIdx, column, 'words', newWords);
  };

  const handleRemovePronunciationWord = (stepIdx: number, column: 'leftColumn' | 'rightColumn', wordIdx: number) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    if (step.pronunciationPart[column].words.length <= 1) {
      toast.error('At least one word is required');
      return;
    }
    const newWords = step.pronunciationPart[column].words.filter((_, i) => i !== wordIdx);
    handlePronunciationChange(stepIdx, column, 'words', newWords);
  };

  // Tutor step handlers
  const handleTutorStepChange = (stepIdx: number, tutorIdx: number, field: keyof TutorStep, value: string | null) => {
    const step = data.steps[stepIdx];
    const newTutorSteps = [...step.tutorSteps];
    newTutorSteps[tutorIdx] = { ...newTutorSteps[tutorIdx], [field]: value };
    updateStep(stepIdx, { tutorSteps: newTutorSteps });
  };

  const handleAddTutorStep = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    updateStep(stepIdx, { tutorSteps: [...step.tutorSteps, { instruction: '', script: null, tip: null }] });
  };

  const handleRemoveTutorStep = (stepIdx: number, tutorIdx: number) => {
    const step = data.steps[stepIdx];
    if (step.tutorSteps.length <= 1) {
      toast.error('At least one tutor step is required');
      return;
    }
    updateStep(stepIdx, { tutorSteps: step.tutorSteps.filter((_, i) => i !== tutorIdx) });
  };

  // Discussion Part Tutor Steps handlers
  const handleDiscussionTutorStepChange = (stepIdx: number, tutorIdx: number, field: keyof TutorStep, value: string | null) => {
    const step = data.steps[stepIdx];
    if (!step.discussionPart || !step.discussionPart.tutorSteps) return;
    const newTutorSteps = [...step.discussionPart.tutorSteps];
    newTutorSteps[tutorIdx] = { ...newTutorSteps[tutorIdx], [field]: value };
    updateStep(stepIdx, { discussionPart: { ...step.discussionPart, tutorSteps: newTutorSteps } });
  };

  const handleAddDiscussionTutorStep = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    if (!step.discussionPart) return;
    const currentSteps = step.discussionPart.tutorSteps || [];
    updateStep(stepIdx, { discussionPart: { ...step.discussionPart, tutorSteps: [...currentSteps, { instruction: '', script: null, tip: null }] } });
  };

  const handleRemoveDiscussionTutorStep = (stepIdx: number, tutorIdx: number) => {
    const step = data.steps[stepIdx];
    if (!step.discussionPart || !step.discussionPart.tutorSteps || step.discussionPart.tutorSteps.length <= 1) {
      toast.error('At least one tutor step is required');
      return;
    }
    updateStep(stepIdx, { discussionPart: { ...step.discussionPart, tutorSteps: step.discussionPart.tutorSteps.filter((_, i) => i !== tutorIdx) } });
  };

  // Pronunciation Part Tutor Steps handlers
  const handlePronunciationTutorStepChange = (stepIdx: number, tutorIdx: number, field: keyof TutorStep, value: string | null) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart || !step.pronunciationPart.tutorSteps) return;
    const newTutorSteps = [...step.pronunciationPart.tutorSteps];
    newTutorSteps[tutorIdx] = { ...newTutorSteps[tutorIdx], [field]: value };
    updateStep(stepIdx, { pronunciationPart: { ...step.pronunciationPart, tutorSteps: newTutorSteps } });
  };

  const handleAddPronunciationTutorStep = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    const currentSteps = step.pronunciationPart.tutorSteps || [];
    updateStep(stepIdx, { pronunciationPart: { ...step.pronunciationPart, tutorSteps: [...currentSteps, { instruction: '', script: null, tip: null }] } });
  };

  const handleRemovePronunciationTutorStep = (stepIdx: number, tutorIdx: number) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart || !step.pronunciationPart.tutorSteps || step.pronunciationPart.tutorSteps.length <= 1) {
      toast.error('At least one tutor step is required');
      return;
    }
    updateStep(stepIdx, { pronunciationPart: { ...step.pronunciationPart, tutorSteps: step.pronunciationPart.tutorSteps.filter((_, i) => i !== tutorIdx) } });
  };

  return (
    <section className="csve-learn-section">
      <div className="csve-section-number">
        <span className="csve-number-badge">2</span>
        <h2 className="csve-section-title">{data.sectionTitle}</h2>
        <div className="csve-section-line" />
      </div>

      {data.steps.map((step, stepIdx) => (
        <div key={stepIdx} className="csve-learn-step">
          {/* Step Type Switcher */}
          <div className="csve-step-type-switcher">
            <span className="csve-switcher-label">Step A Type:</span>
            <div className="csve-switcher-buttons">
              <button
                className={`csve-switcher-btn ${step.stepType === 'vocabulary' ? 'active' : ''}`}
                onClick={() => handleSwitchStepType(stepIdx, 'vocabulary')}
              >
                <i className="ri-book-2-line" />
                Vocabulary
              </button>
              <button
                className={`csve-switcher-btn ${step.stepType === 'expressions' ? 'active' : ''}`}
                onClick={() => handleSwitchStepType(stepIdx, 'expressions')}
              >
                <i className="ri-chat-quote-line" />
                Expressions
              </button>
            </div>
          </div>

          {/* Step Header - Editable */}
          <div className="csve-step-header-edit">
            <input
              type="text"
              className="csve-step-name-input"
              value={step.stepName}
              onChange={e => updateStep(stepIdx, { stepName: (e.target as HTMLInputElement).value })}
              placeholder="STEP NAME"
            />
          </div>

          <div className="csve-learn-layout">
            {/* Left Column - Content */}
            <div className="csve-learn-left">
              {/* Part Label - Editable */}
              <div className="csve-part-label-edit">
                <input
                  type="text"
                  className="csve-part-english-input"
                  value={step.partLabel}
                  onChange={e => updateStep(stepIdx, { partLabel: (e.target as HTMLInputElement).value })}
                  placeholder="Part label (e.g., I. Listen and repeat.)"
                />
                {step.partTranslation !== undefined ? (
                  <div className="csve-translation-row">
                    <input
                      type="text"
                      className="csve-translation-input"
                      value={step.partTranslation}
                      onChange={e => updateStep(stepIdx, { partTranslation: (e.target as HTMLInputElement).value })}
                      placeholder="Translation..."
                    />
                    <button
                      className="csve-remove-translation-btn"
                      onClick={() => updateStep(stepIdx, { partTranslation: undefined })}
                      title="Remove translation"
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="csve-add-translation-btn"
                    onClick={() => updateStep(stepIdx, { partTranslation: '' })}
                  >
                    <i className="ri-translate-2" /> Add Translation
                  </button>
                )}
              </div>

              {/* VOCABULARY Content */}
              {step.stepType === 'vocabulary' && (
                <div className="csve-vocab-grid">
                  {(step.vocabularyItems || []).map((item, vocabIdx) => (
                    <div key={vocabIdx} className="csve-vocab-card csve-editable-card">
                      <div 
                        className="csve-vocab-image"
                        onClick={() => {
                          setActiveVocabIndex({ stepIdx, vocabIdx });
                          vocabImageInputRef.current?.click();
                        }}
                      >
                        {item.image ? (
                          <img src={item.image} alt={item.englishText} />
                        ) : (
                          <div className="csve-image-placeholder">
                            <span className="csve-placeholder-dims">150 × 100</span>
                            <span className="csve-placeholder-hint">Click to add</span>
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        className="csve-vocab-english-input"
                        value={item.englishText}
                        onChange={e => handleVocabChange(stepIdx, vocabIdx, 'englishText', (e.target as HTMLInputElement).value)}
                        placeholder="English text"
                      />
                      <input
                        type="text"
                        className="csve-vocab-highlight-input"
                        value={item.highlightedWord || ''}
                        onChange={e => handleVocabChange(stepIdx, vocabIdx, 'highlightedWord', (e.target as HTMLInputElement).value)}
                        placeholder="Highlight word (optional)"
                      />
                      <input
                        type="text"
                        className="csve-vocab-translation-input"
                        value={item.translation}
                        onChange={e => handleVocabChange(stepIdx, vocabIdx, 'translation', (e.target as HTMLInputElement).value)}
                        placeholder="Translation"
                      />
                      {(step.vocabularyItems || []).length > 1 && (
                        <button className="csve-vocab-remove" onClick={() => handleRemoveVocab(stepIdx, vocabIdx)}>
                          <i className="ri-delete-bin-line" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button className="csve-add-vocab-btn" onClick={() => handleAddVocab(stepIdx)}>
                    <i className="ri-add-line" />
                    Add Vocabulary
                  </button>
                </div>
              )}

              {/* EXPRESSIONS Content */}
              {step.stepType === 'expressions' && (
                <>
                  <div className="csve-expr-list">
                    {(step.expressionItems || []).map((item, exprIdx) => (
                      <div key={exprIdx} className="csve-expr-item">
                        <div 
                          className="csve-expr-image"
                          onClick={() => {
                            setActiveExprIndex({ stepIdx, exprIdx });
                            exprImageInputRef.current?.click();
                          }}
                        >
                          {item.image ? (
                            <img src={item.image} alt="expression" />
                          ) : (
                            <div className="csve-image-placeholder">
                              <span className="csve-placeholder-dims">220 × 165</span>
                              <span className="csve-placeholder-hint">Click to add</span>
                            </div>
                          )}
                        </div>
                        <div className="csve-expr-content">
                          <div className="csve-expr-number">{exprIdx + 1}.</div>
                          <div className="csve-expr-fields">
                            <RichTextInput
                              value={item.definitionLine}
                              onChange={(html) => handleExprChange(stepIdx, exprIdx, 'definitionLine', html)}
                              placeholder="To cost an arm and a leg means to be very expensive."
                              className="csve-expr-definition-rich"
                            />
                            <RichTextInput
                              value={item.exampleSentence}
                              onChange={(html) => handleExprChange(stepIdx, exprIdx, 'exampleSentence', html)}
                              placeholder="Staying at a five-star hotel will cost an arm and a leg."
                              className="csve-expr-example-rich"
                            />
                            {/* Translation field */}
                            <input
                              type="text"
                              value={item.translation || ''}
                              onChange={(e) => handleExprChange(stepIdx, exprIdx, 'translation', (e.target as HTMLInputElement).value)}
                              placeholder="Translation (日本語 / 한국어 / Tiếng Việt / 中文)"
                              className="csve-input"
                              style={{ marginTop: '8px', fontStyle: 'italic', color: '#888' }}
                            />
                            {item.extraText !== undefined ? (
                              <div className="csve-expr-extra-wrap">
                                <RichTextInput
                                  value={item.extraText}
                                  onChange={(html) => handleExprChange(stepIdx, exprIdx, 'extraText', html)}
                                  placeholder="Additional text..."
                                  className="csve-expr-extra-rich"
                                />
                                <button 
                                  className="csve-expr-extra-remove"
                                  onClick={() => {
                                    const step = data.steps[stepIdx];
                                    const newExpr = [...(step.expressionItems || [])];
                                    const { extraText, ...rest } = newExpr[exprIdx];
                                    newExpr[exprIdx] = rest as ExpressionItem;
                                    updateStep(stepIdx, { expressionItems: newExpr });
                                  }}
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                            ) : (
                              <button 
                                className="csve-add-extra-text-btn"
                                onClick={() => handleExprChange(stepIdx, exprIdx, 'extraText', '')}
                              >
                                <i className="ri-add-line" /> Add Text
                              </button>
                            )}
                          </div>
                          {(step.expressionItems || []).length > 1 && (
                            <button className="csve-expr-remove" onClick={() => handleRemoveExpr(stepIdx, exprIdx)}>
                              <i className="ri-delete-bin-line" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button className="csve-add-expr-btn" onClick={() => handleAddExpr(stepIdx)}>
                      <i className="ri-add-line" />
                      Add Expression
                    </button>
                  </div>
                </>
              )}

            </div>

            {/* Right Column - Part I Tutor Guide */}
            <div className="csve-learn-right">
              <TutorGuide
                title={`${data.sectionTitle} - ${step.stepName.split(' ').slice(0, 2).join(' ')}`}
                duration={step.duration}
                steps={step.tutorSteps as UniversalTutorStep[]}
                onStepsChange={(steps) => updateStep(stepIdx, { tutorSteps: steps as TutorStep[] })}
                onDurationChange={(duration) => updateStep(stepIdx, { duration })}
                features={{ showScripts: true, showTips: true, legacyMode: true }}
                className="csve-editable-card"
              />
            </div>
          </div>

          {/* PART II - Discussion (separate layout for alignment) */}
          {step.discussionPart ? (
            <div className="csve-learn-layout csve-part-layout">
              {/* Left Column - Discussion Content */}
              <div className="csve-learn-left">
                <div className="csve-discuss-part">
                  <div className="csve-part-header">
                    <span className="csve-part-label">Part II</span>
                    <button className="csve-remove-part-btn" onClick={() => handleRemoveDiscussionPart(stepIdx)}>
                      <i className="ri-close-line" /> Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    className="csve-discuss-instruction-input"
                    value={step.discussionPart?.instruction || ''}
                    onChange={e => handleDiscussInstructionChange(stepIdx, (e.target as HTMLInputElement).value)}
                    placeholder="II. Discussion question..."
                  />
                  
                  {/* Images Grid - Up to 3 images horizontally */}
                  <div className={`csve-discuss-images csve-discuss-images-${(step.discussionPart?.images || []).length || 1}`}>
                    {(step.discussionPart?.images || []).map((img, imgIdx) => (
                      <div key={imgIdx} className="csve-discuss-image-item">
                        <div 
                          className="csve-discuss-image"
                          onClick={() => {
                            setActiveDiscussIndex({ stepIdx, imgIdx });
                            discussImageInputRef.current?.click();
                          }}
                        >
                          {img.image ? (
                            <img src={img.image} alt={img.label || 'Discussion'} />
                          ) : (
                            <div className="csve-image-placeholder">
                              <span className="csve-placeholder-dims">300 × 200</span>
                              <span className="csve-placeholder-hint">Click to add</span>
                            </div>
                          )}
                          {(step.discussionPart?.images || []).length > 1 && (
                            <button 
                              className="csve-discuss-image-remove"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveDiscussImage(stepIdx, imgIdx);
                              }}
                            >
                              <i className="ri-close-line" />
                            </button>
                          )}
                        </div>
                        
                        {/* Label input */}
                        <div className="csve-discuss-label-row">
                          {img.label !== undefined ? (
                            <input
                              type="text"
                              className="csve-discuss-label-input"
                              value={img.label}
                              onChange={e => handleDiscussImageChange(stepIdx, imgIdx, 'label', (e.target as HTMLInputElement).value)}
                              placeholder="Label (e.g., hotel)"
                            />
                          ) : (
                            <button 
                              className="csve-add-label-btn"
                              onClick={() => handleDiscussImageChange(stepIdx, imgIdx, 'label', '')}
                            >
                              <i className="ri-add-line" /> Add Label
                            </button>
                          )}
                        </div>
                        
                        {/* Translation input */}
                        <div className="csve-discuss-translation-row">
                          {img.translation !== undefined ? (
                            <input
                              type="text"
                              className="csve-discuss-translation-input"
                              value={img.translation}
                              onChange={e => handleDiscussImageChange(stepIdx, imgIdx, 'translation', (e.target as HTMLInputElement).value)}
                              placeholder="Translation (e.g., ホテル)"
                            />
                          ) : (
                            <button 
                              className="csve-add-translation-btn"
                              onClick={() => handleDiscussImageChange(stepIdx, imgIdx, 'translation', '')}
                            >
                              <i className="ri-add-line" /> Add Translation
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Add Image Button */}
                    {(step.discussionPart?.images || []).length < 3 && (
                      <button 
                        className="csve-add-discuss-image-btn"
                        onClick={() => handleAddDiscussImage(stepIdx)}
                      >
                        <i className="ri-add-line" />
                        <span>Add Image</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Right Column - Discussion Tutor Guide */}
              <div className="csve-learn-right">
                {step.discussionPart.tutorSteps && (
                  <TutorGuide
                    title={`Part II - Discussion`}
                    steps={step.discussionPart.tutorSteps as UniversalTutorStep[]}
                    onStepsChange={(steps) => updateStep(stepIdx, { 
                      discussionPart: { ...step.discussionPart!, tutorSteps: steps as TutorStep[] } 
                    })}
                    features={{ showScripts: true, showTips: true, legacyMode: true }}
                    className="csve-editable-card csve-part-tutor-guide"
                  />
                )}
              </div>
            </div>
          ) : null}

          {/* PART III - Pronunciation (separate layout for alignment) */}
          {step.pronunciationPart ? (
            <div className="csve-learn-layout csve-part-layout">
              {/* Left Column - Pronunciation Content */}
              <div className="csve-learn-left">
                <div className="csve-pronunciation-part">
                  <div className="csve-part-header">
                    <span className="csve-part-label">Part {step.discussionPart ? 'III' : 'II'} - Pronunciation</span>
                    <button className="csve-remove-part-btn" onClick={() => handleRemovePronunciationPart(stepIdx)}>
                      <i className="ri-close-line" /> Remove
                    </button>
                  </div>
                  
                  {/* Instruction - numeral is computed dynamically */}
                  <div className="csve-pronunciation-instruction">
                    <span className="csve-pronunciation-numeral">{step.discussionPart ? 'III' : 'II'}.</span>
                    <input
                      type="text"
                      className="csve-pronunciation-instr-input"
                      value={step.pronunciationPart.instruction}
                      onChange={e => updateStep(stepIdx, {
                        pronunciationPart: { ...step.pronunciationPart!, instruction: (e.target as HTMLInputElement).value }
                      })}
                      placeholder="Practice reading the words."
                    />
                    <input
                      type="text"
                      className="csve-pronunciation-instr-trans"
                      value={step.pronunciationPart.instructionTranslation}
                      onChange={e => updateStep(stepIdx, {
                        pronunciationPart: { ...step.pronunciationPart!, instructionTranslation: (e.target as HTMLInputElement).value }
                      })}
                      placeholder="単語を読む練習をしましょう。"
                    />
                  </div>

                  {/* Two Column Layout */}
                  <div className="csve-pronunciation-columns">
                    {/* Left Column */}
                    <div className="csve-pronunciation-column">
                      <input
                        type="text"
                        className="csve-pronunciation-sound"
                        value={step.pronunciationPart.leftColumn.soundSymbol}
                        onChange={e => handlePronunciationChange(stepIdx, 'leftColumn', 'soundSymbol', (e.target as HTMLInputElement).value)}
                        placeholder="/d/"
                      />
                      <div className="csve-pronunciation-images">
                        {step.pronunciationPart.leftColumn.images.map((img, imgIdx) => (
                          <div key={imgIdx} className="csve-pronunciation-img-slot">
                            {img ? (
                              <img src={img} alt="mouth position" />
                            ) : (
                              <div className="csve-image-placeholder csve-pronunciation-placeholder">
                                <span className="csve-placeholder-dims">120 × 90</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="csve-pronunciation-words">
                        {step.pronunciationPart.leftColumn.words.map((word, wordIdx) => (
                          <div key={wordIdx} className="csve-pronunciation-word-row">
                            <input
                              type="checkbox"
                              checked={word.isHighlighted || false}
                              onChange={e => handlePronunciationWordChange(stepIdx, 'leftColumn', wordIdx, 'isHighlighted', (e.target as HTMLInputElement).checked)}
                            />
                            <div className="csve-pronunciation-word-content">
                              <input
                                type="text"
                                className={`csve-pronunciation-word ${word.isHighlighted ? 'highlighted' : ''}`}
                                value={word.word}
                                onChange={e => handlePronunciationWordChange(stepIdx, 'leftColumn', wordIdx, 'word', (e.target as HTMLInputElement).value)}
                                placeholder="word"
                              />
                              <input
                                type="text"
                                className="csve-pronunciation-trans"
                                value={word.translation}
                                onChange={e => handlePronunciationWordChange(stepIdx, 'leftColumn', wordIdx, 'translation', (e.target as HTMLInputElement).value)}
                                placeholder="翻訳"
                              />
                            </div>
                            {step.pronunciationPart!.leftColumn.words.length > 1 && (
                              <button 
                                className="csve-pronunciation-word-remove"
                                onClick={() => handleRemovePronunciationWord(stepIdx, 'leftColumn', wordIdx)}
                              >
                                <i className="ri-close-line" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button className="csve-add-pronunciation-word" onClick={() => handleAddPronunciationWord(stepIdx, 'leftColumn')}>
                          <i className="ri-add-line" /> Add Word
                        </button>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="csve-pronunciation-column">
                      <input
                        type="text"
                        className="csve-pronunciation-sound"
                        value={step.pronunciationPart.rightColumn.soundSymbol}
                        onChange={e => handlePronunciationChange(stepIdx, 'rightColumn', 'soundSymbol', (e.target as HTMLInputElement).value)}
                        placeholder="/dʒ/"
                      />
                      <div className="csve-pronunciation-images">
                        {step.pronunciationPart.rightColumn.images.map((img, imgIdx) => (
                          <div key={imgIdx} className="csve-pronunciation-img-slot">
                            {img ? (
                              <img src={img} alt="mouth position" />
                            ) : (
                              <div className="csve-image-placeholder csve-pronunciation-placeholder">
                                <span className="csve-placeholder-dims">120 × 90</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="csve-pronunciation-words">
                        {step.pronunciationPart.rightColumn.words.map((word, wordIdx) => (
                          <div key={wordIdx} className="csve-pronunciation-word-row">
                            <input
                              type="checkbox"
                              checked={word.isHighlighted || false}
                              onChange={e => handlePronunciationWordChange(stepIdx, 'rightColumn', wordIdx, 'isHighlighted', (e.target as HTMLInputElement).checked)}
                            />
                            <div className="csve-pronunciation-word-content">
                              <input
                                type="text"
                                className={`csve-pronunciation-word ${word.isHighlighted ? 'highlighted' : ''}`}
                                value={word.word}
                                onChange={e => handlePronunciationWordChange(stepIdx, 'rightColumn', wordIdx, 'word', (e.target as HTMLInputElement).value)}
                                placeholder="word"
                              />
                              <input
                                type="text"
                                className="csve-pronunciation-trans"
                                value={word.translation}
                                onChange={e => handlePronunciationWordChange(stepIdx, 'rightColumn', wordIdx, 'translation', (e.target as HTMLInputElement).value)}
                                placeholder="翻訳"
                              />
                            </div>
                            {step.pronunciationPart!.rightColumn.words.length > 1 && (
                              <button 
                                className="csve-pronunciation-word-remove"
                                onClick={() => handleRemovePronunciationWord(stepIdx, 'rightColumn', wordIdx)}
                              >
                                <i className="ri-close-line" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button className="csve-add-pronunciation-word" onClick={() => handleAddPronunciationWord(stepIdx, 'rightColumn')}>
                          <i className="ri-add-line" /> Add Word
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Pronunciation Tutor Guide */}
              <div className="csve-learn-right">
                {step.pronunciationPart.tutorSteps && (
                  <TutorGuide
                    title={`Part ${step.discussionPart ? 'III' : 'II'} - Pronunciation`}
                    steps={step.pronunciationPart.tutorSteps as UniversalTutorStep[]}
                    onStepsChange={(steps) => updateStep(stepIdx, { 
                      pronunciationPart: { ...step.pronunciationPart!, tutorSteps: steps as TutorStep[] } 
                    })}
                    features={{ showScripts: true, showTips: true, legacyMode: true }}
                    className="csve-editable-card csve-part-tutor-guide"
                  />
                )}
              </div>
            </div>
          ) : null}

          {/* Add Part Buttons */}
          <div className="csve-add-parts-row">
            {!step.discussionPart && (
              <button className="csve-add-part-btn" onClick={() => handleAddDiscussionPart(stepIdx)}>
                <i className="ri-add-line" /> Add Part II (Discussion)
              </button>
            )}
            {!step.pronunciationPart && (
              <button className="csve-add-part-btn" onClick={() => handleAddPronunciationPart(stepIdx)}>
                <i className="ri-add-line" /> Add Part {step.discussionPart ? 'III' : 'II'} (Pronunciation)
              </button>
            )}
          </div>
        </div>
      ))}
      
      {/* Hidden file inputs */}
      <input ref={vocabImageInputRef} type="file" accept="image/*" onChange={handleVocabImageUpload} style={{ display: 'none' }} />
      <input ref={exprImageInputRef} type="file" accept="image/*" onChange={handleExprImageUpload} style={{ display: 'none' }} />
      <input ref={discussImageInputRef} type="file" accept="image/*" onChange={handleDiscussImageUpload} style={{ display: 'none' }} />
    </section>
  );
}

// ============================================================================
// STEP B SECTION EDITOR
// ============================================================================

interface StepBSectionEditorProps {
  data: StepBData;
  onChange: (data: StepBData) => void;
}

function StepBSectionEditor({ data, onChange }: StepBSectionEditorProps) {
  const speaker1ImageInputRef = useRef<HTMLInputElement>(null);
  const speaker2ImageInputRef = useRef<HTMLInputElement>(null);
  const [activeSpeaker, setActiveSpeaker] = useState<1 | 2 | null>(null);

  // Switch step type handler
  const handleSwitchStepBType = (newType: StepBType) => {
    if (newType === data.stepType) return;
    
    if (newType === 'speak-your-mind') {
      onChange({
        stepType: 'speak-your-mind',
        speakYourMind: data.speakYourMind || DEFAULT_SPEAK_YOUR_MIND,
        grammarTip: data.grammarTip,
        pronunciation: data.pronunciation
      });
    } else if (newType === 'grammar-tip') {
      onChange({
        stepType: 'grammar-tip',
        speakYourMind: data.speakYourMind,
        grammarTip: data.grammarTip || DEFAULT_GRAMMAR_TIP,
        pronunciation: data.pronunciation
      });
    } else {
      onChange({
        stepType: 'pronunciation',
        speakYourMind: data.speakYourMind,
        grammarTip: data.grammarTip,
        pronunciation: data.pronunciation || DEFAULT_STEPB_PRONUNCIATION
      });
    }
  };

  // Update the speak your mind data
  const updateSpeakYourMind = (updates: Partial<SpeakYourMindData>) => {
    if (!data.speakYourMind) return;
    onChange({
      ...data,
      speakYourMind: { ...data.speakYourMind, ...updates }
    });
  };

  // Update the grammar tip data
  const updateGrammarTip = (updates: Partial<GrammarTipData>) => {
    if (!data.grammarTip) return;
    onChange({
      ...data,
      grammarTip: { ...data.grammarTip, ...updates }
    });
  };

  // Update speaker data
  const updateSpeaker = (speakerNum: 1 | 2, updates: Partial<ConversationSpeaker>) => {
    if (!data.speakYourMind) return;
    const key = speakerNum === 1 ? 'speaker1' : 'speaker2';
    onChange({
      ...data,
      speakYourMind: {
        ...data.speakYourMind,
        [key]: { ...data.speakYourMind[key], ...updates }
      }
    });
  };

  // Tutor step handlers for Speak Your Mind
  const handleTutorStepChange = (idx: number, field: string, value: any) => {
    if (!data.speakYourMind) return;
    const newSteps = [...data.speakYourMind.tutorSteps];
    newSteps[idx] = { ...newSteps[idx], [field]: value };
    updateSpeakYourMind({ tutorSteps: newSteps });
  };

  const handleAddTutorStep = () => {
    if (!data.speakYourMind) return;
    updateSpeakYourMind({
      tutorSteps: [...data.speakYourMind.tutorSteps, { instruction: '', script: null, tip: null }]
    });
  };

  const handleRemoveTutorStep = (idx: number) => {
    if (!data.speakYourMind) return;
    updateSpeakYourMind({
      tutorSteps: data.speakYourMind.tutorSteps.filter((_, i) => i !== idx)
    });
  };

  // Tutor step handlers for Grammar Tip
  const handleGrammarTutorStepChange = (idx: number, field: string, value: any) => {
    if (!data.grammarTip) return;
    const newSteps = [...data.grammarTip.tutorSteps];
    newSteps[idx] = { ...newSteps[idx], [field]: value };
    updateGrammarTip({ tutorSteps: newSteps });
  };

  const handleAddGrammarTutorStep = () => {
    if (!data.grammarTip) return;
    updateGrammarTip({
      tutorSteps: [...data.grammarTip.tutorSteps, { instruction: '', script: null, tip: null }]
    });
  };

  const handleRemoveGrammarTutorStep = (idx: number) => {
    if (!data.grammarTip) return;
    updateGrammarTip({
      tutorSteps: data.grammarTip.tutorSteps.filter((_, i) => i !== idx)
    });
  };

  // Grammar explanation handlers
  const handleExplanationChange = (idx: number, field: keyof GrammarExplanation, value: any) => {
    if (!data.grammarTip) return;
    const newExplanations = [...data.grammarTip.explanations];
    newExplanations[idx] = { ...newExplanations[idx], [field]: value };
    updateGrammarTip({ explanations: newExplanations });
  };

  const handleAddExplanation = () => {
    if (!data.grammarTip) return;
    updateGrammarTip({
      explanations: [...data.grammarTip.explanations, { ruleText: '', ruleTranslation: '' }]
    });
  };

  const handleRemoveExplanation = (idx: number) => {
    if (!data.grammarTip) return;
    updateGrammarTip({
      explanations: data.grammarTip.explanations.filter((_, i) => i !== idx)
    });
  };

  // Grammar example handlers
  const handleExampleChange = (explIdx: number, exIdx: number, field: keyof GrammarExample, value: string) => {
    if (!data.grammarTip) return;
    const newExplanations = [...data.grammarTip.explanations];
    const newExamples = [...(newExplanations[explIdx].examples || [])];
    newExamples[exIdx] = { ...newExamples[exIdx], [field]: value };
    newExplanations[explIdx] = { ...newExplanations[explIdx], examples: newExamples };
    updateGrammarTip({ explanations: newExplanations });
  };

  const handleAddExample = (explIdx: number) => {
    if (!data.grammarTip) return;
    const newExplanations = [...data.grammarTip.explanations];
    const currentExamples = newExplanations[explIdx].examples || [];
    newExplanations[explIdx] = {
      ...newExplanations[explIdx],
      examplesTitle: newExplanations[explIdx].examplesTitle || 'EXAMPLES',
      examples: [...currentExamples, { sentence: '', translation: '' }]
    };
    updateGrammarTip({ explanations: newExplanations });
  };

  const handleRemoveExample = (explIdx: number, exIdx: number) => {
    if (!data.grammarTip) return;
    const newExplanations = [...data.grammarTip.explanations];
    const newExamples = (newExplanations[explIdx].examples || []).filter((_, i) => i !== exIdx);
    newExplanations[explIdx] = { 
      ...newExplanations[explIdx], 
      examples: newExamples.length > 0 ? newExamples : undefined,
      examplesTitle: newExamples.length > 0 ? newExplanations[explIdx].examplesTitle : undefined
    };
    updateGrammarTip({ explanations: newExplanations });
  };

  // ========== PRONUNCIATION HANDLERS ==========
  
  // Update the pronunciation data
  const updatePronunciation = (updates: Partial<StepBPronunciationData>) => {
    if (!data.pronunciation) return;
    onChange({
      ...data,
      pronunciation: { ...data.pronunciation, ...updates }
    });
  };

  // Tutor step handlers for Pronunciation
  const handlePronunciationTutorStepChange = (idx: number, field: string, value: any) => {
    if (!data.pronunciation) return;
    const newSteps = [...data.pronunciation.tutorSteps];
    newSteps[idx] = { ...newSteps[idx], [field]: value };
    updatePronunciation({ tutorSteps: newSteps });
  };

  const handleAddPronunciationTutorStep = () => {
    if (!data.pronunciation) return;
    updatePronunciation({
      tutorSteps: [...data.pronunciation.tutorSteps, { instruction: '', script: null, tip: null }]
    });
  };

  const handleRemovePronunciationTutorStep = (idx: number) => {
    if (!data.pronunciation) return;
    updatePronunciation({
      tutorSteps: data.pronunciation.tutorSteps.filter((_, i) => i !== idx)
    });
  };

  // Pronunciation phrase handlers
  const handlePhraseChange = (idx: number, field: keyof PronunciationPhrase, value: string) => {
    if (!data.pronunciation) return;
    const newPhrases = [...data.pronunciation.phrases];
    newPhrases[idx] = { ...newPhrases[idx], [field]: value };
    updatePronunciation({ phrases: newPhrases });
  };

  const handleAddPhrase = () => {
    if (!data.pronunciation) return;
    updatePronunciation({
      phrases: [...data.pronunciation.phrases, { phrase: '', pronunciationGuide: '', exampleSentence: '' }]
    });
  };

  const handleRemovePhrase = (idx: number) => {
    if (!data.pronunciation) return;
    updatePronunciation({
      phrases: data.pronunciation.phrases.filter((_, i) => i !== idx)
    });
  };

  // Image upload handlers
  const handleSpeakerImageClick = (speakerNum: 1 | 2) => {
    setActiveSpeaker(speakerNum);
    if (speakerNum === 1) {
      speaker1ImageInputRef.current?.click();
    } else {
      speaker2ImageInputRef.current?.click();
    }
  };

  const handleSpeakerImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !activeSpeaker) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateSpeaker(activeSpeaker, { image: reader.result as string });
    };
    reader.readAsDataURL(file);
    (e.target as HTMLInputElement).value = '';
  };

  // Get current tutor steps based on type
  const getCurrentTutorSteps = () => {
    if (data.stepType === 'speak-your-mind' && data.speakYourMind) {
      return data.speakYourMind.tutorSteps;
    }
    if (data.stepType === 'grammar-tip' && data.grammarTip) {
      return data.grammarTip.tutorSteps;
    }
    if (data.stepType === 'pronunciation' && data.pronunciation) {
      return data.pronunciation.tutorSteps;
    }
    return [];
  };

  const getCurrentStepName = () => {
    if (data.stepType === 'speak-your-mind' && data.speakYourMind) {
      return data.speakYourMind.stepName;
    }
    if (data.stepType === 'grammar-tip' && data.grammarTip) {
      return data.grammarTip.stepName;
    }
    if (data.stepType === 'pronunciation' && data.pronunciation) {
      return data.pronunciation.stepName;
    }
    return 'STEP B';
  };

  const getCurrentDuration = () => {
    if (data.stepType === 'speak-your-mind' && data.speakYourMind) {
      return data.speakYourMind.duration;
    }
    if (data.stepType === 'grammar-tip' && data.grammarTip) {
      return data.grammarTip.duration;
    }
    if (data.stepType === 'pronunciation' && data.pronunciation) {
      return data.pronunciation.duration;
    }
    return '1 minute';
  };

  const setCurrentDuration = (duration: string) => {
    if (data.stepType === 'speak-your-mind') {
      updateSpeakYourMind({ duration });
    } else if (data.stepType === 'grammar-tip') {
      updateGrammarTip({ duration });
    } else if (data.stepType === 'pronunciation') {
      updatePronunciation({ duration });
    }
  };

  const tutorSteps = getCurrentTutorSteps();
  const handleCurrentTutorStepChange = 
    data.stepType === 'speak-your-mind' ? handleTutorStepChange : 
    data.stepType === 'grammar-tip' ? handleGrammarTutorStepChange :
    handlePronunciationTutorStepChange;
  const handleCurrentAddTutorStep = 
    data.stepType === 'speak-your-mind' ? handleAddTutorStep : 
    data.stepType === 'grammar-tip' ? handleAddGrammarTutorStep :
    handleAddPronunciationTutorStep;
  const handleCurrentRemoveTutorStep = 
    data.stepType === 'speak-your-mind' ? handleRemoveTutorStep : 
    data.stepType === 'grammar-tip' ? handleRemoveGrammarTutorStep :
    handleRemovePronunciationTutorStep;

  return (
    <section className="csve-section csve-stepb-section">
      {/* Step Type Switcher */}
      <div className="csve-step-type-switcher">
        <span className="csve-switcher-label">Step B Type:</span>
        <div className="csve-switcher-buttons">
          <button
            className={`csve-switcher-btn ${data.stepType === 'speak-your-mind' ? 'active' : ''}`}
            onClick={() => handleSwitchStepBType('speak-your-mind')}
          >
            <i className="ri-chat-smile-2-line" />
            Speak Your Mind
          </button>
          <button
            className={`csve-switcher-btn ${data.stepType === 'grammar-tip' ? 'active' : ''}`}
            onClick={() => handleSwitchStepBType('grammar-tip')}
          >
            <i className="ri-lightbulb-line" />
            Grammar Tip
          </button>
          <button
            className={`csve-switcher-btn ${data.stepType === 'pronunciation' ? 'active' : ''}`}
            onClick={() => handleSwitchStepBType('pronunciation')}
          >
            <i className="ri-speak-line" />
            Pronunciation
          </button>
        </div>
      </div>

      <div className="csve-stepb-content">
        {/* Left Column - Content */}
        <div className="csve-stepb-left">
          {/* SPEAK YOUR MIND CONTENT */}
          {data.stepType === 'speak-your-mind' && data.speakYourMind && (
            <>
              {/* Step Name Header */}
              <input
                type="text"
                className="csve-stepb-name"
                value={data.speakYourMind.stepName}
                onChange={e => updateSpeakYourMind({ stepName: (e.target as HTMLInputElement).value })}
                placeholder="STEP B SPEAK YOUR MIND"
              />

              {/* Explanation */}
              <input
                type="text"
                className="csve-stepb-explanation"
                value={data.speakYourMind.explanation}
                onChange={e => updateSpeakYourMind({ explanation: (e.target as HTMLInputElement).value })}
                placeholder="Enter the grammar/phrase explanation..."
              />

              {/* Explanation Translation */}
              {data.speakYourMind.explanationTranslation !== undefined ? (
                <div className="csve-translation-row">
                  <input
                    type="text"
                    className="csve-translation-input"
                    value={data.speakYourMind.explanationTranslation}
                    onChange={e => updateSpeakYourMind({ explanationTranslation: (e.target as HTMLInputElement).value })}
                    placeholder="Enter translation..."
                  />
                  <button
                    type="button"
                    className="csve-remove-translation-btn"
                    onClick={() => updateSpeakYourMind({ explanationTranslation: undefined })}
                    title="Remove translation"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="csve-add-translation-btn"
                  onClick={() => updateSpeakYourMind({ explanationTranslation: '' })}
                >
                  + Add Translation
                </button>
              )}

              {/* Conversation */}
              <div className="csve-conversation">
                {/* Speaker 1 - Left side (asks question) */}
                <div className="csve-conversation-row csve-speaker-left">
                  <div 
                    className="csve-speaker-image"
                    onClick={() => handleSpeakerImageClick(1)}
                  >
                    {data.speakYourMind.speaker1.image ? (
                      <img src={data.speakYourMind.speaker1.image} alt="Speaker 1" />
                    ) : (
                      <div className="csve-image-placeholder csve-speaker-placeholder">
                        <span className="csve-placeholder-dims">150 × 150</span>
                        <span className="csve-placeholder-text">Click to add</span>
                      </div>
                    )}
                  </div>
                  <div className="csve-speech-bubble csve-speech-left">
                    <RichTextInput
                      value={data.speakYourMind.speaker1.speechBubble}
                      onChange={html => updateSpeaker(1, { speechBubble: html })}
                      placeholder="Enter the question/prompt..."
                      className="csve-speech-input"
                      singleLine={false}
                    />
                  </div>
                </div>

                {/* Speaker 2 - Right side (gives response with grammar phrase) */}
                <div className="csve-conversation-row csve-speaker-right">
                  <div className="csve-speech-bubble csve-speech-right">
                    <RichTextInput
                      value={data.speakYourMind.speaker2.speechBubble}
                      onChange={html => updateSpeaker(2, { speechBubble: html })}
                      placeholder="Enter the response (use Ctrl+B to bold the key phrase)..."
                      className="csve-speech-input"
                      singleLine={false}
                    />
                  </div>
                  <div 
                    className="csve-speaker-image"
                    onClick={() => handleSpeakerImageClick(2)}
                  >
                    {data.speakYourMind.speaker2.image ? (
                      <img src={data.speakYourMind.speaker2.image} alt="Speaker 2" />
                    ) : (
                      <div className="csve-image-placeholder csve-speaker-placeholder">
                        <span className="csve-placeholder-dims">150 × 150</span>
                        <span className="csve-placeholder-text">Click to add</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* GRAMMAR TIP CONTENT */}
          {data.stepType === 'grammar-tip' && data.grammarTip && (
            <>
              {/* Step Name Header */}
              <input
                type="text"
                className="csve-stepb-name"
                value={data.grammarTip.stepName}
                onChange={e => updateGrammarTip({ stepName: (e.target as HTMLInputElement).value })}
                placeholder="STEP B GRAMMAR TIP"
              />

              {/* Grammar Explanations */}
              <div className="csve-grammar-explanations">
                {data.grammarTip.explanations.map((expl, explIdx) => (
                  <div key={explIdx} className="csve-grammar-block">
                    {/* Rule text - Rich text for bold/italic */}
                    <div className="csve-grammar-rule">
                      <RichTextInput
                        value={expl.ruleText}
                        onChange={html => handleExplanationChange(explIdx, 'ruleText', html)}
                        placeholder="Enter grammar rule (use Ctrl+B for bold, Ctrl+I for italic)..."
                        className="csve-grammar-rule-input"
                        singleLine={false}
                      />
                    </div>
                    
                    {/* Rule translation */}
                    <input
                      type="text"
                      className="csve-grammar-translation"
                      value={expl.ruleTranslation}
                      onChange={e => handleExplanationChange(explIdx, 'ruleTranslation', (e.target as HTMLInputElement).value)}
                      placeholder="Translation..."
                    />

                    {/* Examples Box (optional) */}
                    {expl.examples && expl.examples.length > 0 ? (
                      <div className="csve-grammar-examples-box">
                        <input
                          type="text"
                          className="csve-examples-title"
                          value={expl.examplesTitle || 'EXAMPLES'}
                          onChange={e => handleExplanationChange(explIdx, 'examplesTitle', (e.target as HTMLInputElement).value)}
                          placeholder="EXAMPLES"
                        />
                        <div className="csve-examples-list">
                          {expl.examples.map((ex, exIdx) => (
                            <div key={exIdx} className="csve-example-item">
                              <span className="csve-example-bullet">•</span>
                              <div className="csve-example-content">
                                <RichTextInput
                                  value={ex.sentence}
                                  onChange={html => handleExampleChange(explIdx, exIdx, 'sentence', html)}
                                  placeholder="Example sentence (use Ctrl+B for bold)..."
                                  className="csve-example-sentence"
                                  singleLine={true}
                                />
                                <input
                                  type="text"
                                  className="csve-example-translation"
                                  value={ex.translation}
                                  onChange={e => handleExampleChange(explIdx, exIdx, 'translation', (e.target as HTMLInputElement).value)}
                                  placeholder="Translation..."
                                />
                              </div>
                              {expl.examples!.length > 1 && (
                                <button 
                                  className="csve-example-remove"
                                  onClick={() => handleRemoveExample(explIdx, exIdx)}
                                >
                                  <i className="ri-close-line" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button className="csve-add-example-btn" onClick={() => handleAddExample(explIdx)}>
                          <i className="ri-add-line" /> Add Example
                        </button>
                      </div>
                    ) : (
                      <button className="csve-add-examples-btn" onClick={() => handleAddExample(explIdx)}>
                        <i className="ri-add-line" /> Add Examples Box
                      </button>
                    )}

                    {/* Remove explanation button */}
                    {data.grammarTip!.explanations.length > 1 && (
                      <button 
                        className="csve-remove-explanation-btn"
                        onClick={() => handleRemoveExplanation(explIdx)}
                      >
                        <i className="ri-delete-bin-line" /> Remove Block
                      </button>
                    )}
                  </div>
                ))}

                <button className="csve-add-explanation-btn" onClick={handleAddExplanation}>
                  <i className="ri-add-line" /> Add Grammar Block
                </button>
              </div>
            </>
          )}

          {/* PRONUNCIATION CONTENT */}
          {data.stepType === 'pronunciation' && data.pronunciation && (
            <>
              {/* Step Name Header */}
              <input
                type="text"
                className="csve-stepb-name"
                value={data.pronunciation.stepName}
                onChange={e => updatePronunciation({ stepName: (e.target as HTMLInputElement).value })}
                placeholder="STEP B PRONUNCIATION"
              />

              {/* Pronunciation Tip */}
              <div className="csve-pronunciation-tip">
                <RichTextInput
                  value={data.pronunciation.tip}
                  onChange={html => updatePronunciation({ tip: html })}
                  placeholder="Enter pronunciation tip (e.g., When one word ends with a consonant sound and the next word starts with a vowel sound, they are often linked together.)"
                  className="csve-pronunciation-tip-input"
                  singleLine={false}
                />
              </div>

              {/* Phrases Table */}
              <div className="csve-pronunciation-table">
                <div className="csve-pronunciation-header">
                  <div className="csve-pronunciation-col-phrase">Phrase</div>
                  <div className="csve-pronunciation-col-example">Example</div>
                </div>
                
                {data.pronunciation.phrases.map((phrase, phraseIdx) => (
                  <div key={phraseIdx} className="csve-pronunciation-row">
                    <div className="csve-pronunciation-col-phrase">
                      <input
                        type="text"
                        className="csve-phrase-text"
                        value={phrase.phrase}
                        onChange={e => handlePhraseChange(phraseIdx, 'phrase', (e.target as HTMLInputElement).value)}
                        placeholder="cost a fortune"
                      />
                      <input
                        type="text"
                        className="csve-phrase-guide"
                        value={phrase.pronunciationGuide}
                        onChange={e => handlePhraseChange(phraseIdx, 'pronunciationGuide', (e.target as HTMLInputElement).value)}
                        placeholder="/ cos-ta fortune /"
                      />
                    </div>
                    <div className="csve-pronunciation-col-example">
                      <RichTextInput
                        value={phrase.exampleSentence}
                        onChange={html => handlePhraseChange(phraseIdx, 'exampleSentence', html)}
                        placeholder="That vacation must have cost a fortune!"
                        className="csve-phrase-example"
                        singleLine={true}
                      />
                      {data.pronunciation!.phrases.length > 1 && (
                        <button 
                          className="csve-phrase-remove"
                          onClick={() => handleRemovePhrase(phraseIdx)}
                        >
                          <i className="ri-close-line" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                <button className="csve-add-phrase-btn" onClick={handleAddPhrase}>
                  <i className="ri-add-line" /> Add Phrase
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csve-stepb-right">
          <TutorGuide
            title="PRACTICE"
            duration={getCurrentDuration()}
            steps={tutorSteps as UniversalTutorStep[]}
            onStepsChange={(steps) => {
              if (data.stepType === 'speak-your-mind') {
                updateSpeakYourMind({ tutorSteps: steps as TutorStep[] });
              } else if (data.stepType === 'grammar-tip') {
                updateGrammarTip({ tutorSteps: steps as TutorStep[] });
              } else if (data.stepType === 'pronunciation') {
                updatePronunciation({ tutorSteps: steps as TutorStep[] });
              }
            }}
            onDurationChange={setCurrentDuration}
            features={{ showScripts: true, showTips: true, legacyMode: true }}
            className="csve-editable-card"
          />
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={speaker1ImageInputRef} type="file" accept="image/*" onChange={handleSpeakerImageUpload} style={{ display: 'none' }} />
      <input ref={speaker2ImageInputRef} type="file" accept="image/*" onChange={handleSpeakerImageUpload} style={{ display: 'none' }} />
    </section>
  );
}

// ============================================================================
// APPLY SECTION EDITOR (Section 3 - Speaking/Understanding)
// ============================================================================

interface ApplySectionEditorProps {
  data: ApplySectionData;
  onChange: (data: ApplySectionData) => void;
}

function ApplySectionEditor({ data, onChange }: ApplySectionEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const readingImageInputRef = useRef<HTMLInputElement>(null);
  const triviaImageInputRef = useRef<HTMLInputElement>(null);

  // Update main data
  const updateData = (updates: Partial<ApplySectionData>) => {
    onChange({ ...data, ...updates });
  };

  // Switch activity type handler
  const handleSwitchActivityType = (newType: ApplyActivityType) => {
    if (newType === data.activityType) return;
    
    if (newType === 'speaking') {
      onChange({
        ...DEFAULT_APPLY_SPEAKING,
        sectionNumber: data.sectionNumber,
        sectionTitle: data.sectionTitle,
        situationImage: data.situationImage,
      });
    } else if (newType === 'listening') {
      onChange({
        ...DEFAULT_APPLY_LISTENING,
        sectionNumber: data.sectionNumber,
        sectionTitle: data.sectionTitle,
        situationImage: data.situationImage,
      });
    } else {
      onChange({
        ...DEFAULT_APPLY_READING,
        sectionNumber: data.sectionNumber,
        sectionTitle: data.sectionTitle,
        situationImage: data.situationImage,
      });
    }
  };

  // Listening script handler
  const handleListeningScriptChange = (stepIndex: number, value: string) => {
    const newSteps = [...data.tutorSteps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], listeningScript: value };
    updateData({ tutorSteps: newSteps });
  };

  const handleAddListeningScript = (stepIndex: number) => {
    const newSteps = [...data.tutorSteps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], listeningScript: "" };
    updateData({ tutorSteps: newSteps });
  };

  const handleRemoveListeningScript = (stepIndex: number) => {
    const newSteps = [...data.tutorSteps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], listeningScript: undefined };
    updateData({ tutorSteps: newSteps });
  };

  // Dialogue line handlers
  const handleDialogueChange = (index: number, field: keyof DialogueLine, value: string | boolean) => {
    const newLines = [...data.dialogueLines];
    newLines[index] = { ...newLines[index], [field]: value };
    updateData({ dialogueLines: newLines });
  };

  const handleAddDialogueLine = () => {
    const lastSpeaker = data.dialogueLines.length > 0 
      ? data.dialogueLines[data.dialogueLines.length - 1].speaker 
      : "Speaker";
    updateData({
      dialogueLines: [...data.dialogueLines, { speaker: lastSpeaker, text: "" }]
    });
  };

  const handleRemoveDialogueLine = (index: number) => {
    updateData({
      dialogueLines: data.dialogueLines.filter((_, i) => i !== index)
    });
  };

  // Tutor step handlers
  const handleTutorStepChange = (index: number, field: keyof ApplyTutorStep, value: any) => {
    const newSteps = [...data.tutorSteps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    updateData({ tutorSteps: newSteps });
  };

  const handleAddTutorStep = () => {
    updateData({
      tutorSteps: [...data.tutorSteps, { instruction: "" }]
    });
  };

  const handleRemoveTutorStep = (index: number) => {
    updateData({
      tutorSteps: data.tutorSteps.filter((_, i) => i !== index)
    });
  };

  // Script bullet handlers
  const handleAddScript = (stepIndex: number) => {
    const newSteps = [...data.tutorSteps];
    const currentScripts = newSteps[stepIndex].scripts || [];
    newSteps[stepIndex] = { ...newSteps[stepIndex], scripts: [...currentScripts, { text: "" }] };
    updateData({ tutorSteps: newSteps });
  };

  const handleScriptChange = (stepIndex: number, scriptIndex: number, value: string) => {
    const newSteps = [...data.tutorSteps];
    const scripts = [...(newSteps[stepIndex].scripts || [])];
    scripts[scriptIndex] = { text: value };
    newSteps[stepIndex] = { ...newSteps[stepIndex], scripts };
    updateData({ tutorSteps: newSteps });
  };

  const handleRemoveScript = (stepIndex: number, scriptIndex: number) => {
    const newSteps = [...data.tutorSteps];
    const scripts = (newSteps[stepIndex].scripts || []).filter((_, i) => i !== scriptIndex);
    newSteps[stepIndex] = { ...newSteps[stepIndex], scripts: scripts.length > 0 ? scripts : undefined };
    updateData({ tutorSteps: newSteps });
  };

  // Tip handlers
  const handleAddTip = (stepIndex: number) => {
    const newSteps = [...data.tutorSteps];
    const currentTips = newSteps[stepIndex].tips || [];
    newSteps[stepIndex] = { ...newSteps[stepIndex], tips: [...currentTips, { text: "" }] };
    updateData({ tutorSteps: newSteps });
  };

  const handleTipChange = (stepIndex: number, tipIndex: number, value: string) => {
    const newSteps = [...data.tutorSteps];
    const tips = [...(newSteps[stepIndex].tips || [])];
    tips[tipIndex] = { text: value };
    newSteps[stepIndex] = { ...newSteps[stepIndex], tips };
    updateData({ tutorSteps: newSteps });
  };

  const handleRemoveTip = (stepIndex: number, tipIndex: number) => {
    const newSteps = [...data.tutorSteps];
    const tips = (newSteps[stepIndex].tips || []).filter((_, i) => i !== tipIndex);
    newSteps[stepIndex] = { ...newSteps[stepIndex], tips: tips.length > 0 ? tips : undefined };
    updateData({ tutorSteps: newSteps });
  };

  // Question handlers
  const handleAddQuestion = (stepIndex: number) => {
    const newSteps = [...data.tutorSteps];
    const currentQuestions = newSteps[stepIndex].questions || [];
    newSteps[stepIndex] = { ...newSteps[stepIndex], questions: [...currentQuestions, { question: "", answer: "" }] };
    updateData({ tutorSteps: newSteps });
  };

  const handleQuestionChange = (stepIndex: number, qIndex: number, field: 'question' | 'answer', value: string) => {
    const newSteps = [...data.tutorSteps];
    const questions = [...(newSteps[stepIndex].questions || [])];
    questions[qIndex] = { ...questions[qIndex], [field]: value };
    newSteps[stepIndex] = { ...newSteps[stepIndex], questions };
    updateData({ tutorSteps: newSteps });
  };

  const handleRemoveQuestion = (stepIndex: number, qIndex: number) => {
    const newSteps = [...data.tutorSteps];
    const questions = (newSteps[stepIndex].questions || []).filter((_, i) => i !== qIndex);
    newSteps[stepIndex] = { ...newSteps[stepIndex], questions: questions.length > 0 ? questions : undefined };
    updateData({ tutorSteps: newSteps });
  };

  // Image upload handler
  const handleImageClick = () => {
    imageInputRef.current?.click();
  };

  const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateData({ situationImage: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  // Reading image upload handler
  const handleReadingImageClick = () => {
    readingImageInputRef.current?.click();
  };

  const handleReadingImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateData({ readingImage: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  // Trivia image upload handler
  const handleTriviaImageClick = () => {
    triviaImageInputRef.current?.click();
  };

  const handleTriviaImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateData({ triviaImage: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="csve-section csve-apply-section">
      {/* Section Header - matches Section 2 */}
      <div className="csve-section-number">
        <span className="csve-number-badge">{data.sectionNumber}</span>
        <h2 className="csve-section-title">{data.sectionTitle}</h2>
        <div className="csve-section-line" />
      </div>

      {/* Activity Type Switcher */}
      <div className="csve-step-type-switcher">
        <span className="csve-switcher-label">Activity Type:</span>
        <div className="csve-switcher-buttons">
          <button
            className={`csve-switcher-btn ${data.activityType === 'speaking' ? 'active' : ''}`}
            onClick={() => handleSwitchActivityType('speaking')}
          >
            <i className="ri-speak-line" />
            Speaking
          </button>
          <button
            className={`csve-switcher-btn ${data.activityType === 'listening' ? 'active' : ''}`}
            onClick={() => handleSwitchActivityType('listening')}
          >
            <i className="ri-headphone-line" />
            Listening
          </button>
          <button
            className={`csve-switcher-btn ${data.activityType === 'reading' ? 'active' : ''}`}
            onClick={() => handleSwitchActivityType('reading')}
          >
            <i className="ri-file-text-line" />
            Reading
          </button>
        </div>
      </div>

      {/* Activity Title */}
      <h3 className="csve-step-name">{data.activityTitle}</h3>

      <div className="csve-apply-content">
        {/* Left Column - Main Content */}
        <div className="csve-apply-left">
          {/* Situation Text */}
          <div className="csve-situation-block">
            <input
              type="text"
              className="csve-apply-situation"
              value={data.situationText}
              onChange={e => updateData({ situationText: (e.target as HTMLInputElement).value })}
              placeholder="Describe the situation..."
            />
            {data.situationTranslation !== undefined ? (
              <div className="csve-translation-row">
                <input
                  type="text"
                  className="csve-translation-input"
                  value={data.situationTranslation}
                  onChange={e => updateData({ situationTranslation: (e.target as HTMLInputElement).value })}
                  placeholder="Translation..."
                />
                <button
                  className="csve-remove-translation-btn"
                  onClick={() => updateData({ situationTranslation: undefined })}
                  title="Remove translation"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
            ) : (
              <button
                className="csve-add-translation-btn"
                onClick={() => updateData({ situationTranslation: '' })}
              >
                <i className="ri-translate-2" /> Add Translation
              </button>
            )}
          </div>

          {/* Situation Image */}
          <div 
            className="csve-apply-image"
            onClick={handleImageClick}
          >
            {data.situationImage ? (
              <img src={data.situationImage} alt="Situation" />
            ) : (
              <div className="csve-image-placeholder csve-apply-img-placeholder">
                <span className="csve-placeholder-dims">600 × 300</span>
                <span className="csve-placeholder-text">Click to add image</span>
              </div>
            )}
          </div>

          {/* Dialogue Lines (SPEAKING only) */}
          {data.activityType === 'speaking' && (
          <div className="csve-dialogue-lines">
            {data.dialogueLines.map((line, lineIdx) => (
              <div key={lineIdx} className="csve-dialogue-line">
                <input
                  type="text"
                  className="csve-dialogue-speaker"
                  value={line.speaker}
                  onChange={e => handleDialogueChange(lineIdx, 'speaker', (e.target as HTMLInputElement).value)}
                  placeholder="Speaker"
                />
                <span className="csve-dialogue-colon">:</span>
                {line.isAction ? (
                  <input
                    type="text"
                    className="csve-dialogue-text csve-dialogue-action"
                    value={line.text}
                    onChange={e => handleDialogueChange(lineIdx, 'text', (e.target as HTMLInputElement).value)}
                    placeholder="(action)"
                  />
                ) : (
                  <RichTextInput
                    value={line.text}
                    onChange={html => handleDialogueChange(lineIdx, 'text', html)}
                    placeholder="Dialogue text (Ctrl+U for underline)..."
                    className="csve-dialogue-text"
                    singleLine={false}
                  />
                )}
                <label className="csve-dialogue-action-toggle">
                  <input
                    type="checkbox"
                    checked={line.isAction || false}
                    onChange={e => handleDialogueChange(lineIdx, 'isAction', (e.target as HTMLInputElement).checked)}
                  />
                  <span>Action</span>
                </label>
                {data.dialogueLines.length > 1 && (
                  <button 
                    className="csve-dialogue-remove"
                    onClick={() => handleRemoveDialogueLine(lineIdx)}
                  >
                    <i className="ri-close-line" />
                  </button>
                )}
              </div>
            ))}
            <button className="csve-add-dialogue-btn" onClick={handleAddDialogueLine}>
              <i className="ri-add-line" /> Add Dialogue Line
            </button>
          </div>
          )}

          {/* Reading Text (READING only) */}
          {data.activityType === 'reading' && (
            <div className="csve-reading-text-box">
              <div className="csve-reading-text-header">
                <span>Reading Text</span>
                <button 
                  className="csve-add-reading-image-btn"
                  onClick={handleReadingImageClick}
                >
                  <i className="ri-image-add-line" /> {data.readingImage ? 'Change Image' : 'Add Image'}
                </button>
              </div>
              
              <div className="csve-reading-text-content">
                {/* Optional Reading Image (like profile card) */}
                {data.readingImage && (
                  <div className="csve-reading-image-container">
                    <img src={data.readingImage} alt="Reading" />
                    <RichTextInput
                      value={data.readingImageLabel || ''}
                      onChange={html => updateData({ readingImageLabel: html })}
                      placeholder="Add label (e.g., Name, Age)..."
                      className="csve-reading-image-label-input"
                      singleLine={false}
                    />
                    <button 
                      className="csve-remove-reading-image-btn"
                      onClick={() => updateData({ readingImage: '', readingImageLabel: '' })}
                    >
                      <i className="ri-close-line" /> Remove
                    </button>
                  </div>
                )}
                
                <RichTextInput
                  value={data.readingText || ''}
                  onChange={html => updateData({ readingText: html })}
                  placeholder="Enter the reading text... (Ctrl+U for underline)"
                  className="csve-reading-text-input"
                  singleLine={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csve-apply-right">
          <TutorGuide
            title={`${data.sectionTitle} - ${data.activityTitle}`}
            duration={data.activityDuration}
            steps={data.tutorSteps as UniversalTutorStep[]}
            onStepsChange={(steps) => updateData({ tutorSteps: steps as ApplyTutorStep[] })}
            onDurationChange={(duration) => updateData({ activityDuration: duration })}
            features={{
              showScripts: true,
              showTips: true,
              showQuestions: true,
              showAnswerKey: false,
              showListeningScript: data.activityType === 'listening',
            }}
            RichTextInput={RichTextInput}
            className="csve-editable-card"
          />
        </div>
      </div>

      {/* Trivia Time Section - always enabled */}
      <div className="csve-trivia-content-row">
          {/* Left - Trivia Box */}
          <div className="csve-trivia-left">
            <div className="csve-trivia-box">
              <div className="csve-trivia-header">
                <span className="csve-trivia-header-left">
                  <i className="ri-lightbulb-line" />
                  <span>TRIVIA TIME</span>
                </span>
                <button 
                  className="csve-add-trivia-image-btn"
                  onClick={handleTriviaImageClick}
                >
                  <i className="ri-image-add-line" /> {data.triviaImage ? 'Change Image' : 'Add Image'}
                </button>
              </div>
              <div className="csve-trivia-body">
                {data.triviaImage && (
                  <div className="csve-trivia-image-container">
                    <img src={data.triviaImage} alt="Trivia" />
                    <button 
                      className="csve-remove-trivia-image-btn"
                      onClick={() => updateData({ triviaImage: '' })}
                    >
                      <i className="ri-close-line" /> Remove
                    </button>
                  </div>
                )}
                <RichTextInput
                  value={data.triviaText || ''}
                  onChange={html => updateData({ triviaText: html })}
                  placeholder="Enter trivia content..."
                  className="csve-trivia-text-input"
                  singleLine={false}
                />
                {data.triviaTranslation !== undefined ? (
                  <div className="csve-translation-row">
                    <input
                      type="text"
                      className="csve-translation-input"
                      value={data.triviaTranslation}
                      onChange={e => updateData({ triviaTranslation: (e.target as HTMLInputElement).value })}
                      placeholder="Translation..."
                    />
                    <button
                      className="csve-remove-translation-btn"
                      onClick={() => updateData({ triviaTranslation: undefined })}
                      title="Remove translation"
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="csve-add-translation-btn"
                    onClick={() => updateData({ triviaTranslation: '' })}
                  >
                    <i className="ri-translate-2" /> Add Translation
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right - Trivia Tutor Guide */}
          <div className="csve-trivia-right">
            <TutorGuide
              title="TRIVIA TIME"
              duration={data.triviaDuration || '1 minute'}
              steps={(data.triviaTutorSteps || []) as UniversalTutorStep[]}
              onStepsChange={(steps) => updateData({ triviaTutorSteps: steps as TriviaTutorStep[] })}
              onDurationChange={(duration) => updateData({ triviaDuration: duration })}
              features={{ showScripts: true, showQuestions: true }}
              className="csve-editable-card"
            />
          </div>
        </div>

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
      <input ref={readingImageInputRef} type="file" accept="image/*" onChange={handleReadingImageUpload} style={{ display: 'none' }} />
      <input ref={triviaImageInputRef} type="file" accept="image/*" onChange={handleTriviaImageUpload} style={{ display: 'none' }} />
    </section>
  );
}

// ============================================================================
// EXERCISE SECTION EDITOR (Section 4)
// ============================================================================

interface ExerciseSectionEditorProps {
  data: ExerciseSectionData;
  onChange: (data: ExerciseSectionData) => void;
}

function ExerciseSectionEditor({ data, onChange }: ExerciseSectionEditorProps) {
  const imageInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const exampleImageRef = useRef<HTMLInputElement | null>(null);
  const convImageInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const mcImageInputRef = useRef<HTMLInputElement | null>(null);
  const speechImageRef = useRef<HTMLInputElement | null>(null);
  const compareImageRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const updateData = (updates: Partial<ExerciseSectionData>) => {
    onChange({ ...data, ...updates });
  };

  // Keyboard shortcut handler for bold, italic, underline
  const handleFormatKeyDown = (
    e: KeyboardEvent,
    getValue: () => string,
    setValue: (newValue: string) => void
  ) => {
    if (!e.ctrlKey && !e.metaKey) return;
    
    const input = e.target as HTMLInputElement | HTMLTextAreaElement;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const selectedText = getValue().substring(start, end);
    
    if (selectedText.length === 0) return;
    
    let tag = '';
    if (e.key === 'b' || e.key === 'B') {
      tag = 'b';
    } else if (e.key === 'i' || e.key === 'I') {
      tag = 'i';
    } else if (e.key === 'u' || e.key === 'U') {
      tag = 'u';
    }
    
    if (tag) {
      e.preventDefault();
      const before = getValue().substring(0, start);
      const after = getValue().substring(end);
      const wrapped = `<${tag}>${selectedText}</${tag}>`;
      const newValue = before + wrapped + after;
      setValue(newValue);
      
      // Restore cursor position after the wrapped text
      requestAnimationFrame(() => {
        const newEnd = start + wrapped.length;
        input.setSelectionRange(newEnd, newEnd);
      });
    }
  };

  // Toggle Step B (Conversation)
  const handleToggleStepB = () => {
    updateData({ hasStepB: !data.hasStepB });
  };

  // Conversation handlers
  const handleConversationChange = (idx: number, field: keyof ExerciseConversation, value: string) => {
    const newConvs = [...(data.conversations || [])];
    newConvs[idx] = { ...newConvs[idx], [field]: value };
    updateData({ conversations: newConvs });
  };

  const handleAddConversation = () => {
    const lastConv = data.conversations?.[data.conversations.length - 1];
    const newPosition = lastConv?.position === 'left' ? 'right' : 'left';
    updateData({
      conversations: [...(data.conversations || []), { speakerImage: '', speechBubble: '', position: newPosition }]
    });
  };

  const handleRemoveConversation = (idx: number) => {
    updateData({
      conversations: (data.conversations || []).filter((_, i) => i !== idx)
    });
  };

  const handleConvImageUpload = (idx: number) => (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      handleConversationChange(idx, 'speakerImage', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExampleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateData({ exampleImage: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleMcImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateData({ multipleChoiceImage: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSpeechImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateData({ speechSpeakerImage: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (index: number) => (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const newItems = [...data.exerciseItems];
      newItems[index] = { ...newItems[index], image: reader.result as string };
      updateData({ exerciseItems: newItems });
    };
    reader.readAsDataURL(file);
  };

  const handleAddItem = () => {
    const newItems = [...data.exerciseItems, { image: '', sentence: '' }];
    updateData({ exerciseItems: newItems });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = data.exerciseItems.filter((_, i) => i !== index);
    updateData({ exerciseItems: newItems });
  };

  const handleAddExpression = () => {
    updateData({ expressions: [...data.expressions, ''] });
  };

  const handleRemoveExpression = (index: number) => {
    updateData({ expressions: data.expressions.filter((_, i) => i !== index) });
  };

  // Info Box handlers
  const handleInfoBoxTitleChange = (title: string) => {
    updateData({
      infoBox: { ...(data.infoBox || { title: '', rowLabels: [], columns: [] }), title }
    });
  };

  const handleInfoBoxRowLabelChange = (index: number, value: string) => {
    const newRowLabels = [...(data.infoBox?.rowLabels || [])];
    newRowLabels[index] = value;
    updateData({
      infoBox: { ...(data.infoBox || { title: '', rowLabels: [], columns: [] }), rowLabels: newRowLabels }
    });
  };

  const handleAddInfoBoxRow = () => {
    const newRowLabels = [...(data.infoBox?.rowLabels || []), ''];
    const newColumns = (data.infoBox?.columns || []).map(col => ({
      ...col,
      rows: [...col.rows, '']
    }));
    updateData({
      infoBox: { ...(data.infoBox || { title: '', rowLabels: [], columns: [] }), rowLabels: newRowLabels, columns: newColumns }
    });
  };

  const handleRemoveInfoBoxRow = (index: number) => {
    const newRowLabels = (data.infoBox?.rowLabels || []).filter((_, i) => i !== index);
    const newColumns = (data.infoBox?.columns || []).map(col => ({
      ...col,
      rows: col.rows.filter((_, i) => i !== index)
    }));
    updateData({
      infoBox: { ...(data.infoBox || { title: '', rowLabels: [], columns: [] }), rowLabels: newRowLabels, columns: newColumns }
    });
  };

  const handleInfoBoxColumnHeaderChange = (colIndex: number, header: string) => {
    const newColumns = [...(data.infoBox?.columns || [])];
    newColumns[colIndex] = { ...newColumns[colIndex], header };
    updateData({
      infoBox: { ...(data.infoBox || { title: '', rowLabels: [], columns: [] }), columns: newColumns }
    });
  };

  const handleInfoBoxCellChange = (colIndex: number, rowIndex: number, value: string) => {
    const newColumns = [...(data.infoBox?.columns || [])];
    const newRows = [...(newColumns[colIndex]?.rows || [])];
    newRows[rowIndex] = value;
    newColumns[colIndex] = { ...newColumns[colIndex], rows: newRows };
    updateData({
      infoBox: { ...(data.infoBox || { title: '', rowLabels: [], columns: [] }), columns: newColumns }
    });
  };

  const handleAddInfoBoxColumn = () => {
    const rowCount = data.infoBox?.rowLabels?.length || 3;
    const newColumn: InfoBoxColumn = { header: '', rows: Array(rowCount).fill('') };
    const newColumns = [...(data.infoBox?.columns || []), newColumn];
    updateData({
      infoBox: { ...(data.infoBox || { title: '', rowLabels: [], columns: [] }), columns: newColumns }
    });
  };

  const handleRemoveInfoBoxColumn = (index: number) => {
    const newColumns = (data.infoBox?.columns || []).filter((_, i) => i !== index);
    updateData({
      infoBox: { ...(data.infoBox || { title: '', rowLabels: [], columns: [] }), columns: newColumns }
    });
  };

  const handleAddTutorStep = () => {
    updateData({ tutorSteps: [...data.tutorSteps, { instruction: '' }] });
  };

  const handleRemoveTutorStep = (index: number) => {
    updateData({ tutorSteps: data.tutorSteps.filter((_, i) => i !== index) });
  };

  // Type switching handler
  const handleSwitchStepAType = (newType: ExerciseStepAType) => {
    if (newType === data.stepAType) return;
    
    if (newType === 'rephrase') {
      updateData({
        stepAType: 'rephrase',
        instructions: "Rephrase the sentences using the expressions in the box. Some expressions may be used more than once, and the form of some expressions may need to be changed.",
      });
    } else if (newType === 'choose') {
      updateData({
        stepAType: 'choose',
        instructions: "Choose the correct words in the parentheses.",
      });
    } else if (newType === 'change') {
      updateData({
        stepAType: 'change',
        instructions: "Change the underlined questions into indirect questions using the expressions in the box. More than one answer is possible.",
      });
    }
  };

  // Choose item handlers
  const chooseImageRef = useRef<HTMLInputElement | null>(null);

  const handleAddChooseItem = () => {
    const newItems = [...(data.chooseItems || []), { sentence: '' }];
    updateData({ chooseItems: newItems });
  };

  const handleRemoveChooseItem = (index: number) => {
    const newItems = (data.chooseItems || []).filter((_, i) => i !== index);
    updateData({ chooseItems: newItems });
  };

  // Change item handlers
  const handleAddChangeItem = () => {
    const newItems = [...(data.changeItems || []), { sentence: '' }];
    updateData({ changeItems: newItems });
  };

  const handleRemoveChangeItem = (index: number) => {
    const newItems = (data.changeItems || []).filter((_, i) => i !== index);
    updateData({ changeItems: newItems });
  };

  const handleChangeItemUpdate = (index: number, value: string) => {
    const newItems = [...(data.changeItems || [])];
    newItems[index] = { sentence: value };
    updateData({ changeItems: newItems });
  };

  const handleChooseImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateData({ chooseImage: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="csve-section csve-exercise-section">
      {/* Section Header - matches other sections */}
      <div className="csve-section-number">
        <span className="csve-number-badge">{data.sectionNumber}</span>
        <input
          type="text"
          className="csve-section-title-editable"
          value={data.sectionTitle}
          onChange={e => updateData({ sectionTitle: (e.target as HTMLInputElement).value })}
        />
        <div className="csve-section-line" />
      </div>

      {/* Step A Type Switcher */}
      <div className="csve-step-type-switcher">
        <span className="csve-switcher-label">Step A Type:</span>
        <div className="csve-switcher-buttons">
          <button
            className={`csve-switcher-btn ${data.stepAType === 'rephrase' ? 'active' : ''}`}
            onClick={() => handleSwitchStepAType('rephrase')}
          >
            <i className="ri-refresh-line" />
            Rephrase
          </button>
          <button
            className={`csve-switcher-btn ${data.stepAType === 'choose' ? 'active' : ''}`}
            onClick={() => handleSwitchStepAType('choose')}
          >
            <i className="ri-checkbox-multiple-line" />
            Choose
          </button>
          <button
            className={`csve-switcher-btn ${data.stepAType === 'change' ? 'active' : ''}`}
            onClick={() => handleSwitchStepAType('change')}
          >
            <i className="ri-edit-line" />
            Change
          </button>
        </div>
      </div>

      {/* STEP A ROW */}
      <div className="csve-exercise-row">
        {/* Left Column - Step A Content */}
        <div className="csve-exercise-left">
          {/* STEP A HEADER - Only show if Step B is enabled */}
          {data.hasStepB && (
            <input
              type="text"
              className="csve-stepb-name"
              value={data.stepAName || 'STEP A'}
              onChange={e => updateData({ stepAName: (e.target as HTMLInputElement).value })}
              placeholder="STEP A"
            />
          )}

          {/* Instructions */}
          <div className="csve-exercise-instructions">
            <RichTextInput
              className="csve-instructions-input csve-rich-text"
              value={data.instructions}
              onChange={html => updateData({ instructions: html })}
              placeholder="Enter instructions..."
              singleLine={false}
            />
            {data.instructionsTranslation !== undefined ? (
              <div className="csve-translation-row">
                <RichTextInput
                  className="csve-translation-input csve-rich-text"
                  value={data.instructionsTranslation}
                  onChange={html => updateData({ instructionsTranslation: html })}
                  placeholder="Translation..."
                  singleLine={true}
                />
                <button
                  className="csve-remove-translation-btn"
                  onClick={() => updateData({ instructionsTranslation: undefined })}
                  title="Remove translation"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
            ) : (
              <button
                className="csve-add-translation-btn"
                onClick={() => updateData({ instructionsTranslation: '' })}
              >
                <i className="ri-translate-2" /> Add Translation
              </button>
            )}
          </div>

          {/* REPHRASE TYPE CONTENT */}
          {data.stepAType === 'rephrase' && (
            <>
          {/* Expression Box - Optional */}
          {data.showExpressions ? (
            <div className="csve-expression-box csve-optional-section">
              <button 
                className="csve-remove-optional-btn"
                onClick={() => updateData({ showExpressions: false })}
                title="Remove expressions box"
              >
                <i className="ri-close-line" />
              </button>
                  <div className="csve-expression-items">
                {data.expressions.map((expr, idx) => (
                  <div key={idx} className="csve-expression-item">
                    <input
                      type="text"
                      className="csve-expression-input"
                      value={expr}
                      onChange={e => {
                        const newExprs = [...data.expressions];
                        newExprs[idx] = (e.target as HTMLInputElement).value;
                        updateData({ expressions: newExprs });
                      }}
                      placeholder="expression"
                    />
                    {data.expressions.length > 1 && (
                      <button
                        className="csve-remove-expression-btn"
                        onClick={() => handleRemoveExpression(idx)}
                      >
                        <i className="ri-close-line" />
                      </button>
                    )}
                  </div>
                ))}
                <button className="csve-add-expression-btn" onClick={handleAddExpression}>
                  <i className="ri-add-line" />
                </button>
              </div>
            </div>
          ) : (
            <button 
              className="csve-add-card-btn csve-add-optional-btn"
              onClick={() => updateData({ showExpressions: true })}
            >
              <i className="ri-add-circle-line" />
              Add Expressions Box
              <span className="csve-add-card-hint">Optional word choices for exercise</span>
            </button>
          )}

          {/* Info Box (Comparison Table) - Optional */}
          {data.showInfoBox ? (
            <div className="csve-info-box csve-optional-section">
              <button 
                className="csve-remove-optional-btn"
                onClick={() => updateData({ showInfoBox: false })}
                title="Remove info box"
              >
                <i className="ri-close-line" />
              </button>
              
              {/* Info Box Title */}
              <input
                type="text"
                className="csve-info-box-title"
                value={data.infoBox?.title || ''}
                onChange={e => handleInfoBoxTitleChange((e.target as HTMLInputElement).value)}
                placeholder="Table Title (e.g., Top Vacation Spots)"
              />
              
              {/* Info Box Table */}
              <div className="csve-info-box-table">
                {/* Header Row */}
                <div className="csve-info-box-row csve-info-box-header-row">
                  <div className="csve-info-box-row-label"></div>
                  {(data.infoBox?.columns || []).map((col, colIdx) => (
                    <div key={colIdx} className="csve-info-box-cell csve-info-box-header-cell">
                      <input
                        type="text"
                        value={col.header}
                        onChange={e => handleInfoBoxColumnHeaderChange(colIdx, (e.target as HTMLInputElement).value)}
                        placeholder={`Column ${colIdx + 1}`}
                      />
                      {(data.infoBox?.columns?.length || 0) > 1 && (
                        <button
                          className="csve-info-box-remove-col-btn"
                          onClick={() => handleRemoveInfoBoxColumn(colIdx)}
                          title="Remove column"
                        >
                          <i className="ri-close-line" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    className="csve-info-box-add-col-btn"
                    onClick={handleAddInfoBoxColumn}
                    title="Add column"
                  >
                    <i className="ri-add-line" />
                  </button>
                </div>
                
                {/* Data Rows */}
                {(data.infoBox?.rowLabels || []).map((rowLabel, rowIdx) => (
                  <div key={rowIdx} className="csve-info-box-row">
                    <div className="csve-info-box-row-label">
                      <input
                        type="text"
                        value={rowLabel}
                        onChange={e => handleInfoBoxRowLabelChange(rowIdx, (e.target as HTMLInputElement).value)}
                        placeholder="Label"
                      />
                    </div>
                    {(data.infoBox?.columns || []).map((col, colIdx) => (
                      <div key={colIdx} className="csve-info-box-cell">
                        <input
                          type="text"
                          value={col.rows?.[rowIdx] || ''}
                          onChange={e => handleInfoBoxCellChange(colIdx, rowIdx, (e.target as HTMLInputElement).value)}
                          placeholder="Value"
                        />
                      </div>
                    ))}
                    <button
                      className="csve-info-box-remove-row-btn"
                      onClick={() => handleRemoveInfoBoxRow(rowIdx)}
                      title="Remove row"
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                ))}
                
                {/* Add Row Button */}
                <button
                  className="csve-info-box-add-row-btn"
                  onClick={handleAddInfoBoxRow}
                >
                  <i className="ri-add-line" /> Add Row
                </button>
              </div>
            </div>
          ) : (
            <button 
              className="csve-add-card-btn csve-add-optional-btn"
              onClick={() => updateData({ showInfoBox: true })}
            >
              <i className="ri-table-line" />
              Add Info Box
              <span className="csve-add-card-hint">Optional comparison table</span>
            </button>
          )}

          {/* Example - Optional */}
          {data.showExample ? (
            <div className="csve-exercise-example csve-optional-section">
              <button 
                className="csve-remove-optional-btn"
                onClick={() => updateData({ showExample: false })}
                title="Remove example"
              >
                <i className="ri-close-line" />
              </button>
              {/* Optional Example Image */}
              <div 
                className="csve-exercise-item-image"
                onClick={() => exampleImageRef.current?.click()}
              >
                {data.exampleImage ? (
                  <img src={data.exampleImage} alt="Example" />
                ) : (
                  <div className="csve-exercise-image-placeholder">
                    <span className="csve-placeholder-dims">120 × 80</span>
                    <span className="csve-placeholder-hint">Click to add</span>
                  </div>
                )}
                <input
                  ref={exampleImageRef}
                  type="file"
                  accept="image/*"
                  onChange={handleExampleImageUpload}
                  style={{ display: 'none' }}
                />
              </div>
              <div className="csve-example-content">
                <div className="csve-example-sentence">
                  <RichTextInput
                    className="csve-example-input"
                    value={data.exampleSentence}
                    onChange={html => updateData({ exampleSentence: html })}
                    placeholder="ex. Example sentence..."
                    singleLine={true}
                  />
                </div>
                <div className="csve-example-answer">
                  <span className="csve-arrow">→</span>
                  <RichTextInput
                    className="csve-answer-example-input"
                    value={data.exampleAnswer}
                    onChange={html => updateData({ exampleAnswer: html })}
                    placeholder="Example answer (underlined)..."
                    singleLine={true}
                  />
                </div>
              </div>
            </div>
          ) : (
            <button 
              className="csve-add-card-btn csve-add-optional-btn"
              onClick={() => updateData({ showExample: true })}
            >
              <i className="ri-add-circle-line" />
              Add Example
              <span className="csve-add-card-hint">Optional example with answer</span>
            </button>
          )}

          {/* Exercise Items */}
          <div className="csve-exercise-items">
            {data.exerciseItems.map((item, idx) => (
              <div key={idx} className="csve-exercise-item">
                {/* Image */}
                <div 
                  className="csve-exercise-item-image"
                  onClick={() => imageInputRefs.current[idx]?.click()}
                >
                  {item.image ? (
                    <img src={item.image} alt={`Exercise ${idx + 1}`} />
                  ) : (
                    <div className="csve-exercise-image-placeholder">
                      <span className="csve-placeholder-dims">120 × 80</span>
                      <span className="csve-placeholder-hint">Click to add</span>
                    </div>
                  )}
                  <input
                    ref={el => { imageInputRefs.current[idx] = el; }}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload(idx)}
                    style={{ display: 'none' }}
                  />
                </div>
                {/* Sentence */}
                <div className="csve-exercise-item-content">
                  <span className="csve-item-number">{idx + 1}.</span>
                  <RichTextInput
                    className="csve-item-sentence-input csve-rich-text"
                    value={item.sentence}
                    onChange={html => {
                      const newItems = [...data.exerciseItems];
                      newItems[idx] = { ...newItems[idx], sentence: html };
                      updateData({ exerciseItems: newItems });
                    }}
                    placeholder="Enter sentence..."
                    singleLine={false}
                  />
                  {data.exerciseItems.length > 1 && (
                    <button
                      className="csve-remove-item-btn"
                      onClick={() => handleRemoveItem(idx)}
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button className="csve-add-exercise-item-btn" onClick={handleAddItem}>
              <i className="ri-add-line" /> Add Exercise Item
            </button>
          </div>
            </>
          )}

          {/* CHOOSE TYPE CONTENT */}
          {data.stepAType === 'choose' && (
            <>
              {/* Choose Items List */}
              <div className="csve-choose-items">
                {(data.chooseItems || []).map((item, idx) => (
                  <div key={idx} className="csve-choose-item">
                    <span className="csve-item-number">{idx + 1}.</span>
                    <RichTextInput
                      className="csve-choose-sentence-input csve-rich-text"
                      value={item.sentence}
                      onChange={html => {
                        const newItems = [...(data.chooseItems || [])];
                        newItems[idx] = { sentence: html };
                        updateData({ chooseItems: newItems });
                      }}
                      placeholder="He (doesn't / don't) eat breakfast."
                      singleLine={true}
                    />
                    {(data.chooseItems || []).length > 1 && (
                      <button
                        className="csve-remove-item-btn"
                        onClick={() => handleRemoveChooseItem(idx)}
                      >
                        <i className="ri-delete-bin-line" />
                      </button>
                    )}
                  </div>
                ))}
                <button className="csve-add-exercise-item-btn" onClick={handleAddChooseItem}>
                  <i className="ri-add-line" /> Add Item
                </button>
              </div>

              {/* Info Box (Comparison Table) - Optional for Choose type */}
              {data.showInfoBox ? (
                <div className="csve-info-box csve-optional-section">
                  <button 
                    className="csve-remove-optional-btn"
                    onClick={() => updateData({ showInfoBox: false })}
                    title="Remove info box"
                  >
                    <i className="ri-close-line" />
                  </button>
                  
                  {/* Info Box Title */}
                  <input
                    type="text"
                    className="csve-info-box-title"
                    value={data.infoBox?.title || ''}
                    onChange={e => handleInfoBoxTitleChange((e.target as HTMLInputElement).value)}
                    placeholder="Table Title (e.g., Top Vacation Spots)"
                  />
                  
                  {/* Info Box Table */}
                  <div className="csve-info-box-table">
                    {/* Header Row */}
                    <div className="csve-info-box-row csve-info-box-header-row">
                      <div className="csve-info-box-row-label"></div>
                      {(data.infoBox?.columns || []).map((col, colIdx) => (
                        <div key={colIdx} className="csve-info-box-cell csve-info-box-header-cell">
                          <input
                            type="text"
                            value={col.header}
                            onChange={e => handleInfoBoxColumnHeaderChange(colIdx, (e.target as HTMLInputElement).value)}
                            placeholder={`Column ${colIdx + 1}`}
                          />
                          {(data.infoBox?.columns?.length || 0) > 1 && (
                            <button
                              className="csve-info-box-remove-col-btn"
                              onClick={() => handleRemoveInfoBoxColumn(colIdx)}
                              title="Remove column"
                            >
                              <i className="ri-close-line" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        className="csve-info-box-add-col-btn"
                        onClick={handleAddInfoBoxColumn}
                        title="Add column"
                      >
                        <i className="ri-add-line" />
                      </button>
                    </div>
                    
                    {/* Data Rows */}
                    {(data.infoBox?.rowLabels || []).map((rowLabel, rowIdx) => (
                      <div key={rowIdx} className="csve-info-box-row">
                        <div className="csve-info-box-row-label">
                          <input
                            type="text"
                            value={rowLabel}
                            onChange={e => handleInfoBoxRowLabelChange(rowIdx, (e.target as HTMLInputElement).value)}
                            placeholder="Label"
                          />
                        </div>
                        {(data.infoBox?.columns || []).map((col, colIdx) => (
                          <div key={colIdx} className="csve-info-box-cell">
                            <input
                              type="text"
                              value={col.rows?.[rowIdx] || ''}
                              onChange={e => handleInfoBoxCellChange(colIdx, rowIdx, (e.target as HTMLInputElement).value)}
                              placeholder="Value"
                            />
                          </div>
                        ))}
                        <button
                          className="csve-info-box-remove-row-btn"
                          onClick={() => handleRemoveInfoBoxRow(rowIdx)}
                          title="Remove row"
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Add Row Button */}
                    <button
                      className="csve-info-box-add-row-btn"
                      onClick={handleAddInfoBoxRow}
                    >
                      <i className="ri-add-line" /> Add Row
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  className="csve-add-card-btn csve-add-optional-btn"
                  onClick={() => updateData({ showInfoBox: true })}
                >
                  <i className="ri-table-line" />
                  Add Info Box
                  <span className="csve-add-card-hint">Optional comparison table</span>
                </button>
              )}

              {/* Optional Image at Bottom */}
              <div 
                className="csve-choose-image"
                onClick={() => chooseImageRef.current?.click()}
              >
                {data.chooseImage ? (
                  <div className="csve-choose-image-preview">
                    <img src={data.chooseImage} alt="Exercise" />
                    <button 
                      className="csve-remove-image-btn"
                      onClick={(e) => { e.stopPropagation(); updateData({ chooseImage: '' }); }}
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  </div>
                ) : (
                  <div className="csve-choose-image-placeholder">
                    <span className="csve-placeholder-dims">600 × 300</span>
                    <span className="csve-placeholder-hint">Click to add (Optional)</span>
                  </div>
                )}
                <input
                  ref={chooseImageRef}
                  type="file"
                  accept="image/*"
                  onChange={handleChooseImageUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </>
          )}

          {/* CHANGE TYPE CONTENT */}
          {data.stepAType === 'change' && (
            <>
              {/* Expression Box - Optional */}
              {data.showExpressions ? (
                <div className="csve-expression-box csve-optional-section">
                  <button 
                    className="csve-remove-optional-btn"
                    onClick={() => updateData({ showExpressions: false })}
                    title="Remove expressions box"
                  >
                    <i className="ri-close-line" />
                  </button>
                  <div className="csve-expression-items">
                    {data.expressions.map((expr, idx) => (
                      <div key={idx} className="csve-expression-item">
                        <input
                          type="text"
                          className="csve-expression-input"
                          value={expr}
                          onChange={e => {
                            const newExprs = [...data.expressions];
                            newExprs[idx] = (e.target as HTMLInputElement).value;
                            updateData({ expressions: newExprs });
                          }}
                          placeholder="expression"
                        />
                        {data.expressions.length > 1 && (
                          <button
                            className="csve-remove-expression-btn"
                            onClick={() => handleRemoveExpression(idx)}
                          >
                            <i className="ri-close-line" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button className="csve-add-expression-btn" onClick={handleAddExpression}>
                      <i className="ri-add-line" />
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  className="csve-add-card-btn csve-add-optional-btn"
                  onClick={() => updateData({ showExpressions: true })}
                >
                  <i className="ri-add-circle-line" />
                  Add Expressions Box
                  <span className="csve-add-card-hint">Optional phrase choices for exercise</span>
                </button>
              )}

              {/* Change Items List */}
              <div className="csve-change-items">
                {(data.changeItems || []).map((item, idx) => (
                  <div key={idx} className="csve-change-item">
                    <span className="csve-item-number">{idx + 1}.</span>
                    <RichTextInput
                      className="csve-change-sentence-input"
                      value={item.sentence}
                      onChange={html => handleChangeItemUpdate(idx, html)}
                      placeholder="Type sentence and use Ctrl+U to underline the part to change..."
                      singleLine={true}
                    />
                    {(data.changeItems || []).length > 1 && (
                      <button
                        className="csve-remove-item-btn"
                        onClick={() => handleRemoveChangeItem(idx)}
                      >
                        <i className="ri-delete-bin-line" />
                      </button>
                    )}
                  </div>
                ))}
                <button className="csve-add-exercise-item-btn" onClick={handleAddChangeItem}>
                  <i className="ri-add-line" /> Add Item
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Column - Step A Tutor Guide */}
        <div className="csve-exercise-right">
          <TutorGuide
            title={data.hasStepB ? data.stepAName || 'STEP A' : data.sectionTitle}
            duration={data.duration}
            steps={data.tutorSteps as UniversalTutorStep[]}
            onStepsChange={(steps) => updateData({ tutorSteps: steps as ExerciseTutorStep[] })}
            onDurationChange={(duration) => updateData({ duration })}
            features={{
              showScripts: true,
              showTips: true,
              showQuestions: false,
              showAnswerKey: true,
              showListeningScript: false,
            }}
            className="csve-editable-card"
          />
        </div>
      </div>

      {/* Add Step B Button - Only show if not already added */}
      {!data.hasStepB && (
        <button
          className="csve-add-stepb-btn"
          onClick={handleToggleStepB}
        >
          <i className="ri-chat-3-line" /> Add Step B (Conversation)
        </button>
      )}

      {/* STEP B ROW - Only shown if enabled */}
      {data.hasStepB && (
        <div className="csve-exercise-row csve-stepb-row">
          {/* Left Column - Step B Content */}
          <div className="csve-exercise-left">
            <div className="csve-stepb-conversation-section">
              {/* Step B Header */}
              <div className="csve-stepb-header-row">
                <input
                  type="text"
                  className="csve-stepb-name"
                  value={data.stepBName || 'STEP B'}
                  onChange={e => updateData({ stepBName: (e.target as HTMLInputElement).value })}
                  placeholder="STEP B"
                />
                <button
                  className="csve-remove-stepb-btn"
                  onClick={handleToggleStepB}
                  title="Remove Step B"
                >
                  <i className="ri-close-line" /> Remove Step B
                </button>
              </div>

              {/* Step B Type Switcher */}
              <div className="csve-step-type-switcher">
                <span className="csve-switcher-label">Step B Type:</span>
                <div className="csve-switcher-buttons">
                  <button
                    className={`csve-switcher-btn ${(data.stepBType || 'conversation') === 'conversation' ? 'active' : ''}`}
                    onClick={() => updateData({ stepBType: 'conversation' })}
                  >
                    <i className="ri-chat-3-line" /> Conversation
                  </button>
                  <button
                    className={`csve-switcher-btn ${data.stepBType === 'multiple-choice' ? 'active' : ''}`}
                    onClick={() => updateData({ stepBType: 'multiple-choice' })}
                  >
                    <i className="ri-list-check-2" /> Multiple Choice
                  </button>
                  <button
                    className={`csve-switcher-btn ${data.stepBType === 'speech' ? 'active' : ''}`}
                    onClick={() => updateData({ stepBType: 'speech' })}
                  >
                    <i className="ri-user-voice-line" /> Speech
                  </button>
                  <button
                    className={`csve-switcher-btn ${data.stepBType === 'compare' ? 'active' : ''}`}
                    onClick={() => updateData({ stepBType: 'compare' })}
                  >
                    <i className="ri-scales-3-line" /> Compare
                  </button>
                </div>
              </div>

              {/* Step B Instruction */}
              <div className="csve-exercise-instructions">
                <RichTextInput
                  className="csve-stepb-instruction-input"
                  value={data.stepBInstruction}
                  onChange={html => updateData({ stepBInstruction: html })}
                  placeholder="Complete the speech using your own information."
                  singleLine={true}
                />
                {data.stepBInstructionTranslation !== undefined ? (
                  <div className="csve-translation-row">
                    <RichTextInput
                      className="csve-translation-input"
                      value={data.stepBInstructionTranslation}
                      onChange={html => updateData({ stepBInstructionTranslation: html })}
                      placeholder="Translation..."
                      singleLine={true}
                    />
                    <button
                      className="csve-remove-translation-btn"
                      onClick={() => updateData({ stepBInstructionTranslation: undefined })}
                      title="Remove translation"
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="csve-add-translation-btn"
                    onClick={() => updateData({ stepBInstructionTranslation: '' })}
                  >
                    <i className="ri-translate-2" /> Add Translation
                  </button>
                )}
              </div>

              {/* Conversations - Only for conversation type */}
              {(data.stepBType || 'conversation') === 'conversation' && (
              <div className="csve-exercise-conversations">
                {(data.conversations || []).map((conv, convIdx) => (
                  <div 
                    key={convIdx} 
                    className={`csve-exercise-conv-row csve-exercise-conv-${conv.position}`}
                  >
                    {conv.position === 'left' && (
                      <div 
                        className="csve-exercise-speaker-image"
                        onClick={() => convImageInputRefs.current[convIdx]?.click()}
                      >
                        {conv.speakerImage ? (
                          <img src={conv.speakerImage} alt={`Speaker ${convIdx + 1}`} />
                      ) : (
                        <div className="csve-image-placeholder csve-speaker-placeholder">
                          <span className="csve-placeholder-dims">150 × 150</span>
                          <span className="csve-placeholder-text">Click to add</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="csve-exercise-speech-bubble">
                    <RichTextInput
                      value={conv.speechBubble}
                      onChange={html => handleConversationChange(convIdx, 'speechBubble', html)}
                      placeholder="Enter speech (use _____ for blanks)..."
                      className="csve-speech-input"
                      singleLine={false}
                    />
                    {(data.conversations || []).length > 1 && (
                      <button 
                        className="csve-exercise-conv-remove"
                        onClick={() => handleRemoveConversation(convIdx)}
                        title="Remove conversation"
                      >
                        <i className="ri-close-line" />
                      </button>
                    )}
                  </div>
                  
                  {conv.position === 'right' && (
                    <div 
                      className="csve-exercise-speaker-image"
                      onClick={() => convImageInputRefs.current[convIdx]?.click()}
                    >
                      {conv.speakerImage ? (
                        <img src={conv.speakerImage} alt={`Speaker ${convIdx + 1}`} />
                      ) : (
                        <div className="csve-image-placeholder csve-speaker-placeholder">
                          <span className="csve-placeholder-dims">150 × 150</span>
                          <span className="csve-placeholder-text">Click to add</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Hidden file input */}
                  <input 
                    ref={el => { convImageInputRefs.current[convIdx] = el; }}
                    type="file" 
                    accept="image/*" 
                    onChange={handleConvImageUpload(convIdx)} 
                    style={{ display: 'none' }} 
                  />
                </div>
              ))}
              
              <button className="csve-add-exercise-conv-btn" onClick={handleAddConversation}>
                <i className="ri-add-line" /> Add Conversation
              </button>
            </div>
              )}

              {/* Multiple Choice - Only for multiple-choice type */}
              {data.stepBType === 'multiple-choice' && (
                <div className="csve-stepb-multiple-choice">
                  {(data.multipleChoiceItems || []).map((item, mcIdx) => (
                    <div key={mcIdx} className="csve-mc-item">
                      <div className="csve-mc-item-header">
                        <span className="csve-mc-number">{mcIdx + 1}.</span>
                        <RichTextInput
                          className="csve-mc-bold-sentence"
                          value={item.boldSentence}
                          onChange={html => {
                            const newItems = [...(data.multipleChoiceItems || [])];
                            newItems[mcIdx] = { ...newItems[mcIdx], boldSentence: html };
                            updateData({ multipleChoiceItems: newItems });
                          }}
                          placeholder="Bold sentence with blank _____"
                          singleLine={true}
                        />
                        {(data.multipleChoiceItems || []).length > 1 && (
                          <button 
                            className="csve-mc-remove-btn"
                            onClick={() => {
                              const newItems = (data.multipleChoiceItems || []).filter((_, i) => i !== mcIdx);
                              updateData({ multipleChoiceItems: newItems });
                            }}
                            title="Remove item"
                          >
                            <i className="ri-close-line" />
                          </button>
                        )}
                      </div>
                      <div className="csve-mc-options">
                        <div className="csve-mc-option">
                          <span className="csve-mc-option-label">a.</span>
                          <RichTextInput
                            className="csve-mc-option-input"
                            value={item.optionA}
                            onChange={html => {
                              const newItems = [...(data.multipleChoiceItems || [])];
                              newItems[mcIdx] = { ...newItems[mcIdx], optionA: html };
                              updateData({ multipleChoiceItems: newItems });
                            }}
                            placeholder="Option A"
                            singleLine={true}
                          />
                        </div>
                        <div className="csve-mc-option">
                          <span className="csve-mc-option-label">b.</span>
                          <RichTextInput
                            className="csve-mc-option-input"
                            value={item.optionB}
                            onChange={html => {
                              const newItems = [...(data.multipleChoiceItems || [])];
                              newItems[mcIdx] = { ...newItems[mcIdx], optionB: html };
                              updateData({ multipleChoiceItems: newItems });
                            }}
                            placeholder="Option B"
                            singleLine={true}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button 
                    className="csve-add-mc-item-btn"
                    onClick={() => {
                      const newItems = [...(data.multipleChoiceItems || []), { boldSentence: '', optionA: '', optionB: '' }];
                      updateData({ multipleChoiceItems: newItems });
                    }}
                  >
                    <i className="ri-add-line" /> Add Multiple Choice Item
                  </button>

                  {/* Optional Image for Multiple Choice */}
                  <div className="csve-mc-image-section">
                    <div 
                      className="csve-mc-image-upload"
                      onClick={() => mcImageInputRef.current?.click()}
                    >
                      {data.multipleChoiceImage ? (
                        <div className="csve-mc-image-preview">
                          <img src={data.multipleChoiceImage} alt="Multiple choice" />
                          <button 
                            className="csve-remove-mc-image-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateData({ multipleChoiceImage: '' });
                            }}
                          >
                            <i className="ri-close-line" />
                          </button>
                        </div>
                      ) : (
                        <div className="csve-image-placeholder csve-mc-image-placeholder">
                          <span className="csve-placeholder-dims">400 × 200</span>
                          <span className="csve-placeholder-text">Click to add image (optional)</span>
                        </div>
                      )}
                    </div>
                    <input 
                      ref={mcImageInputRef}
                      type="file" 
                      accept="image/*" 
                      onChange={handleMcImageUpload}
                      style={{ display: 'none' }} 
                    />
                  </div>
                </div>
              )}

              {/* Speech Type - Single speaker with speech bubble */}
              {data.stepBType === 'speech' && (
                <div className="csve-stepb-speech">
                  <div className="csve-speech-layout">
                    {/* Speaker Image */}
                    <div 
                      className="csve-speech-speaker-image"
                      onClick={() => speechImageRef.current?.click()}
                    >
                      {data.speechSpeakerImage ? (
                        <div className="csve-speech-image-preview">
                          <img src={data.speechSpeakerImage} alt="Speaker" />
                          <button 
                            className="csve-remove-speech-image-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateData({ speechSpeakerImage: '' });
                            }}
                          >
                            <i className="ri-close-line" />
                          </button>
                        </div>
                      ) : (
                        <div className="csve-image-placeholder csve-speech-image-placeholder">
                          <span className="csve-placeholder-dims">150 × 200</span>
                          <span className="csve-placeholder-text">Click to add speaker</span>
                        </div>
                      )}
                    </div>
                    <input 
                      ref={speechImageRef}
                      type="file" 
                      accept="image/*" 
                      onChange={handleSpeechImageUpload}
                      style={{ display: 'none' }} 
                    />

                    {/* Speech Bubble */}
                    <div className="csve-speech-bubble-container">
                      <RichTextInput
                        value={data.speechContent || ''}
                        onChange={html => updateData({ speechContent: html })}
                        placeholder="Enter speech content with blanks _____ and choices (option1 / option2)..."
                        className="csve-speech-content-input"
                        singleLine={false}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Compare Type - Compare images with word box */}
              {data.stepBType === 'compare' && (
                <div className="csve-stepb-compare">
                  {/* Word Box */}
                  <div className="csve-compare-wordbox">
                    <div className="csve-compare-wordbox-items">
                      {(data.compareWordBox || []).map((word, idx) => (
                        <div key={idx} className="csve-compare-word-item">
                          <input
                            type="text"
                            className="csve-compare-word-input"
                            value={word}
                            onChange={e => {
                              const newWords = [...(data.compareWordBox || [])];
                              newWords[idx] = (e.target as HTMLInputElement).value;
                              updateData({ compareWordBox: newWords });
                            }}
                            placeholder="word..."
                          />
                          {(data.compareWordBox || []).length > 1 && (
                            <button
                              className="csve-compare-word-remove"
                              onClick={() => {
                                const newWords = (data.compareWordBox || []).filter((_, i) => i !== idx);
                                updateData({ compareWordBox: newWords });
                              }}
                            >
                              <i className="ri-close-line" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        className="csve-compare-word-add"
                        onClick={() => {
                          const newWords = [...(data.compareWordBox || []), ''];
                          updateData({ compareWordBox: newWords });
                        }}
                      >
                        <i className="ri-add-line" />
                      </button>
                    </div>
                  </div>

                  {/* Compare Images */}
                  <div className="csve-compare-images">
                    {(data.compareImages || []).map((item, idx) => (
                      <div key={idx} className="csve-compare-image-item">
                        <div 
                          className="csve-compare-image-box"
                          onClick={() => compareImageRefs.current[idx]?.click()}
                        >
                          {item.image ? (
                            <div className="csve-compare-image-preview">
                              <img src={item.image} alt={item.label} />
                              <button 
                                className="csve-remove-compare-image-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newImages = [...(data.compareImages || [])];
                                  newImages[idx] = { ...newImages[idx], image: '' };
                                  updateData({ compareImages: newImages });
                                }}
                              >
                                <i className="ri-close-line" />
                              </button>
                            </div>
                          ) : (
                            <div className="csve-image-placeholder">
                              <span className="csve-placeholder-dims">200 × 150</span>
                              <span className="csve-placeholder-text">Click to add</span>
                            </div>
                          )}
                        </div>
                        <input
                          ref={el => { compareImageRefs.current[idx] = el; }}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              const newImages = [...(data.compareImages || [])];
                              newImages[idx] = { ...newImages[idx], image: reader.result as string };
                              updateData({ compareImages: newImages });
                            };
                            reader.readAsDataURL(file);
                          }}
                          style={{ display: 'none' }}
                        />
                        <input
                          type="text"
                          className="csve-compare-image-label"
                          value={item.label}
                          onChange={e => {
                            const newImages = [...(data.compareImages || [])];
                            newImages[idx] = { ...newImages[idx], label: (e.target as HTMLInputElement).value };
                            updateData({ compareImages: newImages });
                          }}
                          placeholder="Label..."
                        />
                        {(data.compareImages || []).length > 2 && (
                          <button
                            className="csve-compare-image-remove"
                            onClick={() => {
                              const newImages = (data.compareImages || []).filter((_, i) => i !== idx);
                              updateData({ compareImages: newImages });
                            }}
                          >
                            <i className="ri-delete-bin-line" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      className="csve-compare-image-add"
                      onClick={() => {
                        const newImages = [...(data.compareImages || []), { image: '', label: `Option ${(data.compareImages || []).length + 1}` }];
                        updateData({ compareImages: newImages });
                      }}
                    >
                      <i className="ri-add-line" /> Add Image
                    </button>
                  </div>

                  {/* Example Sentence (Optional) */}
                  {data.compareExample !== undefined ? (
                    <div className="csve-compare-example">
                      <span className="csve-compare-example-label">ex.</span>
                      <RichTextInput
                        className="csve-compare-example-input"
                        value={data.compareExample || ''}
                        onChange={html => updateData({ compareExample: html })}
                        placeholder="(Restaurant A and B: classy) Restaurant B is far/a lot classier than Restaurant A."
                        singleLine={true}
                      />
                      <button
                        className="csve-compare-example-remove"
                        onClick={() => updateData({ compareExample: undefined })}
                        title="Remove example"
                      >
                        <i className="ri-close-line" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="csve-add-compare-example-btn"
                      onClick={() => updateData({ compareExample: '' })}
                    >
                      <i className="ri-add-circle-line" /> Add Example
                    </button>
                  )}

                  {/* Compare Items */}
                  <div className="csve-compare-items">
                    {(data.compareItems || []).map((item, idx) => (
                      <div key={idx} className="csve-compare-item">
                        <span className="csve-compare-item-number">{idx + 1}.</span>
                        <RichTextInput
                          className="csve-compare-item-input"
                          value={item.sentence}
                          onChange={html => {
                            const newItems = [...(data.compareItems || [])];
                            newItems[idx] = { sentence: html };
                            updateData({ compareItems: newItems });
                          }}
                          placeholder="(Restaurant B and C: romantic)"
                          singleLine={true}
                        />
                        {(data.compareItems || []).length > 1 && (
                          <button
                            className="csve-compare-item-remove"
                            onClick={() => {
                              const newItems = (data.compareItems || []).filter((_, i) => i !== idx);
                              updateData({ compareItems: newItems });
                            }}
                          >
                            <i className="ri-delete-bin-line" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      className="csve-compare-item-add"
                      onClick={() => {
                        const newItems = [...(data.compareItems || []), { sentence: '' }];
                        updateData({ compareItems: newItems });
                      }}
                    >
                      <i className="ri-add-line" /> Add Item
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Right Column - Step B Tutor Guide */}
        <div className="csve-exercise-right">
          <TutorGuide
            title={data.stepBName || 'STEP B'}
            steps={(data.stepBTutorSteps || []) as UniversalTutorStep[]}
            onStepsChange={(steps) => updateData({ stepBTutorSteps: steps as ExerciseTutorStep[] })}
            features={{
              showScripts: true,
              showTips: true,
              showQuestions: false,
              showAnswerKey: true,
              showListeningScript: false,
            }}
            className="csve-editable-card csve-stepb-tutor-guide"
          />
        </div>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// SECTION 5: MISSION SECTION EDITOR
// ============================================================================

interface MissionSectionEditorProps {
  data: MissionSectionData;
  onChange: (data: MissionSectionData) => void;
  hideHeader?: boolean;
}

function MissionSectionEditor({ data, onChange, hideHeader = false }: MissionSectionEditorProps) {
  const imageRef = useRef<HTMLInputElement | null>(null);

  const updateData = (updates: Partial<MissionSectionData>) => {
    onChange({ ...data, ...updates });
  };

  const renderInstructionEditor = () => (
    <div className="csve-mission-instruction-box">
      <RichTextInput
        className="csve-mission-instruction"
        value={data.instruction}
        onChange={html => updateData({ instruction: html })}
        placeholder="Describe what the learner should do..."
        singleLine={false}
      />
      {data.instructionTranslation !== undefined ? (
        <div className="csve-mission-instruction-translation">
          <RichTextInput
            className="csve-mission-translation-input"
            value={data.instructionTranslation || ''}
            onChange={html => updateData({ instructionTranslation: html })}
            placeholder="Japanese translation..."
            singleLine={false}
          />
          <button
            className="csve-remove-translation-btn"
            title="Remove translation"
            onClick={() => updateData({ instructionTranslation: undefined })}
          >
            <i className="ri-close-line" />
          </button>
        </div>
      ) : (
        <button className="csve-add-translation-btn" onClick={() => updateData({ instructionTranslation: '' })}>
          <i className="ri-translate-2" /> Add Translation
        </button>
      )}
    </div>
  );

  const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateData({ image: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleAddQuestion = () => {
    const newQuestions = [...data.questions, { question: '', hints: [] }];
    updateData({ questions: newQuestions });
  };

  const handleRemoveQuestion = (idx: number) => {
    const newQuestions = data.questions.filter((_, i) => i !== idx);
    updateData({ questions: newQuestions });
  };

  const handleQuestionUpdate = (idx: number, field: keyof MissionQuestion, value: string | string[]) => {
    const newQuestions = [...data.questions];
    newQuestions[idx] = { ...newQuestions[idx], [field]: value };
    updateData({ questions: newQuestions });
  };

  const handleAddHint = (qIdx: number) => {
    const newQuestions = [...data.questions];
    const hints = [...(newQuestions[qIdx].hints || []), ''];
    newQuestions[qIdx] = { ...newQuestions[qIdx], hints };
    updateData({ questions: newQuestions });
  };

  const handleRemoveHint = (qIdx: number, hIdx: number) => {
    const newQuestions = [...data.questions];
    const hints = (newQuestions[qIdx].hints || []).filter((_, i) => i !== hIdx);
    newQuestions[qIdx] = { ...newQuestions[qIdx], hints };
    updateData({ questions: newQuestions });
  };

  const handleHintUpdate = (qIdx: number, hIdx: number, value: string) => {
    const newQuestions = [...data.questions];
    const hints = [...(newQuestions[qIdx].hints || [])];
    hints[hIdx] = value;
    newQuestions[qIdx] = { ...newQuestions[qIdx], hints };
    updateData({ questions: newQuestions });
  };

  const handleAddGrammarTipItem = () => {
    const newItems = [...data.grammarTipItems, ''];
    updateData({ grammarTipItems: newItems });
  };

  const handleRemoveGrammarTipItem = (idx: number) => {
    const newItems = data.grammarTipItems.filter((_, i) => i !== idx);
    updateData({ grammarTipItems: newItems });
  };

  const handleGrammarTipItemUpdate = (idx: number, value: string) => {
    const newItems = [...data.grammarTipItems];
    newItems[idx] = value;
    updateData({ grammarTipItems: newItems });
  };

  // Tutor step handlers
  const handleAddTutorStep = () => {
    const newSteps = [...data.tutorSteps, { instruction: '' }];
    updateData({ tutorSteps: newSteps });
  };

  const handleRemoveTutorStep = (idx: number) => {
    const newSteps = data.tutorSteps.filter((_, i) => i !== idx);
    updateData({ tutorSteps: newSteps });
  };

  const handleTutorStepUpdate = (idx: number, field: keyof MissionTutorStep, value: string | { text: string }[]) => {
    const newSteps = [...data.tutorSteps];
    newSteps[idx] = { ...newSteps[idx], [field]: value };
    updateData({ tutorSteps: newSteps });
  };

  // Topic handlers (for discussion type)
  const handleAddTopic = () => {
    const newTopics = [...(data.topics || []), { title: '', questions: [''] }];
    updateData({ topics: newTopics });
  };

  const handleRemoveTopic = (idx: number) => {
    const newTopics = (data.topics || []).filter((_, i) => i !== idx);
    updateData({ topics: newTopics });
  };

  const handleTopicTitleUpdate = (idx: number, title: string) => {
    const newTopics = [...(data.topics || [])];
    newTopics[idx] = { ...newTopics[idx], title };
    updateData({ topics: newTopics });
  };

  const handleAddTopicQuestion = (topicIdx: number) => {
    const newTopics = [...(data.topics || [])];
    newTopics[topicIdx] = { ...newTopics[topicIdx], questions: [...newTopics[topicIdx].questions, ''] };
    updateData({ topics: newTopics });
  };

  const handleRemoveTopicQuestion = (topicIdx: number, qIdx: number) => {
    const newTopics = [...(data.topics || [])];
    newTopics[topicIdx] = {
      ...newTopics[topicIdx],
      questions: newTopics[topicIdx].questions.filter((_, i) => i !== qIdx)
    };
    updateData({ topics: newTopics });
  };

  const handleTopicQuestionUpdate = (topicIdx: number, qIdx: number, value: string) => {
    const newTopics = [...(data.topics || [])];
    const questions = [...newTopics[topicIdx].questions];
    questions[qIdx] = value;
    newTopics[topicIdx] = { ...newTopics[topicIdx], questions };
    updateData({ topics: newTopics });
  };

  return (
    <section className="csve-section csve-mission-section">
      {/* Section Header - matches other sections */}
      {!hideHeader && (
        <div className="csve-section-number">
          <span className="csve-number-badge">{data.sectionNumber}</span>
          <input
            type="text"
            className="csve-section-title-editable"
            value={data.sectionTitle}
            onChange={e => updateData({ sectionTitle: (e.target as HTMLInputElement).value })}
          />
          <div className="csve-section-line" />
        </div>
      )}

      {/* Mission Type Switcher - only show for Challenge 1 */}
      {data.challengeNumber === 1 && (
        <div className="csve-step-type-switcher">
          <span className="csve-switcher-label">Mission Type:</span>
          <div className="csve-switcher-buttons">
            <button
              className={`csve-switcher-btn ${data.missionType === 'speaking' ? 'active' : ''}`}
              onClick={() => updateData({ missionType: 'speaking' })}
            >
              <i className="ri-speak-line" />
              Speaking
            </button>
            <button
              className={`csve-switcher-btn ${data.missionType === 'reading' ? 'active' : ''}`}
              onClick={() => updateData({ missionType: 'reading' })}
            >
              <i className="ri-book-read-line" />
              Reading
            </button>
            <button
              className={`csve-switcher-btn ${data.missionType === 'listening' ? 'active' : ''}`}
              onClick={() => updateData({ missionType: 'listening' })}
            >
              <i className="ri-headphone-line" />
              Listening
            </button>
          </div>
        </div>
      )}

      <div className="csve-mission-content">
        {/* Left Column - Student View */}
        <div className="csve-mission-left">
          {/* Challenge Name */}
          <input
            type="text"
            className="csve-challenge-name-input"
            value={data.challengeName}
            onChange={e => updateData({ challengeName: (e.target as HTMLInputElement).value })}
            placeholder="Challenge 1"
          />

          {/* Speaking Type Content */}
          {data.missionType === 'speaking' && (
            <>
              {/* Situation Box */}
              <div className="csve-mission-situation-box">
                <RichTextInput
                  className="csve-mission-situation"
                  value={data.situation}
                  onChange={html => updateData({ situation: html })}
                  placeholder="Describe the situation..."
                  singleLine={false}
                />
                {data.situationTranslation !== undefined ? (
                  <div className="csve-mission-situation-translation">
                    <RichTextInput
                      className="csve-mission-translation-input"
                      value={data.situationTranslation || ''}
                      onChange={html => updateData({ situationTranslation: html })}
                      placeholder="Japanese translation..."
                      singleLine={false}
                    />
                    <button
                      className="csve-remove-translation-btn"
                      onClick={() => updateData({ situationTranslation: undefined })}
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="csve-add-translation-btn"
                    onClick={() => updateData({ situationTranslation: '' })}
                  >
                    <i className="ri-translate-2" /> Add Translation
                  </button>
                )}
              </div>

              {/* Grammar Tip (Optional) */}
              {renderInstructionEditor()}

              {data.showGrammarTip ? (
                <div className="csve-mission-grammar-tip">
                  <div className="csve-grammar-tip-header">
                    <i className="ri-lightbulb-line" />
                    <input
                      type="text"
                      className="csve-grammar-tip-title-input"
                      value={data.grammarTipTitle}
                      onChange={e => updateData({ grammarTipTitle: (e.target as HTMLInputElement).value })}
                      placeholder="Today's grammar tip"
                    />
                    <button
                      className="csve-remove-grammar-tip-btn"
                      onClick={() => updateData({ showGrammarTip: false })}
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                  <ul className="csve-grammar-tip-items">
                    {data.grammarTipItems.map((item, idx) => (
                      <li key={idx} className="csve-grammar-tip-item">
                        <span className="csve-grammar-tip-bullet">•</span>
                        <input
                          type="text"
                          className="csve-grammar-tip-input"
                          value={item}
                          onChange={e => handleGrammarTipItemUpdate(idx, (e.target as HTMLInputElement).value)}
                          placeholder="Grammar tip..."
                        />
                        {data.grammarTipItems.length > 1 && (
                          <button
                            className="csve-remove-grammar-item-btn"
                            onClick={() => handleRemoveGrammarTipItem(idx)}
                          >
                            <i className="ri-close-line" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button className="csve-add-grammar-item-btn" onClick={handleAddGrammarTipItem}>
                    <i className="ri-add-line" /> Add Item
                  </button>
                </div>
              ) : (
                <button
                  className="csve-add-grammar-tip-btn"
                  onClick={() => updateData({ showGrammarTip: true })}
                >
                  <i className="ri-lightbulb-line" /> Add Grammar Tip
                </button>
              )}

              {/* Image */}
              <div 
                className="csve-mission-image"
                onClick={() => imageRef.current?.click()}
              >
                {data.image ? (
                  <div className="csve-mission-image-preview">
                    <img src={data.image} alt="Mission" />
                    <button
                      className="csve-remove-image-btn"
                      onClick={(e) => { e.stopPropagation(); updateData({ image: '' }); }}
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  </div>
                ) : (
                  <div className="csve-image-placeholder csve-apply-img-placeholder">
                    <span className="csve-placeholder-dims">600 × 400</span>
                    <span className="csve-placeholder-text">Click to add image</span>
                  </div>
                )}
              </div>
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </>
          )}

          {/* Reading Type Content */}
          {data.missionType === 'reading' && (
            <>
              {/* Situation Box */}
              <div className="csve-mission-situation-box">
                <RichTextInput
                  className="csve-mission-situation"
                  value={data.situation}
                  onChange={html => updateData({ situation: html })}
                  placeholder="You want to invite a coworker to dinner."
                  singleLine={true}
                />
                {data.situationTranslation !== undefined ? (
                  <div className="csve-mission-situation-translation">
                    <RichTextInput
                      className="csve-mission-translation-input"
                      value={data.situationTranslation || ''}
                      onChange={html => updateData({ situationTranslation: html })}
                      placeholder="Japanese translation..."
                      singleLine={true}
                    />
                    <button
                      className="csve-remove-translation-btn"
                      onClick={() => updateData({ situationTranslation: undefined })}
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="csve-add-translation-btn"
                    onClick={() => updateData({ situationTranslation: '' })}
                  >
                    <i className="ri-translate-2" /> Add Translation
                  </button>
                )}
              </div>

              {/* Instruction */}
              <div className="csve-mission-instruction-box">
                <RichTextInput
                  className="csve-mission-instruction"
                  value={data.instruction}
                  onChange={html => updateData({ instruction: html })}
                  placeholder="Read a review of some new restaurants..."
                  singleLine={false}
                />
                {data.instructionTranslation !== undefined ? (
                  <div className="csve-mission-instruction-translation">
                    <RichTextInput
                      className="csve-mission-translation-input"
                      value={data.instructionTranslation || ''}
                      onChange={html => updateData({ instructionTranslation: html })}
                      placeholder="Japanese translation..."
                      singleLine={true}
                    />
                    <button
                      className="csve-remove-translation-btn"
                      onClick={() => updateData({ instructionTranslation: undefined })}
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="csve-add-translation-btn"
                    onClick={() => updateData({ instructionTranslation: '' })}
                  >
                    <i className="ri-translate-2" /> Add Translation
                  </button>
                )}
              </div>

              {/* Grammar Tip */}
              {data.showGrammarTip ? (
                <div className="csve-mission-grammar-tip">
                  <div className="csve-grammar-tip-header">
                    <i className="ri-lightbulb-line" />
                    <input
                      type="text"
                      className="csve-grammar-tip-title-input"
                      value={data.grammarTipTitle}
                      onChange={e => updateData({ grammarTipTitle: (e.target as HTMLInputElement).value })}
                      placeholder="Today's grammar tip"
                    />
                    <button
                      className="csve-grammar-tip-remove"
                      onClick={() => updateData({ showGrammarTip: false })}
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                  <ul className="csve-grammar-tip-items">
                    {data.grammarTipItems.map((item, idx) => (
                      <li key={idx} className="csve-grammar-tip-item">
                        <span className="csve-grammar-tip-bullet">•</span>
                        <input
                          type="text"
                          value={item}
                          onChange={e => handleGrammarTipItemUpdate(idx, (e.target as HTMLInputElement).value)}
                          placeholder="Grammar tip..."
                        />
                        {data.grammarTipItems.length > 1 && (
                          <button className="csve-grammar-tip-remove-item" onClick={() => handleRemoveGrammarTipItem(idx)}>
                            <i className="ri-close-line" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button className="csve-grammar-tip-add" onClick={handleAddGrammarTipItem}>
                    <i className="ri-add-line" /> Add Item
                  </button>
                </div>
              ) : (
                <button className="csve-add-grammar-tip-btn" onClick={() => updateData({ showGrammarTip: true, grammarTipTitle: "Today's grammar tip", grammarTipItems: [''] })}>
                  <i className="ri-lightbulb-line" /> Add Grammar Tip
                </button>
              )}

              {/* Reading Passage */}
              <div className="csve-reading-passage">
                {/* Alignment Options */}
                <div className="csve-reading-alignment-options">
                  <span className="csve-alignment-label">Header Alignment:</span>
                  <div className="csve-alignment-buttons">
                    <button
                      className={`csve-alignment-btn ${(data.readingPassage?.headerAlignment || 'center') === 'left' ? 'active' : ''}`}
                      onClick={() => updateData({
                        readingPassage: {
                          ...data.readingPassage!,
                          headerAlignment: 'left'
                        }
                      })}
                      title="Align Left"
                    >
                      <i className="ri-align-left" />
                    </button>
                    <button
                      className={`csve-alignment-btn ${(data.readingPassage?.headerAlignment || 'center') === 'center' ? 'active' : ''}`}
                      onClick={() => updateData({
                        readingPassage: {
                          ...data.readingPassage!,
                          headerAlignment: 'center'
                        }
                      })}
                      title="Align Center"
                    >
                      <i className="ri-align-center" />
                    </button>
                    <button
                      className={`csve-alignment-btn ${(data.readingPassage?.headerAlignment || 'center') === 'right' ? 'active' : ''}`}
                      onClick={() => updateData({
                        readingPassage: {
                          ...data.readingPassage!,
                          headerAlignment: 'right'
                        }
                      })}
                      title="Align Right"
                    >
                      <i className="ri-align-right" />
                    </button>
                  </div>
                </div>
                <div className="csve-reading-passage-header" style={{ textAlign: data.readingPassage?.headerAlignment || 'center' }}>
                  <input
                    type="text"
                    className="csve-reading-title"
                    value={data.readingPassage?.title || ''}
                    onChange={e => updateData({
                      readingPassage: {
                        ...data.readingPassage!,
                        title: (e.target as HTMLInputElement).value
                      }
                    })}
                    placeholder="Article Title"
                    style={{ textAlign: data.readingPassage?.headerAlignment || 'center' }}
                  />
                  {data.readingPassage?.showAuthor !== false ? (
                    <div className="csve-reading-author">
                      <span>by</span>
                      <input
                        type="text"
                        className="csve-reading-author-input"
                        value={data.readingPassage?.author || ''}
                        onChange={e => updateData({
                          readingPassage: {
                            ...data.readingPassage!,
                            author: (e.target as HTMLInputElement).value
                          }
                        })}
                        placeholder="Author Name"
                      />
                      <button
                        className="csve-reading-author-remove"
                        onClick={() => updateData({
                          readingPassage: {
                            ...data.readingPassage!,
                            showAuthor: false
                          }
                        })}
                      >
                        <i className="ri-close-line" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="csve-reading-author-add"
                      onClick={() => updateData({
                        readingPassage: {
                          ...data.readingPassage!,
                          showAuthor: true,
                          author: ''
                        }
                      })}
                    >
                      <i className="ri-user-line" /> Add Author
                    </button>
                  )}
                </div>

                <div className="csve-reading-blocks">
                  {(data.readingPassage?.blocks || []).map((block, blockIdx) => (
                    <div key={blockIdx} className="csve-reading-block">
                      {block.type === 'paragraph' ? (
                        <div className="csve-reading-paragraph-wrapper">
                          <RichTextInput
                            className="csve-reading-paragraph"
                            value={block.content || ''}
                            onChange={html => {
                              const newBlocks = [...(data.readingPassage?.blocks || [])];
                              newBlocks[blockIdx] = { ...newBlocks[blockIdx], content: html };
                              updateData({ readingPassage: { ...data.readingPassage!, blocks: newBlocks } });
                            }}
                            placeholder="Write your paragraph here..."
                            singleLine={false}
                          />
                          <button
                            className="csve-reading-block-remove"
                            onClick={() => {
                              const newBlocks = (data.readingPassage?.blocks || []).filter((_, i) => i !== blockIdx);
                              updateData({ readingPassage: { ...data.readingPassage!, blocks: newBlocks } });
                            }}
                          >
                            <i className="ri-close-line" />
                          </button>
                        </div>
                      ) : (
                        <div className="csve-reading-images-wrapper">
                          <div className="csve-reading-images">
                            {(block.images || []).map((img, imgIdx) => (
                              <div key={imgIdx} className="csve-reading-image-item">
                                <img src={img} alt="" />
                                <button
                                  className="csve-reading-image-remove"
                                  onClick={() => {
                                    const newImages = (block.images || []).filter((_, i) => i !== imgIdx);
                                    const newBlocks = [...(data.readingPassage?.blocks || [])];
                                    newBlocks[blockIdx] = { ...newBlocks[blockIdx], images: newImages };
                                    updateData({ readingPassage: { ...data.readingPassage!, blocks: newBlocks } });
                                  }}
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                            ))}
                            <label className="csve-reading-image-add">
                              <i className="ri-image-add-line" />
                              <span className="csve-reading-image-dims">200 × 140</span>
                              <span className="csve-reading-image-text">Add Image</span>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                style={{ display: 'none' }}
                                onChange={e => {
                                  const files = (e.target as HTMLInputElement).files;
                                  if (!files) return;
                                  Array.from(files).forEach(file => {
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      const newImages = [...(block.images || []), reader.result as string];
                                      const newBlocks = [...(data.readingPassage?.blocks || [])];
                                      newBlocks[blockIdx] = { ...newBlocks[blockIdx], images: newImages };
                                      updateData({ readingPassage: { ...data.readingPassage!, blocks: newBlocks } });
                                    };
                                    reader.readAsDataURL(file);
                                  });
                                }}
                              />
                            </label>
                          </div>
                          <button
                            className="csve-reading-block-remove"
                            onClick={() => {
                              const newBlocks = (data.readingPassage?.blocks || []).filter((_, i) => i !== blockIdx);
                              updateData({ readingPassage: { ...data.readingPassage!, blocks: newBlocks } });
                            }}
                          >
                            <i className="ri-close-line" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="csve-reading-add-block">
                  <button
                    onClick={() => {
                      const newBlocks = [...(data.readingPassage?.blocks || []), { type: 'paragraph' as const, content: '' }];
                      updateData({ readingPassage: { ...data.readingPassage!, blocks: newBlocks } });
                    }}
                  >
                    <i className="ri-text" /> Add Paragraph
                  </button>
                  <button
                    onClick={() => {
                      const newBlocks = [...(data.readingPassage?.blocks || []), { type: 'images' as const, images: [] }];
                      updateData({ readingPassage: { ...data.readingPassage!, blocks: newBlocks } });
                    }}
                  >
                    <i className="ri-image-line" /> Add Images
                  </button>
                </div>

                {/* Closing Question */}
                <div className="csve-reading-closing">
                  <textarea
                    className="csve-reading-closing-input"
                    value={data.readingPassage?.closingQuestion || ''}
                    onChange={e => updateData({
                      readingPassage: {
                        ...data.readingPassage!,
                        closingQuestion: (e.target as HTMLTextAreaElement).value
                      }
                    })}
                    placeholder="Closing question or call to action..."
                    rows={2}
                  />
                </div>
              </div>
            </>
          )}

          {/* Listening Type Content */}
          {data.missionType === 'listening' && (
            <>
              {/* Situation Box */}
              <div className="csve-mission-situation-box">
                <RichTextInput
                  className="csve-mission-situation"
                  value={data.situation}
                  onChange={html => updateData({ situation: html })}
                  placeholder="Listen to your friend talk about..."
                  singleLine={true}
                />
                {data.situationTranslation !== undefined ? (
                  <div className="csve-mission-situation-translation">
                    <RichTextInput
                      className="csve-mission-translation-input"
                      value={data.situationTranslation || ''}
                      onChange={html => updateData({ situationTranslation: html })}
                      placeholder="Japanese translation..."
                      singleLine={true}
                    />
                    <button
                      className="csve-remove-translation-btn"
                      onClick={() => updateData({ situationTranslation: undefined })}
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="csve-add-translation-btn"
                    onClick={() => updateData({ situationTranslation: '' })}
                  >
                    <i className="ri-translate-2" /> Add Translation
                  </button>
                )}
              </div>

              {/* Grammar Tip */}
              {renderInstructionEditor()}

              {data.showGrammarTip ? (
                <div className="csve-mission-grammar-tip">
                  <div className="csve-grammar-tip-header">
                    <i className="ri-lightbulb-line" />
                    <input
                      type="text"
                      className="csve-grammar-tip-title-input"
                      value={data.grammarTipTitle}
                      onChange={e => updateData({ grammarTipTitle: (e.target as HTMLInputElement).value })}
                      placeholder="Today's grammar tip"
                    />
                    <button
                      className="csve-grammar-tip-remove"
                      onClick={() => updateData({ showGrammarTip: false })}
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                  <ul className="csve-grammar-tip-items">
                    {data.grammarTipItems.map((item, idx) => (
                      <li key={idx} className="csve-grammar-tip-item">
                        <span className="csve-grammar-tip-bullet">•</span>
                        <input
                          type="text"
                          value={item}
                          onChange={e => handleGrammarTipItemUpdate(idx, (e.target as HTMLInputElement).value)}
                          placeholder="Grammar tip..."
                        />
                        {data.grammarTipItems.length > 1 && (
                          <button className="csve-grammar-tip-remove-item" onClick={() => handleRemoveGrammarTipItem(idx)}>
                            <i className="ri-close-line" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button className="csve-grammar-tip-add" onClick={handleAddGrammarTipItem}>
                    <i className="ri-add-line" /> Add Item
                  </button>
                </div>
              ) : (
                <button className="csve-add-grammar-tip-btn" onClick={() => updateData({ showGrammarTip: true, grammarTipTitle: "Today's grammar tip", grammarTipItems: [''] })}>
                  <i className="ri-lightbulb-line" /> Add Grammar Tip
                </button>
              )}

              {/* Image */}
              <div
                className="csve-mission-image"
                onClick={() => imageRef.current?.click()}
              >
                {data.image ? (
                  <img src={data.image} alt="Mission" />
                ) : (
                  <div className="csve-image-placeholder">
                    <i className="ri-image-add-line" />
                    <span className="csve-placeholder-dims">600 × 400</span>
                    <span className="csve-placeholder-text">Click to add image</span>
                  </div>
                )}
              </div>
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </>
          )}

          {/* Discussion Type Content */}
          {data.missionType === 'discussion' && (
            <>
              {/* Instruction */}
              <div className="csve-mission-instruction-box">
                <RichTextInput
                  className="csve-mission-instruction"
                  value={data.instruction}
                  onChange={html => updateData({ instruction: html })}
                  placeholder="Discuss your ideas."
                  singleLine={true}
                />
                {data.instructionTranslation !== undefined ? (
                  <div className="csve-mission-instruction-translation">
                    <RichTextInput
                      className="csve-mission-translation-input"
                      value={data.instructionTranslation || ''}
                      onChange={html => updateData({ instructionTranslation: html })}
                      placeholder="Japanese translation..."
                      singleLine={true}
                    />
                    <button
                      className="csve-remove-translation-btn"
                      onClick={() => updateData({ instructionTranslation: undefined })}
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="csve-add-translation-btn"
                    onClick={() => updateData({ instructionTranslation: '' })}
                  >
                    <i className="ri-translate-2" /> Add Translation
                  </button>
                )}
              </div>

              {/* Topic Cards */}
              <div className="csve-mission-topics">
                {(data.topics || []).map((topic, topicIdx) => (
                  <div key={topicIdx} className="csve-mission-topic-card">
                    <div className="csve-mission-topic-header">
                      <span className="csve-mission-topic-number">TOPIC {topicIdx + 1}</span>
                      <input
                        type="text"
                        className="csve-mission-topic-title"
                        value={topic.title}
                        onChange={e => handleTopicTitleUpdate(topicIdx, (e.target as HTMLInputElement).value)}
                        placeholder="Topic Title"
                      />
                      {(data.topics || []).length > 1 && (
                        <button
                          className="csve-mission-remove-topic"
                          onClick={() => handleRemoveTopic(topicIdx)}
                        >
                          <i className="ri-close-line" />
                        </button>
                      )}
                    </div>
                    <ol className="csve-mission-topic-questions">
                      {topic.questions.map((q, qIdx) => (
                        <li key={qIdx} className="csve-mission-topic-question">
                          <span className="csve-mission-topic-q-number">{qIdx + 1}.</span>
                          <textarea
                            className="csve-mission-topic-q-input"
                            value={q}
                            onChange={e => handleTopicQuestionUpdate(topicIdx, qIdx, (e.target as HTMLTextAreaElement).value)}
                            placeholder="Question..."
                            rows={1}
                            onInput={e => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = '0';
                              target.style.height = target.scrollHeight + 'px';
                            }}
                            ref={el => {
                              if (el) {
                                el.style.height = '0';
                                el.style.height = el.scrollHeight + 'px';
                              }
                            }}
                          />
                          {topic.questions.length > 1 && (
                            <button
                              className="csve-mission-remove-topic-q"
                              onClick={() => handleRemoveTopicQuestion(topicIdx, qIdx)}
                            >
                              <i className="ri-close-line" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ol>
                    <button
                      className="csve-mission-add-topic-q"
                      onClick={() => handleAddTopicQuestion(topicIdx)}
                    >
                      <i className="ri-add-line" /> Add Question
                    </button>
                  </div>
                ))}
                <button className="csve-mission-add-topic" onClick={handleAddTopic}>
                  <i className="ri-add-line" /> Add Topic
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csve-mission-right">
          <div className="tgs-tutor-guide">
            {/* Tutor Guide Header */}
            <div className="tgs-header">
              <span className="tgs-title">{data.sectionTitle}</span>
            </div>
            <div className="csve-mission-tutor-subheader">
              <input
                type="text"
                className="csve-mission-challenge-input"
                value={data.challengeName.toUpperCase()}
                onChange={e => updateData({ challengeName: (e.target as HTMLInputElement).value })}
              />
              <span className="csve-mission-duration-wrapper">
                (<input
                  type="text"
                  className="csve-mission-duration-input"
                  value={data.duration}
                  onChange={e => updateData({ duration: (e.target as HTMLInputElement).value })}
                  placeholder="5-6 minutes"
                />)
              </span>
            </div>

            {/* Tutor Steps */}
            <div className="tgs-steps">
              {data.tutorSteps.map((step, stepIdx) => (
                <div key={stepIdx} className="tgs-step">
                  <span className="tgs-number">{stepIdx + 1}</span>
                  <div className="tgs-content">
                    <input
                      type="text"
                      className="tgs-instruction-input"
                      value={step.instruction}
                      onChange={e => handleTutorStepUpdate(stepIdx, 'instruction', (e.target as HTMLInputElement).value)}
                      placeholder="Step instruction..."
                    />
                    {/* Scripts & Prompts interleaved */}
                    {interleaveForEditor(step.scripts || [], step.prompts || []).map((item) => {
                      if (item.kind === 'script') {
                        const isDlg = item.isDialogue;
                        return (
                          <div key={`s-${item.sourceIdx}`} className={isDlg ? "tgs-script-item" : "tgs-prompt-item"}>
                            <span className={isDlg ? "tgs-script-bullet" : "tgs-prompt-icon"}>{isDlg ? '●' : '▸'}</span>
                            <input
                              type="text"
                              className={isDlg ? "tgs-script-input" : "tgs-prompt-input"}
                              value={item.text}
                              onChange={e => {
                                const newScripts = [...(step.scripts || [])];
                                newScripts[item.sourceIdx] = { text: (e.target as HTMLInputElement).value };
                                handleTutorStepUpdate(stepIdx, 'scripts', newScripts);
                              }}
                              placeholder="Script..."
                            />
                            <button
                              className="tgs-remove-btn"
                              onClick={() => {
                                const newScripts = (step.scripts || []).filter((_, i) => i !== item.sourceIdx);
                                handleTutorStepUpdate(stepIdx, 'scripts', newScripts);
                              }}
                            >
                              <i className="ri-close-line" />
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div key={`p-${item.sourceIdx}`} className="tgs-prompt-item">
                          <span className="tgs-prompt-icon">▸</span>
                          <input
                            type="text"
                            className="tgs-prompt-input"
                            value={item.text}
                            onChange={e => {
                              const newPrompts = [...(step.prompts || [])];
                              newPrompts[item.sourceIdx] = { text: (e.target as HTMLInputElement).value };
                              handleTutorStepUpdate(stepIdx, 'prompts', newPrompts);
                            }}
                            placeholder="Question or direction..."
                          />
                          <button
                            className="tgs-remove-btn"
                            onClick={() => {
                              const newPrompts = (step.prompts || []).filter((_, i) => i !== item.sourceIdx);
                              handleTutorStepUpdate(stepIdx, 'prompts', newPrompts);
                            }}
                          >
                            <i className="ri-close-line" />
                          </button>
                        </div>
                      );
                    })}
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
                            handleTutorStepUpdate(stepIdx, 'tips', newTips);
                          }}
                          placeholder="Tip..."
                        />
                        <button
                          className="tgs-remove-btn"
                          onClick={() => {
                            const newTips = (step.tips || []).filter((_, i) => i !== tipIdx);
                            handleTutorStepUpdate(stepIdx, 'tips', newTips);
                          }}
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    ))}
                    {/* Listening Script Box */}
                    {step.listeningScript !== undefined && (
                      <div className="tgs-listening-script-box">
                        <div className="tgs-listening-script-header">
                          <span>Listening Script</span>
                          <button
                            className="tgs-remove-btn"
                            onClick={() => handleTutorStepUpdate(stepIdx, 'listeningScript', '' as any)}
                          >
                            <i className="ri-close-line" />
                          </button>
                        </div>
                        <RichTextInput
                          value={step.listeningScript}
                          onChange={(html: string) => handleTutorStepUpdate(stepIdx, 'listeningScript', html)}
                          placeholder="Enter the listening script..."
                          className="tgs-listening-script-input"
                          singleLine={false}
                        />
                      </div>
                    )}
                    {/* Add Script/Tip Buttons */}
                    <div className="tgs-add-btns">
                      <button
                        className="tgs-add-script-btn"
                        onClick={() => {
                          const newScripts = [...(step.scripts || []), { text: '' }];
                          handleTutorStepUpdate(stepIdx, 'scripts', newScripts);
                        }}
                      >
                        <i className="ri-add-line" /> Script
                      </button>
                      <button
                        className="tgs-add-prompt-btn"
                        onClick={() => {
                          const newPrompts = [...(step.prompts || []), { text: '' }];
                          handleTutorStepUpdate(stepIdx, 'prompts', newPrompts);
                        }}
                      >
                        <i className="ri-add-line" /> Prompt
                      </button>
                      {/* Auto-split: move hint scripts to prompts */}
                      {(step.scripts || []).some(s => s.text && !isDialogueScript(s.text)) && (
                        <button
                          className="tgs-add-prompt-btn"
                          style={{ borderStyle: 'dashed' }}
                          onClick={() => {
                            const scripts = step.scripts || [];
                            const keepScripts = scripts.filter(s => isDialogueScript(s.text));
                            const moveToPrompts = scripts.filter(s => s.text && !isDialogueScript(s.text));
                            const newSteps = [...data.tutorSteps];
                            newSteps[stepIdx] = { ...newSteps[stepIdx], scripts: keepScripts, prompts: [...(step.prompts || []), ...moveToPrompts] };
                            updateData({ tutorSteps: newSteps });
                          }}
                        >
                          <i className="ri-scissors-line" /> Auto-Split
                        </button>
                      )}
                      <button
                        className="tgs-add-tip-btn"
                        onClick={() => {
                          const newTips = [...(step.tips || []), { text: '' }];
                          handleTutorStepUpdate(stepIdx, 'tips', newTips);
                        }}
                      >
                        <i className="ri-add-line" /> Tip
                      </button>
                      {step.listeningScript === undefined && (
                        <button
                          className="tgs-add-script-btn"
                          style={{ background: '#16a34a', color: 'white', borderColor: '#16a34a' }}
                          onClick={() => handleTutorStepUpdate(stepIdx, 'listeningScript', '')}
                        >
                          <i className="ri-headphone-line" /> Listening Script
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    className="tgs-step-remove"
                    onClick={() => handleRemoveTutorStep(stepIdx)}
                  >
                    <i className="ri-delete-bin-line" />
                  </button>
                </div>
              ))}
              <button className="tgs-add-step-btn" onClick={handleAddTutorStep}>
                <i className="ri-add-line" /> Add Step
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FEEDBACK SECTION EDITOR (Section 6)
// ============================================================================

interface FeedbackSectionEditorProps {
  data: FeedbackSectionData;
  onChange: (data: FeedbackSectionData) => void;
}

function FeedbackSectionEditor({ data, onChange }: FeedbackSectionEditorProps) {
  const updateData = (updates: Partial<FeedbackSectionData>) => {
    onChange({ ...data, ...updates });
  };

  // Tutor step handlers
  const updateTutorStep = (stepIdx: number, field: keyof FeedbackTutorStep, value: unknown) => {
    const newSteps = [...data.tutorSteps];
    newSteps[stepIdx] = { ...newSteps[stepIdx], [field]: value };
    updateData({ tutorSteps: newSteps });
  };

  const addTutorStep = () => {
    updateData({ tutorSteps: [...data.tutorSteps, { instruction: '' }] });
  };

  const removeTutorStep = (stepIdx: number) => {
    updateData({ tutorSteps: data.tutorSteps.filter((_, i) => i !== stepIdx) });
  };

  // Rubric handlers
  const updateRubricLevel = (levelIdx: number, updates: Partial<RubricLevel>) => {
    const newLevels = [...data.rubricLevels];
    newLevels[levelIdx] = { ...newLevels[levelIdx], ...updates };
    updateData({ rubricLevels: newLevels });
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
        {/* Left Column - Student View */}
        <div className="csve-feedback-left">
          {/* GOAL Card */}
          <div className="csve-fb-goal-card">
            <div className="csve-fb-goal-accent" />
            <div className="csve-fb-goal-body">
              <span className="csve-fb-goal-label">LESSON OBJECTIVE</span>
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

          {/* Performance Levels */}
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
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = el.scrollHeight + 'px';
                        }
                      }}
                      onInput={e => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = target.scrollHeight + 'px';
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <FixedFeedbackGuide />
        </div>

        {/* Right Column - Tutor Guide (unchanged) */}
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
                    {/* Scripts & Prompts interleaved */}
                    {interleaveForEditor(step.scripts || [], step.prompts || []).map((item) => {
                      if (item.kind === 'script') {
                        const isDlg = item.isDialogue;
                        return (
                          <div key={`s-${item.sourceIdx}`} className={isDlg ? "tgs-script-item" : "tgs-prompt-item"}>
                            <span className={isDlg ? "tgs-script-bullet" : "tgs-prompt-icon"}>{isDlg ? '●' : '▸'}</span>
                            <input
                              type="text"
                              className={isDlg ? "tgs-script-input" : "tgs-prompt-input"}
                              value={item.text}
                              onChange={e => {
                                const newScripts = [...(step.scripts || [])];
                                newScripts[item.sourceIdx] = { text: (e.target as HTMLInputElement).value };
                                updateTutorStep(stepIdx, 'scripts', newScripts);
                              }}
                              placeholder="Script..."
                            />
                            <button
                              className="tgs-remove-btn"
                              onClick={() => {
                                const newScripts = (step.scripts || []).filter((_, i) => i !== item.sourceIdx);
                                updateTutorStep(stepIdx, 'scripts', newScripts);
                              }}
                            >
                              <i className="ri-close-line" />
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div key={`p-${item.sourceIdx}`} className="tgs-prompt-item">
                          <span className="tgs-prompt-icon">▸</span>
                          <input
                            type="text"
                            className="tgs-prompt-input"
                            value={item.text}
                            onChange={e => {
                              const newPrompts = [...(step.prompts || [])];
                              newPrompts[item.sourceIdx] = { text: (e.target as HTMLInputElement).value };
                              updateTutorStep(stepIdx, 'prompts', newPrompts);
                            }}
                            placeholder="Question or direction..."
                          />
                          <button
                            className="tgs-remove-btn"
                            onClick={() => {
                              const newPrompts = (step.prompts || []).filter((_, i) => i !== item.sourceIdx);
                              updateTutorStep(stepIdx, 'prompts', newPrompts);
                            }}
                          >
                            <i className="ri-close-line" />
                          </button>
                        </div>
                      );
                    })}
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
                      {(step.scripts || []).some(s => s.text && !isDialogueScript(s.text)) && (
                        <button
                          className="tgs-add-prompt-btn"
                          style={{ borderStyle: 'dashed' }}
                          onClick={() => {
                            const scripts = step.scripts || [];
                            const keepScripts = scripts.filter(s => isDialogueScript(s.text));
                            const moveToPrompts = scripts.filter(s => s.text && !isDialogueScript(s.text));
                            const newSteps = [...data.tutorSteps];
                            newSteps[stepIdx] = { ...newSteps[stepIdx], scripts: keepScripts, prompts: [...(step.prompts || []), ...moveToPrompts] };
                            updateData({ tutorSteps: newSteps });
                          }}
                        >
                          <i className="ri-scissors-line" /> Auto-Split
                        </button>
                      )}
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
