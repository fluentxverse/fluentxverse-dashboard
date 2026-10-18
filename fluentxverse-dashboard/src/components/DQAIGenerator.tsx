/**
 * DQAIGenerator - Simple AI Discussion Questions Generator
 * A floating panel for the Discussion Questions Visual Editor that generates
 * level-appropriate discussion questions using AI.
 */
import { useState, useRef } from 'preact/hooks';
import { generateDiscussionQuestions } from '../api/ai.api';
import './DQAIGenerator.css';

interface DQAIGeneratorProps {
  topic: string;
  level: number;
  questionCount: number;
  onInsertQuestions: (questions: string[]) => void;
}

export function DQAIGenerator({ topic, level, questionCount, onInsertQuestions }: DQAIGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [error, setError] = useState('');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  const levelLabels: Record<number, string> = {
    1: 'STARTER',
    2: 'ELEMENTARY',
    3: 'PRE-INTERMEDIATE',
    4: 'INTERMEDIATE',
    5: 'UPPER-INTERMEDIATE',
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please set a topic title first.');
      return;
    }
    setGenerating(true);
    setError('');
    setGeneratedQuestions([]);
    setSelectedIndices(new Set());

    const result = await generateDiscussionQuestions(
      topic,
      level,
      questionCount,
      customPrompt || undefined,
    );

    setGenerating(false);

    if (result.success && result.data?.questions?.length) {
      setGeneratedQuestions(result.data.questions);
      // Select all by default
      setSelectedIndices(new Set(result.data.questions.map((_, i) => i)));
    } else {
      setError(result.error || 'Failed to generate questions. Try again.');
    }
  };

  const toggleSelect = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === generatedQuestions.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(generatedQuestions.map((_, i) => i)));
    }
  };

  const handleInsert = () => {
    const selected = generatedQuestions.filter((_, i) => selectedIndices.has(i));
    if (selected.length === 0) return;
    onInsertQuestions(selected);
    setGeneratedQuestions([]);
    setSelectedIndices(new Set());
    setIsOpen(false);
  };

  return (
    <>
      {/* FAB Toggle Button */}
      <button
        className={`dqai-fab ${isOpen ? 'dqai-fab--active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="AI Question Generator"
      >
        <i className={isOpen ? 'ri-close-line' : 'ri-sparkling-2-fill'} />
      </button>

      {/* Panel */}
      {isOpen && (
        <div className={`dqai-panel ${isOpen ? 'dqai-panel--open' : ''}`} ref={panelRef}>
          {/* Header */}
          <div className="dqai-header">
            <div className="dqai-header-icon">
              <i className="ri-sparkling-2-fill" />
            </div>
            <div className="dqai-header-text">
              <h3>AI QUESTION GENERATOR</h3>
              <span className="dqai-header-sub">
                {levelLabels[level] || `LEVEL ${level}`} &bull; {questionCount} questions
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="dqai-body">
            {/* Context Info */}
            <div className="dqai-context">
              <div className="dqai-context-row">
                <span className="dqai-context-label">TOPIC</span>
                <span className="dqai-context-value">{topic || '(not set)'}</span>
              </div>
              <div className="dqai-context-row">
                <span className="dqai-context-label">LEVEL</span>
                <span className="dqai-context-value">{levelLabels[level] || `Level ${level}`}</span>
              </div>
              <div className="dqai-context-row">
                <span className="dqai-context-label">COUNT</span>
                <span className="dqai-context-value">{questionCount} questions</span>
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="dqai-prompt-section">
              <label className="dqai-label">ADDITIONAL INSTRUCTIONS (OPTIONAL)</label>
              <textarea
                className="dqai-prompt-input"
                value={customPrompt}
                onChange={e => setCustomPrompt((e.target as HTMLTextAreaElement).value)}
                placeholder="e.g. Focus on travel experiences, include questions about food..."
                rows={3}
              />
            </div>

            {/* Generate Button */}
            <button
              className="dqai-generate-btn"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <i className="ri-loader-4-line dqai-spin" />
                  GENERATING...
                </>
              ) : (
                <>
                  <i className="ri-sparkling-2-fill" />
                  GENERATE QUESTIONS
                </>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="dqai-error">
                <i className="ri-error-warning-line" /> {error}
              </div>
            )}

            {/* Results */}
            {generatedQuestions.length > 0 && (
              <div className="dqai-results">
                <div className="dqai-results-header">
                  <span className="dqai-results-title">
                    <i className="ri-check-double-line" /> {generatedQuestions.length} QUESTIONS GENERATED
                  </span>
                  <button className="dqai-select-all" onClick={toggleSelectAll}>
                    {selectedIndices.size === generatedQuestions.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="dqai-questions-list">
                  {generatedQuestions.map((q, i) => (
                    <div
                      key={i}
                      className={`dqai-question ${selectedIndices.has(i) ? 'dqai-question--selected' : ''}`}
                      onClick={() => toggleSelect(i)}
                    >
                      <div className="dqai-question-check">
                        <i className={selectedIndices.has(i) ? 'ri-checkbox-fill' : 'ri-checkbox-blank-line'} />
                      </div>
                      <div className="dqai-question-num">{i + 1}</div>
                      <div className="dqai-question-text">{q}</div>
                    </div>
                  ))}
                </div>

                {/* Insert Button */}
                <button
                  className="dqai-insert-btn"
                  onClick={handleInsert}
                  disabled={selectedIndices.size === 0}
                >
                  <i className="ri-download-line" />
                  INSERT {selectedIndices.size} QUESTION{selectedIndices.size !== 1 ? 'S' : ''}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
