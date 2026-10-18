/**
 * Conversational Skills Template
 * Combined Speaking, Listening, and Reading elements
 */
import type { LessonMaterial } from '../../types/lesson.types';

export function createConversationalTemplate(): LessonMaterial {
  return {
    version: 3,
    course: 'Conversational Skills',
    category: 'Conversation',
    header: {
      backgroundImage: '',
      overlayColor: '#0369a1cc',
      levelBadge: 'STARTER',
      chapterLabel: 'Chapter 1: All About Me',
      lessonLabel: 'Lesson 1: Greetings',
      goalText: 'I can say basic greetings.',
      goalSubtext: '基本的な挨拶ができるようになる。',
    },
    sections: [
      // 1. WARM-UP / INTRODUCE
      {
        id: 'section-1',
        sectionNumber: 1,
        sectionTitle: 'WARM-UP',
        sectionType: 'introduce',
        explanationEn: 'Today we will learn about greetings and introductions.',
        explanationJp: '今日は挨拶と自己紹介について学びます。',
        importantNote: 'Make the student feel comfortable and ready to learn.',
        sidebarTitle: 'WARM-UP',
        sidebarSubtitle: '(1 minute)',
        lessonGoalTitle: 'LESSON GOAL',
        lessonGoalSteps: [
          { id: 'step-1', instruction: 'Introduce the lesson topic.', scriptLine: 'Today, let\'s learn about greetings.' },
          { id: 'step-2', instruction: 'Read the lesson goal and ask if it\'s clear.' },
          { id: 'step-3', instruction: 'Transition to the next section.', scriptLine: 'Good! Let\'s go to the next part!' },
        ],
      },
      // 2. VOCABULARY
      {
        id: 'section-2',
        sectionNumber: 2,
        sectionTitle: 'LEARN',
        sectionType: 'vocabulary',
        stepTitle: 'STEP A VOCABULARY',
        instructionEn: 'I. Listen and repeat.',
        instructionJp: '聴いて、リピートしましょう。',
        vocabCards: [
          { id: 'v1', image: '', wordEn: 'hello', wordJp: 'こんにちは' },
          { id: 'v2', image: '', wordEn: 'goodbye', wordJp: 'さようなら' },
          { id: 'v3', image: '', wordEn: 'thank you', wordJp: 'ありがとう' },
          { id: 'v4', image: '', wordEn: 'please', wordJp: 'お願いします' },
          { id: 'v5', image: '', wordEn: 'excuse me', wordJp: 'すみません' },
          { id: 'v6', image: '', wordEn: 'sorry', wordJp: 'ごめんなさい' },
        ],
        sidebarTitle: 'LEARN',
        sidebarSubtitle: 'STEP A I (2 minutes)',
        lessonGoalSteps: [
          { id: 'step-1', instruction: 'Introduce vocabulary.', scriptLine: 'Now, let\'s learn some words.' },
          { id: 'step-2', instruction: 'Read each word and have student repeat.' },
          { id: 'step-3', instruction: 'Correct pronunciation if needed.' },
        ],
      },
      // 3. QUESTION / IMAGE CARDS
      {
        id: 'section-3',
        sectionNumber: 2,
        sectionTitle: '',
        sectionType: 'question',
        stepTitle: 'STEP B',
        instructionEn: 'II. Which words do you use most often?',
        instructionJp: 'どの言葉を一番よく使いますか？',
        imageCards: [
          { id: 'ic1', image: '', label: 'at home' },
          { id: 'ic2', image: '', label: 'at work' },
        ],
        sidebarTitle: 'LEARN',
        sidebarSubtitle: 'STEP B (1 minute)',
        lessonGoalSteps: [
          { id: 'step-1', instruction: 'Ask the question.', scriptLine: 'Which words do you use most?' },
          { id: 'step-2', instruction: 'Have student discuss briefly.', tipText: 'Accept simple answers.' },
        ],
      },
      // 4. PRONUNCIATION
      {
        id: 'section-4',
        sectionNumber: 2,
        sectionTitle: '',
        sectionType: 'pronunciation',
        stepTitle: 'STEP C',
        instructionEn: 'III. Practice reading the words.',
        instructionJp: '単語を読む練習をしましょう。',
        pronunciationColumns: [
          {
            id: 'col-1',
            soundLabel: '/h/',
            image: '',
            words: [
              { id: 'w1', wordEn: 'hello', wordJp: 'こんにちは' },
              { id: 'w2', wordEn: 'hi', wordJp: 'やあ' },
              { id: 'w3', wordEn: 'how', wordJp: 'どうやって' },
            ],
          },
          {
            id: 'col-2',
            soundLabel: '/θ/',
            image: '',
            words: [
              { id: 'w4', wordEn: 'thank', wordJp: '感謝する' },
              { id: 'w5', wordEn: 'think', wordJp: '考える' },
              { id: 'w6', wordEn: 'three', wordJp: '3' },
            ],
          },
        ],
        sidebarTitle: 'LEARN',
        sidebarSubtitle: 'STEP C (1 minute)',
        lessonGoalSteps: [
          { id: 'step-1', instruction: 'Demonstrate the sounds.' },
          { id: 'step-2', instruction: 'Have student repeat each word.' },
        ],
      },
      // 5. GRAMMAR
      {
        id: 'section-5',
        sectionNumber: 2,
        sectionTitle: '',
        sectionType: 'grammar',
        stepTitle: 'STEP D GRAMMAR TIP',
        instructionEn: 'Use "How are you?" to ask about someone\'s condition.',
        instructionJp: '相手の調子を聞くときは「How are you?」を使います。',
        grammarRules: [
          {
            id: 'rule-1',
            ruleEn: 'Use "How are you?" in formal situations.',
            ruleJp: 'フォーマルな場面では「How are you?」を使います。',
            examples: [
              { id: 'ex-1', sentenceEn: 'How are you today?', sentenceJp: '今日の調子はいかがですか？', boldWords: ['How'] },
            ],
          },
        ],
        sidebarTitle: 'LEARN',
        sidebarSubtitle: 'STEP D (1 minute)',
        lessonGoalSteps: [
          { id: 'step-1', instruction: 'Read the grammar tip.' },
          { id: 'step-2', instruction: 'Check understanding.', scriptLine: 'Is it clear?' },
        ],
      },
      // 6. DIALOGUE
      {
        id: 'section-6',
        sectionNumber: 3,
        sectionTitle: 'APPLY',
        sectionType: 'dialogue',
        stepTitle: 'SPEAKING',
        instructionEn: 'Two friends meet at a café.',
        instructionJp: '二人の友人がカフェで会います。',
        dialogueLines: [
          { id: 'l1', speaker: 'A', lineEn: 'Hi! How are you?' },
          { id: 'l2', speaker: 'B', lineEn: 'I\'m good, thanks! And you?' },
          { id: 'l3', speaker: 'A', lineEn: 'I\'m great! Nice to see you.' },
          { id: 'l4', speaker: 'B', lineEn: 'Nice to see you too!' },
        ],
        sidebarTitle: 'APPLY',
        sidebarSubtitle: 'SPEAKING (3 minutes)',
        lessonGoalSteps: [
          { id: 'step-1', instruction: 'Set up the dialogue.', scriptLine: 'Let\'s read this conversation.' },
          { id: 'step-2', instruction: 'Read with the student.' },
          { id: 'step-3', instruction: 'Correct pronunciation.', tipText: 'Focus on 2-3 key corrections.' },
        ],
      },
      // 7. TRIVIA
      {
        id: 'section-7',
        sectionNumber: 3,
        sectionTitle: '',
        sectionType: 'trivia',
        stepTitle: 'TRIVIA',
        instructionEn: 'In English, we often say "How are you?" as a greeting, not always expecting a detailed answer.',
        instructionJp: '英語では、「How are you?」は挨拶として使われ、必ずしも詳しい答えを期待していません。',
        triviaExamples: [
          { id: 't1', speakerA: 'A', lineA: 'How are you?', speakerB: 'B', lineB: 'Good.', isCorrect: true },
          { id: 't2', speakerA: 'A', lineA: 'How are you?', speakerB: 'B', lineB: '...', isCorrect: false },
        ],
        sidebarTitle: 'APPLY',
        sidebarSubtitle: 'TRIVIA (1 minute)',
        lessonGoalSteps: [
          { id: 'step-1', instruction: 'Read the trivia.' },
          { id: 'step-2', instruction: 'Check understanding.', scriptLine: 'Is it clear?' },
        ],
      },
      // 8. PRACTICE
      {
        id: 'section-8',
        sectionNumber: 4,
        sectionTitle: 'TRY IT',
        sectionType: 'practice',
        stepTitle: 'STEP A EXERCISE',
        instructionEn: 'Complete the sentences.',
        instructionJp: '文を完成させましょう。',
        practiceExample: 'ex. How _____ you?',
        practiceExampleAnswer: '→ How are you?',
        practiceItems: [
          { id: 'p1', question: 'Nice to _____ you.', answer: 'meet' },
          { id: 'p2', question: 'Thank _____ very much.', answer: 'you' },
          { id: 'p3', question: 'See you _____!', answer: 'later' },
        ],
        answerItems: ['meet', 'you', 'later'],
        sidebarTitle: 'TRY IT',
        sidebarSubtitle: 'STEP A (2 minutes)',
        lessonGoalSteps: [
          { id: 'step-1', instruction: 'Read the instructions.' },
          { id: 'step-2', instruction: 'Have student complete each item.' },
        ],
      },
      // 9. CHALLENGE 1
      {
        id: 'section-9',
        sectionNumber: 5,
        sectionTitle: 'CHALLENGE',
        sectionType: 'challenge',
        challengeTitle: 'Challenge 1',
        situationEn: 'You meet a new colleague at work.\n\nIntroduce yourself and have a short conversation.',
        situationJp: '職場で新しい同僚に会います。\n\n自己紹介をして、短い会話をしましょう。',
        grammarTipTitle: 'Remember to use',
        grammarTipItems: ['Hello', 'How are you?', 'Nice to meet you'],
        challengeQuestions: [
          { id: 'cq1', question: 'Start with a greeting.' },
          { id: 'cq2', question: 'Introduce yourself.', subQuestions: ['What\'s your name?', 'Where are you from?'] },
          { id: 'cq3', question: 'Ask about them.' },
        ],
        sidebarTitle: 'CHALLENGE',
        sidebarSubtitle: 'CHALLENGE 1 (5 minutes)',
        lessonGoalSteps: [
          { id: 'step-1', instruction: 'Read the situation.' },
          { id: 'step-2', instruction: 'Set up the roleplay.', scriptLine: 'I\'ll be your new colleague.' },
          { id: 'step-3', instruction: 'Have the conversation.', tipText: 'Guide as needed.' },
        ],
      },
      // 10. CHALLENGE 2
      {
        id: 'section-10',
        sectionNumber: 5,
        sectionTitle: '',
        sectionType: 'challenge2',
        challengeTitle: 'Challenge 2',
        isOptional: true,
        instructionEn: 'Discuss your ideas.',
        instructionJp: 'あなたの意見を言いましょう。',
        topicBoxes: [
          {
            id: 'tb1',
            topicNumber: 1,
            topicTitle: 'GREETINGS',
            questions: [
              { id: 'tq1', question: 'How do you greet friends vs coworkers?' },
              { id: 'tq2', question: 'What greetings do you use in your language?' },
            ],
          },
          {
            id: 'tb2',
            topicNumber: 2,
            topicTitle: 'CULTURE',
            questions: [
              { id: 'tq3', question: 'Are greetings different in other countries?' },
              { id: 'tq4', question: 'What surprised you about English greetings?' },
            ],
          },
        ],
        sidebarTitle: 'CHALLENGE',
        sidebarSubtitle: 'CHALLENGE 2 (2-3 minutes)',
        lessonGoalSteps: [
          { id: 'step-1', instruction: 'Read the topics.' },
          { id: 'step-2', instruction: 'Have student choose one.', tipText: 'Continue as time allows.' },
        ],
      },
      // 11. FEEDBACK
      {
        id: 'section-11',
        sectionNumber: 6,
        sectionTitle: 'FEEDBACK',
        sectionType: 'feedback',
        feedbackRubric: [
          { score: 4, label: 'Very Good', description: 'Completed with ease' },
          { score: 3, label: 'Good', description: 'Completed with some help' },
          { score: 2, label: 'Fair', description: 'Completed with guidance' },
          { score: 1, label: 'Needs Work', description: 'Had difficulty' },
        ],
        feedbackCategories: [
          { id: 'fc1', title: 'RANGE', titleJp: '表現の幅', descJp: '語彙をどの程度使えるか' },
          { id: 'fc2', title: 'ACCURACY', titleJp: '正確さ', descJp: '文法が正しく使えているか' },
          { id: 'fc3', title: 'FLUENCY', titleJp: '流暢さ', descJp: '円滑に喋れるか' },
        ],
        feedbackTemplate: '*Lesson Goal: SCORE*\n4 / 3 / 2 / 1\n\n*Feedback*\nRANGE:\nACCURACY:\nFLUENCY:',
        sidebarTitle: 'FEEDBACK',
        sidebarSubtitle: '(2 minutes)',
        lessonGoalSteps: [
          { id: 'step-1', instruction: 'Ask if they achieved the goal.', scriptLine: 'Did you achieve the lesson goal?' },
          { id: 'step-2', instruction: 'Give a score using the rubric.' },
          { id: 'step-3', instruction: 'Provide feedback.' },
          { id: 'step-4', instruction: 'Wrap up.', scriptLine: 'Great job! Thank you for today.' },
        ],
      },
    ],
  };
}
