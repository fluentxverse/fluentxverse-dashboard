/**
 * BEAIContentGenerator — AI Content Generator for Business English (PCPP) lessons
 * Floating panel with section tabs, generate/improve modes, custom prompt, and preview.
 */
import { useState, useEffect } from 'preact/hooks';
import { generateBusinessEnglishContent, type BESectionType } from '../api/ai.api';
import './BEAIContentGenerator.css';

// ============================================================================
// TYPES
// ============================================================================

interface SectionConfig {
  id: BESectionType;
  label: string;
  number: number;
  icon: string;
  description: string;
}

const SECTIONS: SectionConfig[] = [
  { id: 'introduce', label: 'Warm-Up', number: 1, icon: 'ri-lightbulb-line', description: 'Goal, situation & task' },
  { id: 'present', label: 'Key Expressions', number: 2, icon: 'ri-book-line', description: 'Patterns, vocab & pronunciation' },
  { id: 'understand', label: 'Comprehension', number: 3, icon: 'ri-eye-line', description: 'Fill-in-the-blank exercises' },
  { id: 'practice', label: 'Drill', number: 4, icon: 'ri-repeat-line', description: '4-step progressive practice' },
  { id: 'challenge', label: 'Simulation', number: 5, icon: 'ri-rocket-line', description: 'Real-life roleplay scenario' },
  { id: 'discussion', label: 'Discussion', number: 6, icon: 'ri-chat-3-line', description: 'Category-based questions' },
  { id: 'feedback', label: 'Wrap-Up', number: 7, icon: 'ri-checkbox-circle-line', description: 'Review & feedback template' },
];

const coalesceText = (primary: any, fallback: any) => (primary || fallback);

const normalizeSectionData = (section: BESectionType, data: any) => {
  if (!data || typeof data !== 'object') return data;

  switch (section) {
    case 'introduce':
      return {
        ...data,
        goalKr: coalesceText(data.goalKr, data.goalJp),
        situationKr: coalesceText(data.situationKr, data.situationJp),
        taskKr: coalesceText(data.taskKr, data.taskJp),
      };
    case 'present':
      return {
        ...data,
        patterns: Array.isArray(data.patterns)
          ? data.patterns.map((p: any) => ({ ...p, kr: coalesceText(p.kr, p.jp) }))
          : data.patterns,
        pronunciation: data.pronunciation
          ? {
              ...data.pronunciation,
              instructionKr: coalesceText(data.pronunciation.instructionKr, data.pronunciation.instructionJp),
              left: data.pronunciation.left
                ? {
                    ...data.pronunciation.left,
                    words: Array.isArray(data.pronunciation.left.words)
                      ? data.pronunciation.left.words.map((w: any) => ({ ...w, kr: coalesceText(w.kr, w.jp) }))
                      : data.pronunciation.left.words,
                  }
                : data.pronunciation.left,
              right: data.pronunciation.right
                ? {
                    ...data.pronunciation.right,
                    words: Array.isArray(data.pronunciation.right.words)
                      ? data.pronunciation.right.words.map((w: any) => ({ ...w, kr: coalesceText(w.kr, w.jp) }))
                      : data.pronunciation.right.words,
                  }
                : data.pronunciation.right,
            }
          : data.pronunciation,
      };
    case 'understand':
      return {
        ...data,
        instructionKr: coalesceText(data.instructionKr, data.instructionJp),
        patternDrills: Array.isArray(data.patternDrills)
          ? data.patternDrills.map((d: any) => ({
              ...d,
              labelKr: coalesceText(d.labelKr, d.labelJp),
              examples: Array.isArray(d.examples)
                ? d.examples.map((ex: any) => ({ ...ex, kr: coalesceText(ex.kr, ex.jp) }))
                : d.examples,
            }))
          : data.patternDrills,
      };
    case 'practice':
      return {
        ...data,
        steps: Array.isArray(data.steps)
          ? data.steps.map((s: any) => ({ ...s, instructionKr: coalesceText(s.instructionKr, s.instructionJp) }))
          : data.steps,
      };
    case 'challenge':
      return {
        ...data,
        scenarioKr: coalesceText(data.scenarioKr, data.scenarioJp),
      };
    case 'discussion':
      return {
        ...data,
        instructionKr: coalesceText(data.instructionKr, data.instructionJp),
      };
    case 'feedback':
      return {
        ...data,
        goalReviewKr: coalesceText(data.goalReviewKr, data.goalReviewJp),
      };
    default:
      return data;
  }
};

const normalizeBEContent = (data: any) => {
  if (!data || typeof data !== 'object') return data;
  const normalized: any = { ...data };
  (['introduce', 'present', 'understand', 'practice', 'challenge', 'discussion', 'feedback'] as BESectionType[])
    .forEach((section) => {
      if (data[section]) normalized[section] = normalizeSectionData(section, data[section]);
    });
  return normalized;
};

export interface BEAIContentGeneratorProps {
  // Lesson metadata
  level: number;
  chapter: number;
  lessonNumber: number;
  lessonName: string;
  goalTextEn: string;
  goalTextJp: string;
  chapterName: string;
  // Current data for cross-section cohesion
  currentPresentData?: {
    patterns?: Array<{ en: string; kr: string }>;
    vocabulary?: Array<{ word: string; pos: string; translation: string }>;
  };
  // Section status — which sections have content
  sectionStatus?: Record<BESectionType, boolean>;
  // Callbacks — one per section
  onGenerateIntroduce: (data: any) => void;
  onGeneratePresent: (data: any) => void;
  onGenerateUnderstand: (data: any) => void;
  onGeneratePractice: (data: any) => void;
  onGenerateChallenge: (data: any) => void;
  onGenerateDiscussion: (data: any) => void;
  onGenerateFeedback: (data: any) => void;
  // Current section content for improve mode
  currentSectionData?: (section: BESectionType) => any;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BEAIContentGenerator({
  level,
  chapter,
  lessonNumber,
  lessonName,
  goalTextEn,
  goalTextJp,
  chapterName,
  currentPresentData,
  sectionStatus = {
    introduce: false, present: false, understand: false,
    practice: false, challenge: false, discussion: false, feedback: false,
  },
  onGenerateIntroduce,
  onGeneratePresent,
  onGenerateUnderstand,
  onGeneratePractice,
  onGenerateChallenge,
  onGenerateDiscussion,
  onGenerateFeedback,
  currentSectionData,
}: BEAIContentGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<BESectionType>('introduce');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; section: string }>({ current: 0, total: 0, section: '' });
  const [generatedContent, setGeneratedContent] = useState<any | null>(null);
  const [generatedSection, setGeneratedSection] = useState<BESectionType | null>(null);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [generationMode, setGenerationMode] = useState<'new' | 'improve'>('new');
  const [customPrompt, setCustomPrompt] = useState('');

  const currentSectionConfig = SECTIONS.find(s => s.id === activeSection)!;

  // ---- Generate ----
  const handleGenerate = async () => {
    if (!lessonName) {
      setError('Please set a lesson name first.');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const shouldGeneratePresentWithWarmup = activeSection === 'introduce' && !sectionStatus.present && generationMode === 'new';
      const currentContent = generationMode === 'improve' && currentSectionData
        ? currentSectionData(activeSection) : null;

      const response = await generateBusinessEnglishContent(
        activeSection,
        level,
        chapter,
        lessonNumber,
        lessonName,
        goalTextEn,
        goalTextJp,
        chapterName,
        customPrompt || null,
        currentContent,
        generationMode,
        // Pass present data for cohesion in understand/practice/challenge
        ['understand', 'practice', 'challenge'].includes(activeSection) ? (currentPresentData || null) : null,
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate content');
      }

      let mergedData = response.data;
      if (shouldGeneratePresentWithWarmup) {
        try {
          const presentResp = await generateBusinessEnglishContent(
            'present',
            level,
            chapter,
            lessonNumber,
            lessonName,
            goalTextEn,
            goalTextJp,
            chapterName,
            customPrompt || null,
            null,
            'new',
            null,
          );
          if (presentResp.success && presentResp.data?.present) {
            mergedData = { ...mergedData, present: presentResp.data.present };
          }
        } catch (presentErr) {
          console.error('Warm-up present generation error:', presentErr);
        }
      }

      setGeneratedContent(normalizeBEContent(mergedData));
      setGeneratedSection(activeSection);
      setShowPreview(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate content');
      console.error('BE generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // ---- Batch generate all sections ----
  const handleBatchGenerate = async () => {
    if (!lessonName) {
      setError('Please set a lesson name first.');
      return;
    }

    setIsBatchGenerating(true);
    setError('');
    const sectionsToGenerate = SECTIONS.filter(s => !sectionStatus[s.id]);

    if (sectionsToGenerate.length === 0) {
      setError('All sections already have content. Use individual section generation to regenerate.');
      setIsBatchGenerating(false);
      return;
    }

    setBatchProgress({ current: 0, total: sectionsToGenerate.length, section: '' });

    for (let i = 0; i < sectionsToGenerate.length; i++) {
      const sec = sectionsToGenerate[i];
      setBatchProgress({ current: i + 1, total: sectionsToGenerate.length, section: sec.label });

      try {
        const response = await generateBusinessEnglishContent(
          sec.id,
          level, chapter, lessonNumber, lessonName,
          goalTextEn, goalTextJp, chapterName,
          null, null, 'new',
          ['understand', 'practice', 'challenge'].includes(sec.id) ? (currentPresentData || null) : null,
        );

        if (response.success && response.data) {
          const normalized = normalizeBEContent(response.data);
          const data = normalized[sec.id];
          if (data) insertSectionContent(sec.id, data);
        }
      } catch (err) {
        console.error(`Batch generation failed for ${sec.id}:`, err);
      }
    }

    setBatchProgress({ current: 0, total: 0, section: '' });
    setIsBatchGenerating(false);
  };

  // ---- Insert content into editor ----
  const insertSectionContent = (section: BESectionType, data: any) => {
    const handlers: Record<BESectionType, (d: any) => void> = {
      introduce: onGenerateIntroduce,
      present: onGeneratePresent,
      understand: onGenerateUnderstand,
      practice: onGeneratePractice,
      challenge: onGenerateChallenge,
      discussion: onGenerateDiscussion,
      feedback: onGenerateFeedback,
    };
    handlers[section](data);
  };

  const handleInsertContent = () => {
    if (generatedContent && generatedSection) {
      const data = generatedContent[generatedSection];
      if (data) {
        insertSectionContent(generatedSection, data);
        if (generatedSection === 'introduce' && generatedContent.present && !sectionStatus.present) {
          insertSectionContent('present', generatedContent.present);
        }
        setShowPreview(false);
        setGeneratedContent(null);
      }
    }
  };

  // ---- Preview renderer ----
  const renderPreview = () => {
    if (!generatedContent || !generatedSection) return null;
    const data = generatedContent[generatedSection];
    if (!data) return <div className="beai-preview-empty">No content generated.</div>;

    return (
      <div className="beai-preview-content">
        <pre className="beai-preview-json">{JSON.stringify(data, null, 2)}</pre>
      </div>
    );
  };

  // Count completed sections
  const completedCount = Object.values(sectionStatus).filter(Boolean).length;
  const totalSections = SECTIONS.length;

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) {
    return (
      <button
        className="beai-fab"
        onClick={() => setIsOpen(true)}
        title="AI Content Generator"
      >
        <i className="ri-sparkling-2-fill" />
        {completedCount > 0 && completedCount < totalSections && (
          <span className="beai-fab-badge">{completedCount}/{totalSections}</span>
        )}
      </button>
    );
  }

  return (
    <div className="beai-panel">
      {/* Header */}
      <div className="beai-header">
        <div className="beai-header-left">
          <i className="ri-sparkling-2-fill" />
          <span className="beai-header-title">AI Content Generator</span>
          <span className="beai-header-subtitle">Business English</span>
        </div>
        <button className="beai-close-btn" onClick={() => setIsOpen(false)} title="Close">
          <i className="ri-close-line" />
        </button>
      </div>

      {/* Section Tabs */}
      <div className="beai-section-tabs">
        {SECTIONS.map(sec => (
          <button
            key={sec.id}
            className={`beai-section-tab ${activeSection === sec.id ? 'active' : ''} ${sectionStatus[sec.id] ? 'has-content' : ''}`}
            onClick={() => { setActiveSection(sec.id); setShowPreview(false); setError(''); }}
            title={sec.description}
          >
            <span className="beai-tab-num">{sec.number}</span>
            <span className="beai-tab-label">{sec.label}</span>
            {sectionStatus[sec.id] && <i className="ri-check-line beai-tab-check" />}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="beai-content">
        {/* Active section info */}
        <div className="beai-section-info">
          <i className={currentSectionConfig.icon} />
          <div>
            <strong>{currentSectionConfig.label}</strong>
            <span className="beai-section-desc">{currentSectionConfig.description}</span>
          </div>
        </div>

        <div className="beai-quick-actions">
          <div className="beai-quick-actions-copy">
            <strong>Generate All</strong>
            <span>{Math.max(totalSections - completedCount, 0)} sections remaining</span>
          </div>
          <button
            className="beai-btn beai-btn-batch beai-btn-batch-top"
            onClick={handleBatchGenerate}
            disabled={isGenerating || isBatchGenerating || completedCount === totalSections}
            title={completedCount === totalSections ? 'All sections already have content' : `Generate ${totalSections - completedCount} remaining sections`}
          >
            {isBatchGenerating ? (
              <><i className="ri-loader-4-line beai-spin" /> Generating All...</>
            ) : (
              <><i className="ri-stack-line" /> Generate All</>
            )}
          </button>
        </div>

        {/* Progress bar */}
        <div className="beai-progress-bar">
          <div className="beai-progress-fill" style={{ width: `${(completedCount / totalSections) * 100}%` }} />
          <span className="beai-progress-text">{completedCount}/{totalSections} sections</span>
        </div>

        {/* Generation mode toggle */}
        <div className="beai-mode-toggle">
          <button
            className={`beai-mode-btn ${generationMode === 'new' ? 'active' : ''}`}
            onClick={() => setGenerationMode('new')}
          >
            <i className="ri-add-circle-line" /> New
          </button>
          <button
            className={`beai-mode-btn ${generationMode === 'improve' ? 'active' : ''}`}
            onClick={() => setGenerationMode('improve')}
            disabled={!sectionStatus[activeSection]}
            title={!sectionStatus[activeSection] ? 'Generate content first before improving' : 'Improve existing content'}
          >
            <i className="ri-magic-line" /> Improve
          </button>
        </div>

        {/* Custom prompt */}
        <div className="beai-prompt-area">
          <label className="beai-prompt-label">
            <i className="ri-quill-pen-line" /> Custom Instructions (optional)
          </label>
          <textarea
            className="beai-prompt-input"
            value={customPrompt}
            onInput={(e) => setCustomPrompt((e.target as HTMLTextAreaElement).value)}
            placeholder={`E.g., "Focus on formal meeting language" or "Include email-related vocabulary"`}
            rows={2}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="beai-error">
            <i className="ri-error-warning-line" /> {error}
          </div>
        )}

        {/* Batch progress */}
        {isBatchGenerating && (
          <div className="beai-batch-progress">
            <div className="beai-batch-bar">
              <div className="beai-batch-fill" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
            </div>
            <span className="beai-batch-text">
              Generating {batchProgress.section}... ({batchProgress.current}/{batchProgress.total})
            </span>
          </div>
        )}

        {/* Preview */}
        {showPreview && generatedContent && (
          <div className="beai-preview">
            <div className="beai-preview-header">
              <span>Preview — {SECTIONS.find(s => s.id === generatedSection)?.label}</span>
              <div className="beai-preview-actions">
                <button className="beai-btn beai-btn-secondary" onClick={() => { setShowPreview(false); setGeneratedContent(null); }}>
                  <i className="ri-close-line" /> Discard
                </button>
                <button className="beai-btn beai-btn-primary" onClick={handleInsertContent}>
                  <i className="ri-check-line" /> Apply to Editor
                </button>
              </div>
            </div>
            {renderPreview()}
          </div>
        )}

        {/* Generate buttons */}
        <div className="beai-generate-buttons">
          <button
            className="beai-btn beai-btn-generate"
            onClick={handleGenerate}
            disabled={isGenerating || isBatchGenerating}
          >
            {isGenerating ? (
              <><i className="ri-loader-4-line beai-spin" /> Generating...</>
            ) : (
              <><i className="ri-sparkling-2-fill" /> Generate {currentSectionConfig.label}</>
            )}
          </button>
          <button
            className="beai-btn beai-btn-batch"
            onClick={handleBatchGenerate}
            disabled={isGenerating || isBatchGenerating || completedCount === totalSections}
            title={completedCount === totalSections ? 'All sections have content' : `Generate ${totalSections - completedCount} remaining sections`}
          >
            {isBatchGenerating ? (
              <><i className="ri-loader-4-line beai-spin" /> Generating All...</>
            ) : (
              <><i className="ri-stack-line" /> Generate All ({totalSections - completedCount} remaining)</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
