/**
 * AI Content Generator Widget
 * Generates lesson content with tab-based section selection
 */
import { useState, useEffect } from 'preact/hooks';
import { generateIntroductionContent, generateEpisodeSummary, type IntroText, type LessonIssue, type LessonGoalStep } from '../api/ai.api';
import type { Skill } from '../api/lessonMaterial.api';
import '../styles/AIContentGenerator.css';

export interface IntroductionData {
  introTexts: IntroText[];
  introImage: string | null;
  lessonIssue: LessonIssue | null;
  lessonGoalDuration: string;
  lessonGoalSteps: LessonGoalStep[];
}

type SectionType = 'introduce' | 'learn' | 'apply' | 'trivia' | 'exercise' | 'mission' | 'mission2';

interface SectionConfig {
  id: SectionType;
  label: string;
  number: number;
  icon: string;
  description: string;
}

const SECTIONS: SectionConfig[] = [
  { id: 'introduce', label: 'Introduce', number: 1, icon: 'ri-lightbulb-line', description: 'Opening & context' },
  { id: 'learn', label: 'Learn', number: 2, icon: 'ri-book-line', description: 'Step A & B vocabulary/grammar' },
  { id: 'apply', label: 'Apply', number: 3, icon: 'ri-chat-3-line', description: 'Practice activity' },
  { id: 'trivia', label: 'Trivia', number: 0, icon: 'ri-lightbulb-flash-line', description: 'Trivia Time content' },
  { id: 'exercise', label: 'Exercise', number: 4, icon: 'ri-checkbox-circle-line', description: 'Exercises' },
  { id: 'mission', label: 'Mission', number: 5, icon: 'ri-rocket-line', description: 'Challenge 1' },
  { id: 'mission2', label: 'Mission 2', number: 6, icon: 'ri-rocket-2-line', description: 'Challenge 2' },
];

interface AIContentGeneratorProps {
  topic: string;
  skillLevel: string;
  skill: Skill;
  currentIntroductionData?: IntroductionData | null;
  onGenerateIntroduction: (data: IntroductionData) => void;
  onGenerateLearn?: (data: any) => void;
  onGenerateStepB?: (data: any) => void;
  onGenerateApply?: (data: any) => void;
  onGenerateTrivia?: (data: any) => void;
  onGenerateExercise?: (data: any) => void;
  onGenerateMission?: (data: any) => void;
  level?: number;
  chapter?: number;
  lessonNumber?: number;
  lessonGoal: string;
  // Current step types from the editor - these tell us what's currently selected
  currentStepAType?: 'vocabulary' | 'expressions';
  currentStepBType?: 'speak-your-mind' | 'grammar-tip' | 'pronunciation';
  // Current item counts in the editor - AI will generate this many items
  vocabularyCount?: number;
  expressionCount?: number;
  // Current apply activity type
  currentApplyType?: 'speaking' | 'listening' | 'reading';
  // Current dialogue line count (for speaking apply)
  dialogueLineCount?: number;
  // Exercise section props
  currentExerciseStepAType?: 'rephrase' | 'choose' | 'change';
  currentExerciseStepBType?: 'conversation' | 'multiple-choice' | 'speech' | 'compare';
  exerciseItemCount?: number;
  hasExerciseStepB?: boolean;
  // Mission section props
  currentMissionType?: 'speaking' | 'discussion' | 'reading' | 'listening';
  missionQuestionCount?: number;
  // Mission 2 section props
  currentMission2Type?: 'speaking' | 'discussion' | 'reading' | 'listening';
  mission2QuestionCount?: number;
  onGenerateMission2?: (data: any) => void;
  // Section status - indicates which sections have content
  sectionStatus?: {
    introduce: boolean;
    learn: boolean;
    apply: boolean;
    trivia: boolean;
    exercise: boolean;
    mission: boolean;
    mission2: boolean;
  };
  // Story data for K-Drama style immersive learning
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
      image?: string;
    }>;
    setting: string;
    previousSummary: string;
    currentPlotPoints: string[];
    currentEpisodeSummary: string;
    nextEpisodeHook: string;
    storyNotes: string;
  };
  onUpdateStory?: (data: any) => void;
  // Current Apply section data - passed to Mission for story continuity
  currentApplyData?: {
    activityType: 'speaking' | 'listening' | 'reading';
    situationText?: string;
    dialogueLines?: Array<{ speaker: string; text: string }>;
    readingText?: string;
    tutorSteps?: Array<{ instruction?: string; scripts?: Array<{ text: string }>; listeningScript?: string }>;
  };
  // Current Learn section data - passed to Apply, Exercise, Mission for cohesion
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
  };
}

export function AIContentGenerator({
  topic,
  skillLevel,
  skill,
  currentIntroductionData,
  onGenerateIntroduction,
  onGenerateLearn,
  onGenerateStepB,
  onGenerateApply,
  onGenerateTrivia,
  onGenerateExercise,
  onGenerateMission,
  level,
  chapter,
  lessonNumber,
  lessonGoal,
  currentStepAType = 'vocabulary',
  currentStepBType = 'speak-your-mind',
  vocabularyCount,
  expressionCount,
  currentApplyType = 'speaking',
  dialogueLineCount,
  currentExerciseStepAType = 'rephrase',
  currentExerciseStepBType = 'conversation',
  exerciseItemCount,
  hasExerciseStepB = false,
  currentMissionType = 'speaking',
  missionQuestionCount,
  currentMission2Type = 'discussion',
  mission2QuestionCount,
  onGenerateMission2,
  sectionStatus = {
    introduce: false,
    learn: false,
    apply: false,
    trivia: false,
    exercise: false,
    mission: false,
    mission2: false,
  },
  storyData,
  onUpdateStory,
  currentApplyData,
  currentLearnData,
}: AIContentGeneratorProps) {
  // Helper function to get smart default instructions based on skill level and topic
  const getSmartInstructions = (section: SectionType, level?: number, skillLevel?: string): string => {
    const complexity = !level ? 'intermediate' : level <= 3 ? 'simple and beginner-friendly' : level <= 6 ? 'intermediate' : 'advanced';
    const levelHint = skillLevel?.toLowerCase().includes('beginner') ? 'Use simple vocabulary and short sentences.' 
      : skillLevel?.toLowerCase().includes('advanced') ? 'Use sophisticated vocabulary and complex structures.'
      : 'Balance simplicity with natural language patterns.';
    
    const smartInstructions: Record<SectionType, string> = {
      introduce: `Create an engaging ${complexity} introduction about "${topic}". ${levelHint} Focus on why this topic matters and set clear expectations.`,
      learn: `Generate ${complexity} vocabulary/grammar content for "${topic}". ${levelHint} Include practical examples that students can immediately use.`,
      apply: `Design ${complexity} practice activities for "${topic}". ${levelHint} Create realistic scenarios relevant to the lesson goal.`,
      trivia: `Create interesting ${complexity} trivia about "${topic}". ${levelHint} Include fun facts that connect to the lesson content.`,
      exercise: `Create ${complexity} exercises for "${topic}". ${levelHint} Vary question types and provide clear answer keys.`,
      mission: `Create an immersive ${complexity} challenge for "${topic}". ${levelHint} Design scenarios that feel authentic and meaningful.`,
      mission2: `Create a second ${complexity} challenge for "${topic}" with different content from Challenge 1. ${levelHint}`,
    };
    return smartInstructions[section];
  };

  // Helper function to calculate content metrics
  const calculateContentMetrics = (content: any): { wordCount: number; readingTime: string; complexity: string } => {
    let text = '';
    
    // Extract all text content based on section type
    if (content.introTexts) {
      text += content.introTexts.map((t: any) => t.text).join(' ');
    }
    if (content.lessonIssue) {
      text += ' ' + content.lessonIssue.title + ' ' + (content.lessonIssue.points?.join(' ') || '');
    }
    if (content.learnData) {
      const learn = content.learnData;
      if (learn.vocabularyItems) text += ' ' + learn.vocabularyItems.map((v: any) => `${v.word} ${v.definition} ${v.example}`).join(' ');
      if (learn.expressionItems) text += ' ' + learn.expressionItems.map((e: any) => `${e.expression} ${e.meaning} ${e.example}`).join(' ');
    }
    if (content.applyData) {
      const apply = content.applyData;
      text += ' ' + (apply.situationText || '') + ' ' + (apply.readingText || '');
      if (apply.dialogueLines) text += ' ' + apply.dialogueLines.map((d: any) => d.text).join(' ');
    }
    if (content.triviaData) {
      text += ' ' + (content.triviaData.triviaText || '');
    }
    if (content.exerciseData) {
      const ex = content.exerciseData;
      if (ex.exerciseItems) text += ' ' + ex.exerciseItems.map((i: any) => `${i.question} ${i.answer}`).join(' ');
      if (ex.chooseItems) text += ' ' + ex.chooseItems.map((i: any) => `${i.question} ${i.options?.join(' ')}`).join(' ');
    }
    if (content.missionData) {
      const m = content.missionData;
      text += ' ' + (m.situation || '') + ' ' + (m.instruction || '');
      if (m.questions) text += ' ' + m.questions.map((q: any) => q.question).join(' ');
      if (m.readingPassage?.blocks) text += ' ' + m.readingPassage.blocks.map((b: any) => b.text).join(' ');
    }
    
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const avgWordsPerMin = 150; // Average reading speed for ESL learners
    const readingMins = Math.ceil(wordCount / avgWordsPerMin);
    const readingTime = readingMins <= 1 ? '< 1 min' : `~${readingMins} min`;
    
    // Calculate complexity based on word length and sentence structure
    const avgWordLength = wordCount > 0 ? words.reduce((sum, w) => sum + w.length, 0) / wordCount : 0;
    const complexity = avgWordLength < 4.5 ? 'Simple' : avgWordLength < 6 ? 'Intermediate' : 'Advanced';
    
    return { wordCount, readingTime, complexity };
  };
  const DEFAULT_BASE_INSTRUCTIONS: Record<SectionType, string> = {
    introduce: getSmartInstructions('introduce', level, skillLevel),
    learn: getSmartInstructions('learn', level, skillLevel),
    apply: getSmartInstructions('apply', level, skillLevel),
    trivia: getSmartInstructions('trivia', level, skillLevel),
    exercise: getSmartInstructions('exercise', level, skillLevel),
    mission: getSmartInstructions('mission', level, skillLevel),
    mission2: getSmartInstructions('mission2', level, skillLevel),
  };

  const [activeSection, setActiveSection] = useState<SectionType>('introduce');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; section: string }>({ current: 0, total: 0, section: '' });
  const [generatedContent, setGeneratedContent] = useState<any | null>(null);
  const [generatedSection, setGeneratedSection] = useState<SectionType | null>(null);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [generationMode, setGenerationMode] = useState<'new' | 'improve'>('new');
  const [baseInstructions, setBaseInstructions] = useState<Record<SectionType, string>>(DEFAULT_BASE_INSTRUCTIONS);
  const [customPrompt, setCustomPrompt] = useState('');

  const [includeLessonIssue, setIncludeLessonIssue] = useState(false);
  const [includeTranslation, setIncludeTranslation] = useState(true);
  const [translationLanguage, setTranslationLanguage] = useState<'japanese' | 'korean' | 'vietnamese' | 'chinese'>('japanese');
  // For Learn section: track which step (A or B) to generate
  const [learnStep, setLearnStep] = useState<'stepA' | 'stepB'>('stepA');
  // For Exercise section: track which step (A or B) to generate
  const [exerciseStep, setExerciseStep] = useState<'stepA' | 'stepB'>('stepA');
  // For Story refinement chat
  const [storyRefinePrompt, setStoryRefinePrompt] = useState('');
  const [isRefiningStory, setIsRefiningStory] = useState(false);
  const [showStoryPanel, setShowStoryPanel] = useState(false);

  // Load base instructions from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ai-base-instructions');
      if (saved) {
        const parsed = JSON.parse(saved);
        setBaseInstructions({ ...DEFAULT_BASE_INSTRUCTIONS, ...parsed });
      }
    } catch (e) {
      console.error('Failed to load base instructions from localStorage:', e);
    }
  }, []);

  // Save base instructions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('ai-base-instructions', JSON.stringify(baseInstructions));
    } catch (e) {
      console.error('Failed to save base instructions to localStorage:', e);
    }
  }, [baseInstructions]);

  const currentSectionConfig = SECTIONS.find(s => s.id === activeSection)!;

  const handleGenerateIntroduction = async () => {
    if (!topic || !skillLevel) {
      setError('Please fill in topic and skill level first');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      // Determine which learnType or stepBType to pass based on the Learn section's selected step
      const learnType = activeSection === 'learn' && learnStep === 'stepA' ? currentStepAType : undefined;
      const stepBType = activeSection === 'learn' && learnStep === 'stepB' ? currentStepBType : undefined;

      // Determine apply type when in Apply section
      const applyType = activeSection === 'apply' ? currentApplyType : undefined;

      // Check if we're generating trivia
      const generateTrivia = activeSection === 'trivia';

      // Check if we're generating exercise content
      const exerciseType = activeSection === 'exercise' 
        ? (exerciseStep === 'stepA' ? currentExerciseStepAType : currentExerciseStepBType)
        : undefined;
      const exerciseStepType = activeSection === 'exercise' ? exerciseStep : undefined;

      // Check if we're generating mission content (mission or mission2)
      const missionType = activeSection === 'mission' ? currentMissionType 
        : activeSection === 'mission2' ? currentMission2Type 
        : undefined;
      const missionQCount = activeSection === 'mission' ? missionQuestionCount 
        : activeSection === 'mission2' ? mission2QuestionCount 
        : undefined;
      const isMission2 = activeSection === 'mission2';

      const response = await generateIntroductionContent(
        topic,
        skillLevel,
        skill,
        customPrompt, // Pass custom prompt if available
        generationMode === 'improve' ? currentIntroductionData : null, // Only pass current content if improving
        baseInstructions[activeSection], // Pass section-specific fixed instructions
        level, // Pass lesson level for complexity adjustment
        chapter, // Pass chapter for context
        lessonNumber, // Pass lesson number for context
        generationMode, // Pass generation mode to control behavior
        includeLessonIssue, // Pass lesson issue toggle
        lessonGoal, // Pass lesson goal for context-based generation
        learnType, // Pass Step A type only when in Learn section with Step A selected
        stepBType, // Pass Step B type only when in Learn section with Step B selected
        includeTranslation, // Pass translation toggle
        translationLanguage, // Pass selected translation language
        vocabularyCount, // Pass current vocabulary count from editor
        expressionCount, // Pass current expression count from editor
        applyType, // Pass apply activity type (speaking/listening/reading)
        dialogueLineCount, // Pass current dialogue line count from editor
        generateTrivia, // Pass trivia generation flag
        exerciseType, // Pass exercise type (rephrase/choose/change or conversation/multiple-choice/speech/compare)
        exerciseStepType, // Pass exercise step (stepA or stepB)
        exerciseItemCount, // Pass exercise item count
        missionType, // Pass mission type (speaking/discussion/reading/listening)
        missionQCount, // Pass mission question count
        isMission2, // Pass flag for mission 2
        storyData, // Pass story data for K-Drama style generation
        currentLearnData, // Pass Learn section data for cross-section cohesion
        // Pass Apply data to Mission for story continuity
        (activeSection === 'mission' || activeSection === 'mission2') && storyData?.enabled ? currentApplyData : undefined
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate content');
      }

      if (activeSection === 'exercise') {
        if ((response.data as any).exerciseData) {
        }
      }

      setGeneratedContent(response.data);
      setGeneratedSection(activeSection); // Track which section generated this content
      setShowPreview(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate content');
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsertContent = () => {
    if (generatedContent) {
      // Only insert if the generated content is from the current section to prevent mixing
      if (generatedSection !== activeSection) {
        setError(`This content was generated for the ${generatedSection} section, not the current ${activeSection} section. Cannot insert.`);
        return;
      }

      // If we're in the Learn section and have vocabulary data, build LearnSectionData
      if (activeSection === 'learn' && generatedContent.learnVocabulary && onGenerateLearn) {
        const vocab = (generatedContent.learnVocabulary || []).map((v: any) => ({
          image: '',
          englishText: v.word || '',
          highlightedWord: v.word || undefined,
          translation: v.translation || v.meaning || '', // Use AI-generated translation if available
        }));

        const learnPayload = {
          sectionTitle: 'LEARN',
          steps: [
            {
              stepType: 'vocabulary',
              stepName: 'STEP A VOCABULARY',
              duration: '2 minutes',
              partLabel: 'I. Listen and repeat.',
              partTranslation: undefined,
              vocabularyItems: vocab,
              tutorSteps: [
                { instruction: 'Introduce Learn.', script: "Now, let's try Learn. First we have Step A Vocabulary. Let's do Part I. Can you see the pictures and text?", tip: null },
                { instruction: 'Read the instructions.', script: null, tip: null },
                { instruction: "Read the first vocabulary and ask the student to repeat. Correct their pronunciation if necessary.", script: null, tip: null },
                { instruction: 'Repeat Step 3 with the remaining vocabulary.', script: null, tip: null },
                { instruction: 'Transition to the next part.', script: "Great! Let's go to the next part!", tip: null },
              ]
            },
          ],
        };

        onGenerateLearn(learnPayload);
      } 
      // If we have expressions data, build LearnSectionData with expressions
      else if (activeSection === 'learn' && generatedContent.learnExpressions && onGenerateLearn) {
        const expressions = (generatedContent.learnExpressions || []).map((e: any) => ({
          image: '',
          definitionLine: e.definitionLine || '',
          exampleSentence: e.exampleSentence || '',
          extraText: '',
          translation: e.translation || '', // Include AI-generated translation
        }));

        const learnPayload = {
          sectionTitle: 'LEARN',
          steps: [
            {
              stepType: 'expressions',
              stepName: 'STEP A EXPRESSIONS',
              duration: '4 minutes',
              partLabel: 'I. Go over the expressions with your tutor.',
              partTranslation: undefined,
              expressionItems: expressions,
              tutorSteps: [
                { instruction: 'Introduce Present.', script: "Now, let's try Present. First we have Step A Expressions. Let's do Part I. Can you see the pictures and text?", tip: null },
                { instruction: 'Read the instructions.', script: null, tip: null },
                { instruction: "Read the first expression's explanation.", script: null, tip: null },
                { instruction: 'Read the italicized example sentence and ask the student to repeat. Correct their pronunciation if necessary.', script: null, tip: null },
                { instruction: 'Repeat Steps 3-4 with the remaining expressions.', script: null, tip: null },
                { instruction: 'Transition to the next part.', script: "Great! Let's go to the next part!", tip: null },
              ]
            },
          ],
        };

        onGenerateLearn(learnPayload);
      }
      // If we have Step B data, build StepBData
      else if (activeSection === 'learn' && generatedContent.stepB && onGenerateStepB) {
        const stepBData = generatedContent.stepB;
        
        if (stepBData.stepType === 'speak-your-mind' && stepBData.speakYourMind) {
          const sym = stepBData.speakYourMind;
          onGenerateStepB({
            stepType: 'speak-your-mind',
            speakYourMind: {
              stepName: 'STEP B SPEAK YOUR MIND',
              duration: '3 minutes',
              explanation: sym.explanation || '',
              explanationTranslation: '',
              speaker1: { image: '', speechBubble: sym.speaker1SpeechBubble || '' },
              speaker2: { image: '', speechBubble: sym.speaker2SpeechBubble || '' },
              question: sym.question || '',
              tutorSteps: [
                { instruction: 'Introduce the grammar/expression concept.', script: null, tip: null },
                { instruction: 'Read the dialogue with the student.', script: null, tip: null },
                { instruction: 'Ask the student the follow-up question.', script: null, tip: null },
              ]
            }
          });
        } else if (stepBData.stepType === 'grammar-tip' && stepBData.grammarTip) {
          const gt = stepBData.grammarTip;
          onGenerateStepB({
            stepType: 'grammar-tip',
            grammarTip: {
              stepName: 'STEP B GRAMMAR TIP',
              duration: '3 minutes',
              explanations: gt.explanations || [],
              tutorSteps: [
                { instruction: 'Read each grammar rule.', script: null, tip: null },
                { instruction: 'Go through the examples with the student.', script: null, tip: null },
              ]
            }
          });
        } else if (stepBData.stepType === 'pronunciation' && stepBData.pronunciation) {
          const pron = stepBData.pronunciation;
          onGenerateStepB({
            stepType: 'pronunciation',
            pronunciation: {
              stepName: 'STEP B PRONUNCIATION',
              duration: '2 minutes',
              tip: pron.tip || '',
              phrases: pron.phrases || [],
              tutorSteps: [
                { instruction: 'Explain the pronunciation tip.', script: null, tip: null },
                { instruction: 'Practice each phrase with the student.', script: null, tip: null },
              ]
            }
          });
        }
      }
      // Handle Apply section content
      else if (activeSection === 'apply' && generatedContent.applyData && onGenerateApply) {
        const apply = generatedContent.applyData;
        
        // Build the Apply payload based on activity type
        const applyPayload = {
          sectionNumber: 3,
          sectionTitle: 'APPLY',
          activityType: apply.activityType || currentApplyType,
          activityTitle: (apply.activityType || currentApplyType).toUpperCase(),
          activityDuration: apply.activityDuration || '3 minutes',
          situationText: apply.situationText || '',
          situationTranslation: apply.situationTranslation || '',
          situationImage: '',
          dialogueLines: (apply.dialogueLines || []).map((line: any) => ({
            speaker: line.speaker || '',
            text: line.text || '',
            isAction: line.isAction || false,
          })),
          readingText: apply.readingText || '',
          readingImage: '',
          readingImageLabel: '',
          tutorSteps: (apply.tutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            tips: step.tips || [],
            questions: step.questions || [],
            ...(step.listeningScript ? { listeningScript: step.listeningScript } : {}),
          })),
          triviaEnabled: apply.triviaEnabled || false,
          triviaText: apply.triviaText || '',
          triviaTranslation: apply.triviaTranslation || '',
          triviaImage: '',
          triviaDuration: apply.triviaDuration || '1 minute',
          triviaTutorSteps: apply.triviaTutorSteps || [],
        };

        onGenerateApply(applyPayload);
      }
      // Handle Trivia section content (separate from Apply)
      else if (activeSection === 'trivia' && generatedContent.triviaData && onGenerateTrivia) {
        const trivia = generatedContent.triviaData;
        
        const triviaPayload = {
          triviaEnabled: true,
          triviaText: trivia.triviaText || '',
          triviaTranslation: trivia.triviaTranslation || '',
          triviaImage: '',
          triviaDuration: trivia.triviaDuration || '1 minute',
          triviaTutorSteps: (trivia.triviaTutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            questions: step.questions || [],
          })),
        };

        onGenerateTrivia(triviaPayload);
      }
      // Handle Exercise section content
      else if (activeSection === 'exercise' && generatedContent.exerciseData && onGenerateExercise) {
        const exercise = generatedContent.exerciseData;
        
        const exercisePayload = {
          exerciseStep: exercise.exerciseStep,
          exerciseType: exercise.exerciseType,
          // Step A common fields
          instructions: exercise.instructions || '',
          instructionsTranslation: exercise.instructionsTranslation || '',
          // Step A - Rephrase fields
          showExpressions: exercise.showExpressions || false,
          expressions: exercise.expressions || [],
          showExample: exercise.showExample || false,
          exampleSentence: exercise.exampleSentence || '',
          exampleAnswer: exercise.exampleAnswer || '',
          exerciseItems: (exercise.exerciseItems || []).map((item: any) => ({
            image: '',
            sentence: item.sentence || '',
          })),
          // Step A - Choose fields
          chooseItems: (exercise.chooseItems || []).map((item: any) => ({
            sentence: item.sentence || '',
          })),
          // Step A - Change fields
          changeItems: (exercise.changeItems || []).map((item: any) => ({
            sentence: item.sentence || '',
          })),
          // Answer key
          answers: (exercise.answers || []).map((answer: any) => ({
            text: answer.text || '',
          })),
          // Tutor steps
          tutorSteps: (exercise.tutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            tips: step.tips || [],
            // Use undefined (not []) when empty so "Add Answer Key" button shows in editor
            answerKey: step.answerKey?.length > 0 ? step.answerKey : undefined,
          })),
          // Step B common fields
          stepBInstruction: exercise.stepBInstruction || '',
          stepBInstructionTranslation: exercise.stepBInstructionTranslation || '',
          // Step B - Conversation fields
          conversations: (exercise.conversations || []).map((conv: any) => ({
            speakerImage: '',
            speechBubble: conv.speechBubble || '',
            position: conv.position || 'left',
          })),
          // Step B - Multiple Choice fields
          multipleChoiceItems: (exercise.multipleChoiceItems || []).map((item: any) => ({
            boldSentence: item.boldSentence || '',
            optionA: item.optionA || '',
            optionB: item.optionB || '',
          })),
          // Step B - Speech fields
          speechContent: exercise.speechContent || '',
          // Step B - Compare fields
          compareWordBox: exercise.compareWordBox || [],
          compareImages: (exercise.compareImages || []).map((img: any) => ({
            image: '',
            label: img.label || '',
          })),
          compareExample: exercise.compareExample || '',
          compareItems: (exercise.compareItems || []).map((item: any) => ({
            sentence: item.sentence || '',
          })),
          // Step B tutor steps
          stepBTutorSteps: (exercise.stepBTutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            tips: step.tips || [],
          })),
        };

        onGenerateExercise(exercisePayload);
      }
      // Handle Mission section content
      else if (activeSection === 'mission' && generatedContent.missionData && onGenerateMission) {
        const mission = generatedContent.missionData;

        // Build tutorSteps and inject questionsIntro as prompt (direction), questions as scripts (green), hints as prompts (black)
        const builtTutorSteps = (mission.tutorSteps || []).map((step: any) => ({
          instruction: step.instruction || '',
          scripts: step.scripts || [],
          prompts: step.prompts || [],
          tips: step.tips || [],
          ...(step.listeningScript ? { listeningScript: step.listeningScript } : {}),
        }));

        const qi = mission.questionsIntro || '';
        const rq = mission.questions || [];
        if ((qi || rq.length > 0) && builtTutorSteps.length > 0) {
          const last = builtTutorSteps[builtTutorSteps.length - 1];
          const extraScripts: { text: string }[] = [];
          const extraPrompts: { text: string }[] = [];
          if (qi) extraPrompts.push({ text: qi });
          for (const q of rq) {
            if (q.question) extraScripts.push({ text: q.question });
            for (const h of (q.hints || [])) {
              if (h) extraPrompts.push({ text: h });
            }
          }
          last.scripts = [...(last.scripts || []), ...extraScripts];
          last.prompts = [...(last.prompts || []), ...extraPrompts];
        }

        // Insert into missionData (Challenge 1)
        onGenerateMission({
          ...mission,
          tutorSteps: builtTutorSteps,
          questionsIntro: mission.questionsIntro || '',
          questions: (mission.questions || []).map((q: any) => ({
            question: q.question || '',
            hints: q.hints || [],
          })),
          isOptional: mission.isOptional || false,
          topics: (mission.topics || []).map((topic: any) => ({
            title: topic.title || '',
            questions: topic.questions || [],
          })),
          readingPassage: mission.readingPassage ? {
            title: mission.readingPassage.title || '',
            author: mission.readingPassage.author || '',
            blocks: (mission.readingPassage.blocks || []).map((block: any) => ({
              type: block.type || 'paragraph',
              content: (block.text || block.content || ''),
              images: block.images || [],
            })),
            closingQuestion: mission.readingPassage.closingQuestion || '',
          } : undefined,
          ...(mission.listeningScript ? { listeningScript: mission.listeningScript } : {}),
        });
        
        // Auto-update story episode summary if story mode is enabled
        // Only for Mission 1 if there's no Mission 2, otherwise do it after Mission 2
        if (storyData?.enabled && onUpdateStory && !sectionStatus?.mission2) {
          // Generate episode summary in the background
          generateEpisodeSummary(
            {
              storyTitle: storyData.storyTitle || '',
              characters: storyData.characters.map(c => ({
                name: c.name,
                role: c.role,
                description: c.description,
              })),
              setting: storyData.setting || '',
              previousSummary: storyData.previousSummary || '',
              currentPlotPoints: storyData.currentPlotPoints || [],
            },
            {
              situation: mission.situation,
              instruction: mission.instruction,
              questions: mission.questions,
              topics: mission.topics,
            },
            topic
          ).then((result) => {
            if (result.success && result.data) {
              onUpdateStory({
                ...storyData,
                previousSummary: storyData.currentEpisodeSummary || storyData.previousSummary,
                currentEpisodeSummary: result.data.currentEpisodeSummary,
                nextEpisodeHook: result.data.nextEpisodeHook,
              });
            }
          }).catch(console.error);
        }
      }
      // Handle Mission 2 section content
      else if (activeSection === 'mission2' && generatedContent.missionData && onGenerateMission2) {
        const mission = generatedContent.missionData;

        // Build tutorSteps and inject questionsIntro as prompt (direction), questions as scripts (green), hints as prompts (black)
        const builtTutorSteps2 = (mission.tutorSteps || []).map((step: any) => ({
          instruction: step.instruction || '',
          scripts: step.scripts || [],
          prompts: step.prompts || [],
          tips: step.tips || [],
          ...(step.listeningScript ? { listeningScript: step.listeningScript } : {}),
        }));

        const qi2 = mission.questionsIntro || '';
        const rq2 = mission.questions || [];
        if ((qi2 || rq2.length > 0) && builtTutorSteps2.length > 0) {
          const last2 = builtTutorSteps2[builtTutorSteps2.length - 1];
          const extraScripts2: { text: string }[] = [];
          const extraPrompts2: { text: string }[] = [];
          if (qi2) extraPrompts2.push({ text: qi2 });
          for (const q of rq2) {
            if (q.question) extraScripts2.push({ text: q.question });
            for (const h of (q.hints || [])) {
              if (h) extraPrompts2.push({ text: h });
            }
          }
          last2.scripts = [...(last2.scripts || []), ...extraScripts2];
          last2.prompts = [...(last2.prompts || []), ...extraPrompts2];
        }
        
        const mission2Payload = {
          missionType: mission.missionType,
          sectionNumber: 5,
          sectionTitle: 'MISSION',
          challengeNumber: 2,
          challengeName: mission.challengeName || 'Challenge 2',
          duration: mission.duration || '5-6 minutes',
          situation: mission.situation || '',
          situationTranslation: mission.situationTranslation || '',
          instruction: mission.instruction || '',
          instructionTranslation: mission.instructionTranslation || '',
          showGrammarTip: mission.showGrammarTip || false,
          grammarTipTitle: mission.grammarTipTitle || "Today's grammar tip",
          grammarTipItems: mission.grammarTipItems || [],
          image: '',
          tutorSteps: builtTutorSteps2,
          questionsIntro: mission.questionsIntro || '',
          questions: (mission.questions || []).map((q: any) => ({
            question: q.question || '',
            hints: q.hints || [],
          })),
          // Discussion type specific
          isOptional: mission.isOptional || false,
          topics: (mission.topics || []).map((topic: any) => ({
            title: topic.title || '',
            questions: topic.questions || [],
          })),
          // Reading type specific
          readingPassage: mission.readingPassage ? {
            title: mission.readingPassage.title || '',
            author: mission.readingPassage.author || '',
            blocks: (mission.readingPassage.blocks || []).map((block: any) => ({
              type: block.type || 'paragraph',
              content: (block.text || block.content || ''),
              images: block.images || [],
            })),
            closingQuestion: mission.readingPassage.closingQuestion || '',
          } : undefined,
          // Listening type specific
          ...(mission.listeningScript ? { listeningScript: mission.listeningScript } : {}),
        };

        onGenerateMission2(mission2Payload);
        
        // Auto-update story episode summary after Mission 2 (final mission in lesson)
        if (storyData?.enabled && onUpdateStory) {
          // Generate episode summary in the background
          generateEpisodeSummary(
            {
              storyTitle: storyData.storyTitle || '',
              characters: storyData.characters.map(c => ({
                name: c.name,
                role: c.role,
                description: c.description,
              })),
              setting: storyData.setting || '',
              previousSummary: storyData.previousSummary || '',
              currentPlotPoints: storyData.currentPlotPoints || [],
            },
            {
              situation: mission2Payload.situation,
              instruction: mission2Payload.instruction,
              questions: mission2Payload.questions,
              topics: mission2Payload.topics,
            },
            topic
          ).then((result) => {
            if (result.success && result.data) {
              onUpdateStory({
                ...storyData,
                // Move current episode summary to previous (for next lesson's context)
                previousSummary: storyData.currentEpisodeSummary || storyData.previousSummary,
                currentEpisodeSummary: result.data.currentEpisodeSummary,
                nextEpisodeHook: result.data.nextEpisodeHook,
              });
            }
          }).catch(console.error);
        }
      } else {
        onGenerateIntroduction(generatedContent);
      }
      setShowPreview(false);
      setGeneratedContent(null);
      setGeneratedSection(null);
    }
  };

  const handleDismiss = () => {
    setShowPreview(false);
    setGeneratedContent(null);
    setGeneratedSection(null);
  };

  // Batch generation - generate all empty sections
  const handleBatchGenerate = async () => {
    const sectionsToGenerate = SECTIONS.filter(s => !sectionStatus[s.id]);
    if (sectionsToGenerate.length === 0) {
      setError('All sections already have content!');
      return;
    }

    setIsBatchGenerating(true);
    setBatchProgress({ current: 0, total: sectionsToGenerate.length, section: '' });
    setError('');

    for (let i = 0; i < sectionsToGenerate.length; i++) {
      const section = sectionsToGenerate[i];
      setBatchProgress({ current: i + 1, total: sectionsToGenerate.length, section: section.label });
      setActiveSection(section.id);

      try {
        // Generate content for this section
        await handleGenerateIntroduction();
        // Wait a bit for the content to be processed
        await new Promise(resolve => setTimeout(resolve, 500));
        // Auto-insert if we have generated content
        if (generatedContent) {
          handleInsertContent();
        }
      } catch (err) {
        console.error(`Failed to generate ${section.label}:`, err);
        // Continue with next section even if one fails
      }
    }

    setIsBatchGenerating(false);
    setBatchProgress({ current: 0, total: 0, section: '' });
  };

  return (
    <>
      {/* Floating Toggle Button (when panel is closed) */}
      {!isOpen && (
        <button
          className="ai-fab-toggle"
          onClick={() => setIsOpen(true)}
          title="Open AI Assistant"
        >
          <i className="ri-magic-line" />
        </button>
      )}

      {/* Main Widget Panel */}
      <div className={`ai-content-generator ${isOpen ? 'ai-open' : 'ai-closed'}`}>
        <div className="ai-generator-header">
          <h3>
            <i className="ri-lightbulb-flash-line" />
            AI Assistant
          </h3>
          <p className="ai-generator-subtitle">Section {currentSectionConfig.number}: {currentSectionConfig.label}</p>
          <button
            className="ai-close-toggle-btn"
            onClick={() => setIsOpen(false)}
            title="Close AI Assistant"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="ai-tabs-container">
          <div className="ai-tabs">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                className={`ai-tab ${activeSection === section.id ? 'ai-tab-active' : ''} ${sectionStatus[section.id] ? 'ai-tab-has-content' : ''}`}
                onClick={() => setActiveSection(section.id)}
                title={`${section.description}${sectionStatus[section.id] ? ' ✓ Has content' : ''}`}
              >
                <span className="ai-tab-number">{section.number}</span>
                <span className="ai-tab-label">{section.label}</span>
                {sectionStatus[section.id] && <span className="ai-tab-status-badge">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Story Mode Indicator - Show when story mode is enabled */}
        {storyData?.enabled && (
          <div className="ai-story-mode-bar">
            <div className="ai-story-mode-info">
              <i className="ri-movie-2-line" />
              <span className="ai-story-mode-label">Story Mode</span>
              <span className="ai-story-mode-title">{storyData.storyTitle || 'Untitled Episode'}</span>
            </div>
            <button 
              className={`ai-story-panel-btn ${showStoryPanel ? 'active' : ''}`}
              onClick={() => setShowStoryPanel(!showStoryPanel)}
            >
              <i className={showStoryPanel ? 'ri-arrow-up-s-line' : 'ri-chat-3-line'} />
              {showStoryPanel ? 'Hide' : 'Refine Story'}
            </button>
          </div>
        )}

        {/* Story Refinement Panel - Collapsible chat interface */}
        {storyData?.enabled && showStoryPanel && (
          <div className="ai-story-refine-panel">
            <div className="ai-story-refine-header">
              <i className="ri-quill-pen-line" />
              <span>Refine Your Story</span>
            </div>
            <div className="ai-story-refine-context">
              <p><strong>Characters:</strong> {storyData.characters.map(c => c.name).join(', ') || 'None defined'}</p>
              <p><strong>Setting:</strong> {storyData.setting || 'Not set'}</p>
              <p><strong>Plot Points:</strong> {storyData.currentPlotPoints.length || 0} defined</p>
            </div>
            <div className="ai-story-refine-input">
              <textarea
                value={storyRefinePrompt}
                onChange={(e) => setStoryRefinePrompt((e.target as HTMLTextAreaElement).value)}
                placeholder="Tell me how to improve the story...&#10;&#10;Examples:&#10;• Make the dialogue more dramatic&#10;• Add more conflict between characters&#10;• Change the setting to a hospital&#10;• Make Ji-hoon more mysterious"
                rows={4}
              />
              <button
                className="ai-story-refine-btn"
                disabled={isRefiningStory || !storyRefinePrompt.trim()}
                onClick={() => {
                  // This will be sent to the AI along with story context
                  // when generating Apply, Exercise, or Mission sections
                  setIsRefiningStory(true);
                  // For now, store the refinement notes in storyNotes
                  if (onUpdateStory && storyData) {
                    const updatedNotes = storyData.storyNotes 
                      ? `${storyData.storyNotes}\n\n[Refinement ${new Date().toLocaleTimeString()}]: ${storyRefinePrompt.trim()}`
                      : `[Refinement ${new Date().toLocaleTimeString()}]: ${storyRefinePrompt.trim()}`;
                    onUpdateStory({ ...storyData, storyNotes: updatedNotes });
                  }
                  setTimeout(() => {
                    setIsRefiningStory(false);
                    setStoryRefinePrompt('');
                  }, 500);
                }}
              >
                {isRefiningStory ? (
                  <>
                    <i className="ri-loader-4-line ai-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="ri-add-line" />
                    Add Refinement
                  </>
                )}
              </button>
            </div>
            {storyData.storyNotes && (
              <div className="ai-story-notes-list">
                <div className="ai-story-notes-header">
                  <i className="ri-file-list-3-line" />
                  <span>Story Notes</span>
                  <button 
                    className="ai-clear-notes-btn"
                    onClick={() => onUpdateStory?.({ ...storyData, storyNotes: '' })}
                    title="Clear all notes"
                  >
                    <i className="ri-delete-bin-line" />
                  </button>
                </div>
                <pre className="ai-story-notes-content">{storyData.storyNotes}</pre>
              </div>
            )}
            
            {/* Episode Summary Section - Shows after Mission content is generated */}
            {(storyData.currentEpisodeSummary || storyData.nextEpisodeHook) && (
              <div className="ai-story-episode-summary">
                <div className="ai-story-summary-header">
                  <i className="ri-movie-line" />
                  <span>Episode Summary</span>
                </div>
                {storyData.currentEpisodeSummary && (
                  <div className="ai-episode-current">
                    <strong>This Episode:</strong>
                    <p>{storyData.currentEpisodeSummary}</p>
                  </div>
                )}
                {storyData.nextEpisodeHook && (
                  <div className="ai-episode-hook">
                    <strong>Next Episode Preview:</strong>
                    <p><em>{storyData.nextEpisodeHook}</em></p>
                  </div>
                )}
              </div>
            )}
            
            <p className="ai-story-refine-hint">
              💡 These refinements will be used when generating Apply, Exercise, and Mission sections.
            </p>
          </div>
        )}

        {/* Learn Section Step Selector - Show only when Learn tab is active */}
        {activeSection === 'learn' && (
          <div className="ai-learn-step-selector">
            <div className="ai-step-toggle">
              <button
                className={`ai-step-btn ${learnStep === 'stepA' ? 'ai-step-active' : ''}`}
                onClick={() => setLearnStep('stepA')}
              >
                <span className="ai-step-letter">A</span>
                <span className="ai-step-type">
                  {currentStepAType === 'vocabulary' ? 'Vocabulary' : 'Expressions'}
                </span>
              </button>
              <button
                className={`ai-step-btn ${learnStep === 'stepB' ? 'ai-step-active' : ''}`}
                onClick={() => setLearnStep('stepB')}
              >
                <span className="ai-step-letter">B</span>
                <span className="ai-step-type">
                  {currentStepBType === 'speak-your-mind' ? 'Speak Your Mind' :
                   currentStepBType === 'grammar-tip' ? 'Grammar Tip' : 'Pronunciation'}
                </span>
              </button>
            </div>
            <p className="ai-step-hint">
              {learnStep === 'stepA' 
                ? `Will generate ${currentStepAType} content for Step A`
                : `Will generate ${currentStepBType.replace(/-/g, ' ')} content for Step B`
              }
            </p>
          </div>
        )}

        {/* Apply Section Type Indicator - Show only when Apply tab is active */}
        {activeSection === 'apply' && (
          <div className="ai-apply-indicator">
            <div className="ai-apply-type">
              <i className={`${
                currentApplyType === 'speaking' ? 'ri-mic-line' :
                currentApplyType === 'listening' ? 'ri-headphone-line' : 'ri-book-open-line'
              }`} />
              <span className="ai-apply-type-label">
                {currentApplyType.charAt(0).toUpperCase() + currentApplyType.slice(1)} Activity
              </span>
            </div>
            <p className="ai-step-hint">
              Will generate {currentApplyType} content with {dialogueLineCount || 'default'} dialogue lines
            </p>
          </div>
        )}

        {/* Trivia Section Indicator - Show only when Trivia tab is active */}
        {activeSection === 'trivia' && (
          <div className="ai-apply-indicator ai-trivia-indicator">
            <div className="ai-apply-type">
              <i className="ri-lightbulb-flash-line" />
              <span className="ai-apply-type-label">Trivia Time</span>
            </div>
            <p className="ai-step-hint">
              Will generate cultural trivia, fun facts, and discussion questions
            </p>
          </div>
        )}

        {/* Exercise Section Step Selector - Show only when Exercise tab is active */}
        {activeSection === 'exercise' && (
          <div className="ai-learn-step-selector ai-exercise-selector">
            <div className="ai-step-toggle">
              <button
                className={`ai-step-btn ${exerciseStep === 'stepA' ? 'ai-step-active' : ''}`}
                onClick={() => setExerciseStep('stepA')}
              >
                <span className="ai-step-letter">A</span>
                <span className="ai-step-type">
                  {currentExerciseStepAType === 'rephrase' ? 'Rephrase' :
                   currentExerciseStepAType === 'choose' ? 'Choose' : 'Change'}
                </span>
              </button>
              <button
                className={`ai-step-btn ${exerciseStep === 'stepB' ? 'ai-step-active' : ''}`}
                onClick={() => setExerciseStep('stepB')}
                disabled={!hasExerciseStepB}
                title={!hasExerciseStepB ? 'Step B is not enabled in the editor' : ''}
              >
                <span className="ai-step-letter">B</span>
                <span className="ai-step-type">
                  {currentExerciseStepBType === 'conversation' ? 'Conversation' :
                   currentExerciseStepBType === 'multiple-choice' ? 'Multiple Choice' :
                   currentExerciseStepBType === 'speech' ? 'Speech' : 'Compare'}
                </span>
              </button>
            </div>
            <p className="ai-step-hint">
              {exerciseStep === 'stepA' 
                ? `Will generate ${currentExerciseStepAType} exercise with ${exerciseItemCount || 'default'} items`
                : `Will generate ${currentExerciseStepBType.replace(/-/g, ' ')} exercise for Step B`
              }
            </p>
          </div>
        )}

        {/* Mission Section Type Indicator - Show only when Mission tab is active */}
        {activeSection === 'mission' && (
          <div className="ai-apply-indicator ai-mission-indicator">
            <div className="ai-apply-type">
              <i className={`${
                currentMissionType === 'speaking' ? 'ri-mic-line' :
                currentMissionType === 'discussion' ? 'ri-discuss-line' :
                currentMissionType === 'reading' ? 'ri-book-open-line' : 'ri-headphone-line'
              }`} />
              <span className="ai-apply-type-label">
                {currentMissionType.charAt(0).toUpperCase() + currentMissionType.slice(1)} Challenge 1
              </span>
            </div>
            <p className="ai-step-hint">
              Will generate {currentMissionType} mission with {missionQuestionCount || 'default'} roleplay questions
            </p>
          </div>
        )}

        {/* Mission 2 Section Type Indicator - Show only when Mission 2 tab is active */}
        {activeSection === 'mission2' && (
          <div className="ai-apply-indicator ai-mission-indicator">
            <div className="ai-apply-type">
              <i className={`${
                currentMission2Type === 'speaking' ? 'ri-mic-line' :
                currentMission2Type === 'discussion' ? 'ri-discuss-line' :
                currentMission2Type === 'reading' ? 'ri-book-open-line' : 'ri-headphone-line'
              }`} />
              <span className="ai-apply-type-label">
                {currentMission2Type.charAt(0).toUpperCase() + currentMission2Type.slice(1)} Challenge 2
              </span>
            </div>
            <p className="ai-step-hint">
              Will generate {currentMission2Type} mission with {mission2QuestionCount || 'default'} questions
            </p>
          </div>
        )}

        <div className="ai-generator-content">
          {/* Compact Fixed Instructions */}
          <div className="ai-base-instructions-section-compact">
            <label className="ai-instructions-label">
              <i className="ri-lightbulb-line" />
              Base Instructions
            </label>
            <textarea
              className="ai-instructions-input"
              value={baseInstructions[activeSection]}
              onChange={(e) => setBaseInstructions({ ...baseInstructions, [activeSection]: (e.target as HTMLTextAreaElement).value })}
              rows={4}
              placeholder="Core guidelines for content generation"
            />
          </div>

          {/* Compact Custom Prompt */}
          <div className="ai-prompt-section-compact">
            <label className="ai-prompt-label">Additional Notes</label>
            <textarea
              className="ai-prompt-input-compact"
              placeholder="Optional specific requirements..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt((e.target as HTMLTextAreaElement).value)}
              rows={4}
            />
          </div>

          {/* Generation Mode Toggle */}
          <div className="ai-mode-selector">
            <label className="ai-mode-label">Generation Mode</label>
            <div className="ai-mode-buttons">
              <button
                className={`ai-mode-btn ${generationMode === 'new' ? 'ai-mode-active' : ''}`}
                onClick={() => setGenerationMode('new')}
              >
                <i className="ri-refresh-line" />
                Generate New
              </button>
              <button
                className={`ai-mode-btn ${generationMode === 'improve' ? 'ai-mode-active' : ''}`}
                onClick={() => setGenerationMode('improve')}
                disabled={!currentIntroductionData}
              >
                <i className="ri-edit-line" />
                Improve Existing
              </button>
            </div>
          </div>

          {/* Lesson Issue Toggle (only in "Generate New" mode and Introduce section) */}
          {generationMode === 'new' && activeSection === 'introduce' && (
            <div className="ai-lesson-issue-toggle">
              <label className="ai-toggle-label">
                <input
                  type="checkbox"
                  checked={includeLessonIssue}
                  onChange={(e) => setIncludeLessonIssue((e.target as HTMLInputElement).checked)}
                  className="ai-toggle-checkbox"
                />
                <span className="ai-toggle-text">
                  <i className="ri-lightbulb-line" />
                  Include Lesson Issue
                </span>
              </label>
            </div>
          )}

          {/* Translation Toggle (available for all sections) */}
          <div className="ai-lesson-issue-toggle">
            <label className="ai-toggle-label">
              <input
                type="checkbox"
                checked={includeTranslation}
                onChange={(e) => setIncludeTranslation((e.target as HTMLInputElement).checked)}
                className="ai-toggle-checkbox"
              />
              <span className="ai-toggle-text">
                <i className="ri-translate-2" />
                Include Translations
              </span>
            </label>
            {includeTranslation && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'japanese', label: '日本語', flag: '🇯🇵' },
                  { id: 'korean', label: '한국어', flag: '🇰🇷' },
                  { id: 'vietnamese', label: 'Tiếng Việt', flag: '🇻🇳' },
                  { id: 'chinese', label: '中文', flag: '🇨🇳' },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setTranslationLanguage(lang.id as any)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '11px',
                      border: translationLanguage === lang.id ? '1px solid var(--matrix-green)' : '1px solid rgba(0, 255, 65, 0.25)',
                      borderRadius: '4px',
                      background: translationLanguage === lang.id ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
                      color: translationLanguage === lang.id ? 'var(--matrix-green)' : 'var(--matrix-text-dim)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontFamily: 'inherit',
                      boxShadow: translationLanguage === lang.id ? '0 0 10px var(--matrix-green-glow)' : 'none',
                    }}
                  >
                    {lang.flag} {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Story Mode generation order warning */}
          {storyData?.enabled && (activeSection === 'mission' || activeSection === 'mission2') && !sectionStatus.apply && (
            <div style={{
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: '#eab308',
            }}>
              <i className="ri-lock-line" style={{ fontSize: '16px' }} />
              <span>
                <strong>Story Mode:</strong> Generate the <strong>Apply</strong> section first so the Mission can continue the story coherently.
              </span>
            </div>
          )}

          {/* Generation Buttons */}
          <div className="ai-generate-buttons">
            <button
              className="ai-generate-btn"
              onClick={handleGenerateIntroduction}
              disabled={isGenerating || isBatchGenerating || !topic || !skillLevel || (storyData?.enabled && (activeSection === 'mission' || activeSection === 'mission2') && !sectionStatus.apply)}
            >
              <i className={`${isGenerating ? 'ri-loader-4-line ai-spin' : 'ri-magic-line'}`} />
              <span>{isGenerating ? 'Generating...' : `Generate ${currentSectionConfig.label}`}</span>
            </button>

            <button
              className="ai-batch-btn"
              onClick={handleBatchGenerate}
              disabled={isGenerating || isBatchGenerating || !topic || !skillLevel}
              title="Generate content for all empty sections"
            >
              <i className={`${isBatchGenerating ? 'ri-loader-4-line ai-spin' : 'ri-stack-line'}`} />
              <span>{isBatchGenerating ? `${batchProgress.current}/${batchProgress.total}` : 'Generate All'}</span>
            </button>
          </div>

          {/* Batch Progress Indicator */}
          {isBatchGenerating && (
            <div className="ai-batch-progress">
              <div className="ai-batch-progress-bar">
                <div 
                  className="ai-batch-progress-fill" 
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
              <span className="ai-batch-progress-text">
                Generating {batchProgress.section}... ({batchProgress.current}/{batchProgress.total})
              </span>
            </div>
          )}

          {error && <div className="ai-error-message">{error}</div>}
        </div>

      {showPreview && generatedContent && (
        <div className="ai-preview-modal">
          <div className="ai-preview-overlay" onClick={handleDismiss} />
          <div className="ai-preview-content">
            <div className="ai-preview-header">
              <h4>Preview Generated Content</h4>
              <button className="ai-close-btn" onClick={handleDismiss}>
                <i className="ri-close-line" />
              </button>
            </div>

            {/* Content Metrics Bar */}
            {(() => {
              const metrics = calculateContentMetrics(generatedContent);
              return (
                <div className="ai-content-metrics">
                  <div className="ai-metric">
                    <i className="ri-text" />
                    <span>{metrics.wordCount} words</span>
                  </div>
                  <div className="ai-metric">
                    <i className="ri-timer-line" />
                    <span>{metrics.readingTime}</span>
                  </div>
                  <div className={`ai-metric ai-complexity-${metrics.complexity.toLowerCase()}`}>
                    <i className="ri-bar-chart-line" />
                    <span>{metrics.complexity}</span>
                  </div>
                </div>
              );
            })()}

            <div className="ai-preview-body">
              {/* Learn -> Vocabulary Preview */}
              {generatedContent.learnVocabulary && generatedContent.learnVocabulary.length > 0 ? (
                <div className="ai-preview-section">
                  <h5>Vocabulary (Learn - Step A)</h5>
                  <div className="ai-preview-item">
                    <ul>
                      {generatedContent.learnVocabulary.map((v: any, idx: number) => (
                        <li key={idx}>
                          <strong>{v.word}</strong>
                          {v.partOfSpeech ? ` (${v.partOfSpeech})` : ''} — {v.meaning}
                          {v.translation && <span style={{ color: '#a0a0a0', marginLeft: '8px' }}>({v.translation})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : generatedContent.learnExpressions && generatedContent.learnExpressions.length > 0 ? (
                <div className="ai-preview-section">
                  <h5>Expressions (Learn - Step A)</h5>
                  <div className="ai-preview-item">
                    {generatedContent.learnExpressions.map((e: any, idx: number) => (
                      <div key={idx} className="ai-expression-item" style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <strong style={{ color: '#4faafe', fontSize: '15px' }}>{e.expression}</strong>
                        {e.translation && <span style={{ color: '#a0a0a0', marginLeft: '8px', fontSize: '13px' }}>({e.translation})</span>}
                        <p style={{ color: '#e0e0e0', marginTop: '6px' }} dangerouslySetInnerHTML={{ __html: e.definitionLine }} />
                        <p style={{ fontStyle: 'italic', color: '#a0c4e8', marginTop: '4px' }} dangerouslySetInnerHTML={{ __html: e.exampleSentence }} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : generatedContent.stepB ? (
                <div className="ai-preview-section">
                  <h5>
                    {generatedContent.stepB.stepType === 'speak-your-mind' ? 'Speak Your Mind' :
                     generatedContent.stepB.stepType === 'grammar-tip' ? 'Grammar Tip' : 'Pronunciation'} 
                    (Learn - Step B)
                  </h5>
                  <div className="ai-preview-item">
                    {generatedContent.stepB.stepType === 'speak-your-mind' && generatedContent.stepB.speakYourMind && (
                      <>
                        <p><strong style={{ color: '#4faafe' }}>Explanation:</strong></p>
                        <p style={{ color: '#e0e0e0' }} dangerouslySetInnerHTML={{ __html: generatedContent.stepB.speakYourMind.explanation }} />
                        <div style={{ display: 'flex', gap: '20px', margin: '10px 0' }}>
                          <div style={{ flex: 1, background: 'rgba(79, 170, 254, 0.15)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(79, 170, 254, 0.3)' }}>
                            <strong style={{ color: '#4faafe' }}>Speaker 1:</strong>
                            <p style={{ color: '#e0e0e0' }} dangerouslySetInnerHTML={{ __html: generatedContent.stepB.speakYourMind.speaker1SpeechBubble }} />
                          </div>
                          <div style={{ flex: 1, background: 'rgba(100, 200, 150, 0.15)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(100, 200, 150, 0.3)' }}>
                            <strong style={{ color: '#64c896' }}>Speaker 2:</strong>
                            <p style={{ color: '#e0e0e0' }} dangerouslySetInnerHTML={{ __html: generatedContent.stepB.speakYourMind.speaker2SpeechBubble }} />
                          </div>
                        </div>
                        <p><strong style={{ color: '#4faafe' }}>Question:</strong> <span style={{ color: '#e0e0e0' }}>{generatedContent.stepB.speakYourMind.question}</span></p>
                      </>
                    )}
                    {generatedContent.stepB.stepType === 'grammar-tip' && generatedContent.stepB.grammarTip && (
                      <>
                        {generatedContent.stepB.grammarTip.explanations?.map((exp: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: '15px' }}>
                            <p style={{ color: '#e0e0e0' }} dangerouslySetInnerHTML={{ __html: exp.ruleText }} />
                            {exp.ruleTranslation && <p style={{ color: '#a0a0a0' }}>{exp.ruleTranslation}</p>}
                            {exp.examples?.map((ex: any, exIdx: number) => (
                              <div key={exIdx} style={{ marginLeft: '10px', borderLeft: '2px solid rgba(79, 170, 254, 0.5)', paddingLeft: '10px', marginTop: '8px' }}>
                                <p style={{ color: '#e0e0e0' }} dangerouslySetInnerHTML={{ __html: ex.sentence }} />
                                <p style={{ color: '#a0a0a0', fontSize: '0.9em' }}>{ex.translation}</p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </>
                    )}
                    {generatedContent.stepB.stepType === 'pronunciation' && generatedContent.stepB.pronunciation && (
                      <>
                        <p><strong style={{ color: '#4faafe' }}>Tip:</strong> <span style={{ color: '#e0e0e0' }}>{generatedContent.stepB.pronunciation.tip}</span></p>
                        {generatedContent.stepB.pronunciation.phrases?.map((p: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: '10px', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <strong style={{ color: '#4faafe' }}>{p.phrase}</strong>
                            <span style={{ marginLeft: '10px', color: '#a0c4e8' }}>{p.pronunciationGuide}</span>
                            <p style={{ color: '#e0e0e0', marginTop: '4px' }} dangerouslySetInnerHTML={{ __html: p.exampleSentence }} />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              ) : generatedContent.applyData ? (
                <div className="ai-preview-section">
                  <h5>
                    <i className={`${
                      generatedContent.applyData.activityType === 'speaking' ? 'ri-mic-line' :
                      generatedContent.applyData.activityType === 'listening' ? 'ri-headphone-line' : 'ri-book-open-line'
                    }`} style={{ marginRight: '8px', color: '#4faafe' }} />
                    Apply - {generatedContent.applyData.activityType?.charAt(0).toUpperCase() + generatedContent.applyData.activityType?.slice(1)} Activity
                  </h5>
                  <div className="ai-preview-item">
                    {/* Situation */}
                    {generatedContent.applyData.situationText && (
                      <div style={{ marginBottom: '14px', padding: '12px', background: 'rgba(79, 170, 254, 0.1)', borderRadius: '8px', border: '1px solid rgba(79, 170, 254, 0.2)' }}>
                        <strong style={{ color: '#4faafe', display: 'block', marginBottom: '6px' }}>Situation:</strong>
                        <p style={{ color: '#e0e0e0' }} dangerouslySetInnerHTML={{ __html: generatedContent.applyData.situationText }} />
                        {generatedContent.applyData.situationTranslation && (
                          <p style={{ color: '#a0a0a0', fontSize: '13px', marginTop: '6px' }}>{generatedContent.applyData.situationTranslation}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Dialogue Lines (for speaking) */}
                    {generatedContent.applyData.dialogueLines?.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <strong style={{ color: '#64c896', display: 'block', marginBottom: '8px' }}>Dialogue ({generatedContent.applyData.dialogueLines.length} lines):</strong>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
                          {generatedContent.applyData.dialogueLines.slice(0, 6).map((line: any, idx: number) => (
                            <div key={idx} style={{
                              marginBottom: '8px',
                              padding: '8px 12px',
                              background: line.isAction ? 'transparent' : idx % 2 === 0 ? 'rgba(79, 170, 254, 0.1)' : 'rgba(100, 200, 150, 0.1)',
                              borderRadius: '6px',
                              borderLeft: line.isAction ? 'none' : idx % 2 === 0 ? '3px solid rgba(79, 170, 254, 0.5)' : '3px solid rgba(100, 200, 150, 0.5)'
                            }}>
                              {line.isAction ? (
                                <p style={{ color: '#a0a0a0', fontStyle: 'italic', textAlign: 'center' }}>{line.text}</p>
                              ) : (
                                <>
                                  <strong style={{ color: idx % 2 === 0 ? '#4faafe' : '#64c896' }}>{line.speaker}:</strong>
                                  <span style={{ color: '#e0e0e0', marginLeft: '8px' }} dangerouslySetInnerHTML={{ __html: line.text }} />
                                </>
                              )}
                            </div>
                          ))}
                          {generatedContent.applyData.dialogueLines.length > 6 && (
                            <p style={{ color: '#a0a0a0', fontStyle: 'italic', textAlign: 'center' }}>...and {generatedContent.applyData.dialogueLines.length - 6} more lines</p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Reading Text */}
                    {generatedContent.applyData.readingText && (
                      <div style={{ marginBottom: '14px' }}>
                        <strong style={{ color: '#64c896', display: 'block', marginBottom: '8px' }}>Reading Passage:</strong>
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                          <p style={{ color: '#c0c0c0', fontSize: '13px', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: generatedContent.applyData.readingText.slice(0, 300) + '...' }} />
                        </div>
                      </div>
                    )}
                    
                    {/* Duration */}
                    <p style={{ color: '#a0a0a0', fontSize: '12px' }}>
                      <i className="ri-time-line" style={{ marginRight: '4px' }} />
                      {generatedContent.applyData.activityDuration || '3 minutes'}
                    </p>
                    
                    {/* Tutor Steps Count */}
                    {generatedContent.applyData.tutorSteps?.length > 0 && (
                      <p style={{ color: '#a0a0a0', fontSize: '12px', marginTop: '6px' }}>
                        <i className="ri-user-line" style={{ marginRight: '4px' }} />
                        {generatedContent.applyData.tutorSteps.length} tutor steps included
                      </p>
                    )}
                  </div>
                </div>
              ) : generatedContent.triviaData ? (
                <div className="ai-preview-section">
                  <h5>
                    <i className="ri-lightbulb-flash-line" style={{ marginRight: '8px', color: '#ffd700' }} />
                    Trivia Time
                  </h5>
                  <div className="ai-preview-item">
                    <div style={{ background: 'rgba(255, 215, 0, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 215, 0, 0.3)', marginBottom: '16px' }}>
                      <p style={{ color: '#e0e0e0', fontSize: '15px', lineHeight: '1.6' }}>{generatedContent.triviaData.triviaText}</p>
                      {generatedContent.triviaData.triviaTranslation && (
                        <p style={{ color: '#a0a0a0', marginTop: '10px', fontStyle: 'italic' }}>{generatedContent.triviaData.triviaTranslation}</p>
                      )}
                    </div>
                    <p style={{ color: '#a0a0a0', fontSize: '13px' }}>
                      <i className="ri-time-line" style={{ marginRight: '6px' }} />
                      Duration: {generatedContent.triviaData.triviaDuration || '1 minute'}
                    </p>
                    {generatedContent.triviaData.triviaTutorSteps?.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <strong style={{ color: '#4faafe', fontSize: '14px' }}>Tutor Steps:</strong>
                        {generatedContent.triviaData.triviaTutorSteps.map((step: any, idx: number) => (
                          <div key={idx} style={{ marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <p style={{ color: '#e0e0e0', marginBottom: '6px' }}><strong>Step {idx + 1}:</strong> {step.instruction}</p>
                            {step.scripts?.length > 0 && step.scripts.map((s: any, sIdx: number) => (
                              <p key={sIdx} style={{ color: '#a0c4e8', marginLeft: '10px', fontSize: '13px' }}>📝 "{s.text || s}"</p>
                            ))}
                            {step.questions?.length > 0 && step.questions.map((q: any, qIdx: number) => (
                              <p key={qIdx} style={{ color: '#64c896', marginLeft: '10px', fontSize: '13px' }}>❓ {q.question || q}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : generatedContent.exerciseData ? (
                <div className="ai-preview-section">
                  <h5>
                    <i className="ri-checkbox-circle-line" style={{ marginRight: '8px', color: '#64c896' }} />
                    Exercise - {generatedContent.exerciseData.exerciseStep === 'stepA' ? 'Step A' : 'Step B'} ({generatedContent.exerciseData.exerciseType})
                  </h5>
                  <div className="ai-preview-item">
                    {/* Step A Preview */}
                    {generatedContent.exerciseData.exerciseStep === 'stepA' && (
                      <>
                        <p style={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: '10px' }}>{generatedContent.exerciseData.instructions}</p>
                        {generatedContent.exerciseData.instructionsTranslation && (
                          <p style={{ color: '#a0a0a0', fontSize: '13px', marginBottom: '12px' }}>{generatedContent.exerciseData.instructionsTranslation}</p>
                        )}
                        
                        {/* Expressions box for rephrase */}
                        {generatedContent.exerciseData.showExpressions && generatedContent.exerciseData.expressions?.length > 0 && (
                          <div style={{ background: 'rgba(79, 170, 254, 0.1)', padding: '10px', borderRadius: '6px', marginBottom: '12px', border: '1px solid rgba(79, 170, 254, 0.3)' }}>
                            <strong style={{ color: '#4faafe' }}>Word Box:</strong>
                            <p style={{ color: '#e0e0e0' }}>{generatedContent.exerciseData.expressions.join(' • ')}</p>
                          </div>
                        )}
                        
                        {/* Example */}
                        {generatedContent.exerciseData.showExample && (
                          <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(100, 200, 150, 0.1)', borderRadius: '6px', border: '1px solid rgba(100, 200, 150, 0.3)' }}>
                            <strong style={{ color: '#64c896' }}>Example:</strong>
                            <p style={{ color: '#e0e0e0' }}>{generatedContent.exerciseData.exampleSentence}</p>
                            <p style={{ color: '#64c896' }}>→ {generatedContent.exerciseData.exampleAnswer}</p>
                          </div>
                        )}
                        
                        {/* Exercise items */}
                        {(() => {
                          // Get the appropriate items based on exercise type
                          const exerciseType = generatedContent.exerciseData.exerciseType;
                          let items: any[] = [];
                          if (exerciseType === 'rephrase' && generatedContent.exerciseData.exerciseItems?.length > 0) {
                            items = generatedContent.exerciseData.exerciseItems;
                          } else if (exerciseType === 'choose' && generatedContent.exerciseData.chooseItems?.length > 0) {
                            items = generatedContent.exerciseData.chooseItems;
                          } else if (exerciseType === 'change' && generatedContent.exerciseData.changeItems?.length > 0) {
                            items = generatedContent.exerciseData.changeItems;
                          } else {
                            // Fallback: try any available items
                            items = generatedContent.exerciseData.exerciseItems || 
                                   generatedContent.exerciseData.chooseItems || 
                                   generatedContent.exerciseData.changeItems || [];
                          }
                          
                          if (items.length > 0) {
                            return (
                              <div style={{ marginBottom: '12px' }}>
                                <strong style={{ color: '#4faafe' }}>Items:</strong>
                                <ol style={{ color: '#e0e0e0', paddingLeft: '20px' }}>
                                  {items.map((item: any, idx: number) => {
                                    const text = typeof item === 'string' ? item : (item.sentence || item.text || '');
                                    return text ? (
                                      <li key={idx} style={{ marginBottom: '6px' }} dangerouslySetInnerHTML={{ __html: text }} />
                                    ) : null;
                                  })}
                                </ol>
                              </div>
                            );
                          } else {
                            return (
                              <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(255, 100, 100, 0.1)', borderRadius: '6px', border: '1px solid rgba(255, 100, 100, 0.3)' }}>
                                <p style={{ color: '#ff6b6b', margin: 0 }}>
                                  <i className="ri-error-warning-line" style={{ marginRight: '6px' }} />
                                  No exercise items generated. Try generating again.
                                </p>
                              </div>
                            );
                          }
                        })()}
                        
                        {/* Answer key */}
                        {generatedContent.exerciseData.answers?.length > 0 && (
                          <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                            <strong style={{ color: '#ffd700' }}>Answer Key:</strong>
                            <ol style={{ color: '#a0a0a0', paddingLeft: '20px', fontSize: '13px' }}>
                              {generatedContent.exerciseData.answers.map((answer: any, idx: number) => (
                                <li key={idx}>{answer.text}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Step B Preview */}
                    {generatedContent.exerciseData.exerciseStep === 'stepB' && (
                      <>
                        <p style={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: '10px' }}>{generatedContent.exerciseData.stepBInstruction}</p>
                        
                        {/* Conversation preview */}
                        {generatedContent.exerciseData.conversations?.length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            {generatedContent.exerciseData.conversations.map((conv: any, idx: number) => (
                              <div key={idx} style={{
                                display: 'flex',
                                justifyContent: conv.position === 'right' ? 'flex-end' : 'flex-start',
                                marginBottom: '8px'
                              }}>
                                <div style={{
                                  background: conv.position === 'right' ? 'rgba(100, 200, 150, 0.15)' : 'rgba(79, 170, 254, 0.15)',
                                  padding: '10px 14px',
                                  borderRadius: '12px',
                                  maxWidth: '80%',
                                  border: conv.position === 'right' ? '1px solid rgba(100, 200, 150, 0.3)' : '1px solid rgba(79, 170, 254, 0.3)'
                                }}>
                                  <p style={{ color: '#e0e0e0', margin: 0 }}>{conv.speechBubble}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Multiple choice preview */}
                        {generatedContent.exerciseData.multipleChoiceItems?.length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            {generatedContent.exerciseData.multipleChoiceItems.map((item: any, idx: number) => (
                              <div key={idx} style={{ marginBottom: '16px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                                <p style={{ color: '#e0e0e0', fontWeight: 'bold' }}>{item.boldSentence}</p>
                                <p style={{ color: '#a0c4e8', marginTop: '6px' }}>A: {item.optionA}</p>
                                <p style={{ color: '#64c896', marginTop: '4px' }}>B: {item.optionB}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Speech preview */}
                        {generatedContent.exerciseData.speechContent && (
                          <div style={{ background: 'rgba(79, 170, 254, 0.1)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(79, 170, 254, 0.3)' }}>
                            <p style={{ color: '#e0e0e0', lineHeight: '1.6' }}>{generatedContent.exerciseData.speechContent}</p>
                          </div>
                        )}
                        
                        {/* Compare preview */}
                        {generatedContent.exerciseData.compareWordBox?.length > 0 && (
                          <div>
                            <div style={{ background: 'rgba(79, 170, 254, 0.1)', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
                              <strong style={{ color: '#4faafe' }}>Word Box:</strong>
                              <p style={{ color: '#e0e0e0' }}>{generatedContent.exerciseData.compareWordBox.join(' • ')}</p>
                            </div>
                            {generatedContent.exerciseData.compareExample && (
                              <p style={{ color: '#64c896', marginBottom: '10px' }}>Example: {generatedContent.exerciseData.compareExample}</p>
                            )}
                            <ol style={{ color: '#e0e0e0', paddingLeft: '20px' }}>
                              {generatedContent.exerciseData.compareItems?.map((item: any, idx: number) => (
                                <li key={idx}>{item.sentence}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : generatedContent.missionData ? (
                <div className="ai-preview-section">
                  <h5>
                    <i className={activeSection === 'mission2' ? 'ri-rocket-2-line' : 'ri-rocket-line'} style={{ marginRight: '8px', color: '#ff9f43' }} />
                    {activeSection === 'mission2' ? 'Mission 2' : 'Mission'} - {generatedContent.missionData.missionType.charAt(0).toUpperCase() + generatedContent.missionData.missionType.slice(1)} Challenge
                  </h5>
                  <div className="ai-preview-item">
                    {/* Challenge Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <span style={{ background: 'rgba(255, 159, 67, 0.2)', color: '#ff9f43', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                        Challenge {generatedContent.missionData.challengeNumber || 1}
                      </span>
                      <span style={{ color: '#e0e0e0', fontWeight: 'bold' }}>{generatedContent.missionData.challengeName}</span>
                      <span style={{ color: '#a0a0a0', fontSize: '13px' }}>• {generatedContent.missionData.duration}</span>
                    </div>
                    
                    {/* Situation */}
                    {generatedContent.missionData.situation && (
                      <div style={{ marginBottom: '14px', padding: '12px', background: 'rgba(79, 170, 254, 0.1)', borderRadius: '8px', border: '1px solid rgba(79, 170, 254, 0.2)' }}>
                        <strong style={{ color: '#4faafe', display: 'block', marginBottom: '6px' }}>Situation:</strong>
                        <p style={{ color: '#e0e0e0', marginBottom: generatedContent.missionData.situationTranslation ? '6px' : '0' }}>{generatedContent.missionData.situation}</p>
                        {generatedContent.missionData.situationTranslation && (
                          <p style={{ color: '#a0a0a0', fontSize: '13px' }}>{generatedContent.missionData.situationTranslation}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Instruction */}
                    {generatedContent.missionData.instruction && (
                      <div style={{ marginBottom: '14px', padding: '12px', background: 'rgba(100, 200, 150, 0.1)', borderRadius: '8px', border: '1px solid rgba(100, 200, 150, 0.2)' }}>
                        <strong style={{ color: '#64c896', display: 'block', marginBottom: '6px' }}>Instruction:</strong>
                        <p style={{ color: '#e0e0e0', marginBottom: generatedContent.missionData.instructionTranslation ? '6px' : '0' }}>{generatedContent.missionData.instruction}</p>
                        {generatedContent.missionData.instructionTranslation && (
                          <p style={{ color: '#a0a0a0', fontSize: '13px' }}>{generatedContent.missionData.instructionTranslation}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Grammar Tip */}
                    {generatedContent.missionData.showGrammarTip && generatedContent.missionData.grammarTipItems?.length > 0 && (
                      <div style={{ marginBottom: '14px', padding: '12px', background: 'rgba(255, 215, 0, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                        <strong style={{ color: '#ffd700', display: 'block', marginBottom: '6px' }}>{generatedContent.missionData.grammarTipTitle || "Today's grammar tip"}:</strong>
                        <p style={{ color: '#e0e0e0' }}>{generatedContent.missionData.grammarTipItems.join(', ')}</p>
                      </div>
                    )}
                    
                    {/* Discussion Topics (for discussion type) */}
                    {generatedContent.missionData.topics?.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <strong style={{ color: '#ff9f43', display: 'block', marginBottom: '8px' }}>Discussion Topics:</strong>
                        {generatedContent.missionData.topics.map((topic: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: '10px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '3px solid #ff9f43' }}>
                            <p style={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: '6px' }}>{topic.title}</p>
                            <ul style={{ color: '#a0c4e8', paddingLeft: '16px', margin: 0 }}>
                              {topic.questions?.map((q: string, qIdx: number) => (
                                <li key={qIdx} style={{ marginBottom: '4px' }}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Reading Passage (for reading type) */}
                    {generatedContent.missionData.readingPassage && (
                      <div style={{ marginBottom: '14px' }}>
                        <strong style={{ color: '#ff9f43', display: 'block', marginBottom: '8px' }}>Reading Passage:</strong>
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                          <p style={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: '4px' }}>{generatedContent.missionData.readingPassage.title}</p>
                          {generatedContent.missionData.readingPassage.author && (
                            <p style={{ color: '#a0a0a0', fontSize: '13px', marginBottom: '10px' }}>— {generatedContent.missionData.readingPassage.author}</p>
                          )}
                          {generatedContent.missionData.readingPassage.blocks?.slice(0, 2).map((block: any, idx: number) => (
                            <p key={idx} style={{ color: '#c0c0c0', marginBottom: '8px', fontSize: '13px' }}>
                              {block.type === 'paragraph' ? (block.text?.slice(0, 150) + '...') : '[Image]'}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Listening Script (for listening type) */}
                    {generatedContent.missionData.listeningScript && (
                      <div style={{ marginBottom: '14px' }}>
                        <strong style={{ color: '#ff9f43', display: 'block', marginBottom: '8px' }}>Listening Script:</strong>
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                          <p style={{ color: '#c0c0c0', fontSize: '13px' }} dangerouslySetInnerHTML={{ __html: generatedContent.missionData.listeningScript.slice(0, 200) + '...' }} />
                        </div>
                      </div>
                    )}
                    
                    {/* Questions Preview */}
                    {generatedContent.missionData.questions?.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <strong style={{ color: '#4faafe', display: 'block', marginBottom: '8px' }}>Roleplay Questions ({generatedContent.missionData.questions.length}):</strong>
                        <ol style={{ color: '#e0e0e0', paddingLeft: '20px' }}>
                          {generatedContent.missionData.questions.slice(0, 4).map((q: any, idx: number) => (
                            <li key={idx} style={{ marginBottom: '6px' }}>
                              {q.question}
                              {q.hints?.length > 0 && (
                                <span style={{ color: '#a0a0a0', fontSize: '12px', marginLeft: '8px' }}>({q.hints.length} hints)</span>
                              )}
                            </li>
                          ))}
                          {generatedContent.missionData.questions.length > 4 && (
                            <li style={{ color: '#a0a0a0', fontStyle: 'italic' }}>...and {generatedContent.missionData.questions.length - 4} more</li>
                          )}
                        </ol>
                      </div>
                    )}
                    
                    {/* Tutor Steps Count */}
                    {generatedContent.missionData.tutorSteps?.length > 0 && (
                      <p style={{ color: '#a0a0a0', fontSize: '12px', marginTop: '12px' }}>
                        <i className="ri-user-line" style={{ marginRight: '4px' }} />
                        {generatedContent.missionData.tutorSteps.length} tutor steps included
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Introduction Texts */}
                  <div className="ai-preview-section">
                    <h5>Introduction Texts</h5>
                    {generatedContent.introTexts?.map((text: IntroText, idx: number) => (
                      <div key={idx} className="ai-preview-item">
                        <span className="ai-preview-label">{text.language.toUpperCase()}</span>
                        <p>{text.text}</p>
                      </div>
                    ))}
                  </div>

                  {/* Lesson Issue */}
                  {generatedContent.lessonIssue && generatedContent.lessonIssue.title && (
                    <div className="ai-preview-section">
                      <h5>Lesson Issue</h5>
                      <div className="ai-preview-item">
                        <strong className="ai-issue-title">{generatedContent.lessonIssue.title}</strong>
                        <ul>
                          {generatedContent.lessonIssue.points?.map((point: string, idx: number) => (
                            <li key={idx}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Lesson Goal Duration */}
                  <div className="ai-preview-section">
                    <h5>Duration</h5>
                    <p className="ai-duration">{generatedContent.lessonGoalDuration}</p>
                  </div>

                  {/* Lesson Goal Steps */}
                  {generatedContent.lessonGoalSteps?.length > 0 && (
                    <div className="ai-preview-section">
                      <h5>Tutor Steps</h5>
                      {generatedContent.lessonGoalSteps.map((step: LessonGoalStep, idx: number) => (
                        <div key={idx} className="ai-preview-item">
                          <strong className="ai-step-num">Step {idx + 1}</strong>
                          <p className="ai-step-instruction">{step.instruction}</p>
                          {step.script && <p className="ai-step-script">📝 Script: {step.script}</p>}
                          {step.question && <p className="ai-step-question">❓ Question: {step.question}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="ai-preview-footer">
              <button className="ai-btn-cancel" onClick={handleDismiss}>
                Cancel
              </button>
              <button className="ai-btn-insert" onClick={handleInsertContent}>
                <i className="ri-check-line" />
                Insert Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
