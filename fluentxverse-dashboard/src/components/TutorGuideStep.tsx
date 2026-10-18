import './TutorGuideStep.css';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TutorScriptBullet {
  text: string;
}

export interface TutorTipItem {
  text: string;
}

export interface TutorAnswerKeyItem {
  text: string;
}

export interface TutorQuestion {
  question: string;
  answer?: string;
}

// Universal tutor step that supports all variants
export interface UniversalTutorStep {
  instruction: string;
  // Array-based (new format - Apply, Exercise, Trivia)
  scripts?: TutorScriptBullet[];
  tips?: TutorTipItem[];
  questions?: TutorQuestion[];
  answerKey?: TutorAnswerKeyItem[];
  listeningScript?: string;
  // String-based (legacy format - Intro, Learn)
  script?: string | null;
  tip?: string | null;
  question?: string | null; // Legacy single question
}

// Feature flags for the component
export interface TutorGuideFeatures {
  showScripts?: boolean;
  showTips?: boolean;
  showQuestions?: boolean;
  showAnswerKey?: boolean;
  showListeningScript?: boolean;
  // Legacy mode uses string-based script/tip instead of arrays
  legacyMode?: boolean;
}

const DEFAULT_FEATURES: TutorGuideFeatures = {
  showScripts: true,
  showTips: true,
  showQuestions: false,
  showAnswerKey: false,
  showListeningScript: false,
  legacyMode: false,
};

// ============================================================================
// TUTOR GUIDE STEP COMPONENT
// ============================================================================

interface TutorGuideStepProps {
  step: UniversalTutorStep;
  stepIndex: number;
  onChange: (updatedStep: UniversalTutorStep) => void;
  onRemove?: () => void;
  canRemove?: boolean;
  features?: TutorGuideFeatures;
  RichTextInput?: any; // Optional RichTextInput component for listening script
}

export function TutorGuideStep({ 
  step, 
  stepIndex, 
  onChange, 
  onRemove, 
  canRemove = true,
  features = DEFAULT_FEATURES,
  RichTextInput,
}: TutorGuideStepProps) {
  const opts = { ...DEFAULT_FEATURES, ...features };
  
  const updateStep = (updates: Partial<UniversalTutorStep>) => {
    onChange({ ...step, ...updates });
  };

  // ---- LEGACY MODE HANDLERS (single script/tip as nullable strings) ----
  if (opts.legacyMode) {
    return (
      <div className="tgs-step">
        <span className="tgs-number">{stepIndex + 1}</span>
        <div className="tgs-content">
          <input
            type="text"
            className="tgs-instruction-input"
            value={step.instruction}
            onChange={e => updateStep({ instruction: (e.target as HTMLInputElement).value })}
            placeholder="Enter instruction..."
          />

          {/* Legacy Script (single, nullable) */}
          {step.script !== null && step.script !== undefined && (
            <div className="tgs-script-item tgs-legacy-script">
              <input
                type="text"
                className="tgs-script-input"
                value={step.script || ''}
                onChange={e => updateStep({ script: (e.target as HTMLInputElement).value })}
                placeholder="Say this..."
              />
              <button
                className="tgs-remove-btn"
                onClick={() => updateStep({ script: null })}
                title="Remove script"
              >
                <i className="ri-close-line" />
              </button>
            </div>
          )}

          {/* Legacy Tip (single, nullable) */}
          {step.tip !== null && step.tip !== undefined && (
            <div className="tgs-tip-item tgs-legacy-tip">
              <input
                type="text"
                className="tgs-tip-input"
                value={step.tip || ''}
                onChange={e => updateStep({ tip: (e.target as HTMLInputElement).value })}
                placeholder="Add a tip..."
              />
              <button
                className="tgs-remove-btn"
                onClick={() => updateStep({ tip: null })}
                title="Remove tip"
              >
                <i className="ri-close-line" />
              </button>
            </div>
          )}

          {/* Legacy Question (single, nullable) - green bordered box */}
          {step.question !== null && step.question !== undefined && (
            <div className="tgs-question-box tgs-legacy-question">
              <span className="tgs-question-bullet">•</span>
              <input
                type="text"
                className="tgs-question-input"
                value={step.question || ''}
                onChange={e => updateStep({ question: (e.target as HTMLInputElement).value })}
                placeholder="Question for the student..."
              />
              <button
                className="tgs-remove-btn"
                onClick={() => updateStep({ question: null })}
                title="Remove question"
              >
                <i className="ri-close-line" />
              </button>
            </div>
          )}

          {/* Add buttons for legacy mode */}
          <div className="tgs-add-btns">
            {(step.script === null || step.script === undefined) && opts.showScripts && (
              <button
                className="tgs-add-script-btn"
                onClick={() => updateStep({ script: '' })}
              >
                <i className="ri-chat-quote-line" /> Script
              </button>
            )}
            {(step.tip === null || step.tip === undefined) && opts.showTips && (
              <button
                className="tgs-add-tip-btn"
                onClick={() => updateStep({ tip: '' })}
              >
                <i className="ri-error-warning-line" /> Tip
              </button>
            )}
            {(step.question === null || step.question === undefined) && (
              <button
                className="tgs-add-question-btn"
                onClick={() => updateStep({ question: '' })}
              >
                <i className="ri-questionnaire-line" /> Question
              </button>
            )}
          </div>
        </div>

        {canRemove && onRemove && (
          <button 
            className="tgs-step-remove"
            onClick={onRemove}
          >
            <i className="ri-delete-bin-line" />
          </button>
        )}
      </div>
    );
  }

  // ---- ARRAY-BASED MODE HANDLERS ----

  // Script handlers
  const handleAddScript = () => {
    const newScripts = [...(step.scripts || []), { text: '' }];
    updateStep({ scripts: newScripts });
  };

  const handleUpdateScript = (scriptIdx: number, text: string) => {
    const newScripts = [...(step.scripts || [])];
    newScripts[scriptIdx] = { text };
    updateStep({ scripts: newScripts });
  };

  const handleRemoveScript = (scriptIdx: number) => {
    const newScripts = (step.scripts || []).filter((_, i) => i !== scriptIdx);
    updateStep({ scripts: newScripts.length > 0 ? newScripts : undefined });
  };

  // Tip handlers
  const handleAddTip = () => {
    const newTips = [...(step.tips || []), { text: '' }];
    updateStep({ tips: newTips });
  };

  const handleUpdateTip = (tipIdx: number, text: string) => {
    const newTips = [...(step.tips || [])];
    newTips[tipIdx] = { text };
    updateStep({ tips: newTips });
  };

  const handleRemoveTip = (tipIdx: number) => {
    const newTips = (step.tips || []).filter((_, i) => i !== tipIdx);
    updateStep({ tips: newTips.length > 0 ? newTips : undefined });
  };

  // Question handlers
  const handleAddQuestion = () => {
    const newQuestions = [...(step.questions || []), { question: '', answer: '' }];
    updateStep({ questions: newQuestions });
  };

  const handleUpdateQuestion = (qIdx: number, field: 'question' | 'answer', value: string) => {
    const newQuestions = [...(step.questions || [])];
    newQuestions[qIdx] = { ...newQuestions[qIdx], [field]: value };
    updateStep({ questions: newQuestions });
  };

  const handleRemoveQuestion = (qIdx: number) => {
    const newQuestions = (step.questions || []).filter((_, i) => i !== qIdx);
    updateStep({ questions: newQuestions.length > 0 ? newQuestions : undefined });
  };

  // Answer Key handlers
  const handleAddAnswerKey = () => {
    updateStep({ answerKey: [{ text: '' }] });
  };

  const handleAddAnswer = () => {
    const newAnswerKey = [...(step.answerKey || []), { text: '' }];
    updateStep({ answerKey: newAnswerKey });
  };

  const handleUpdateAnswer = (answerIdx: number, text: string) => {
    const newAnswerKey = [...(step.answerKey || [])];
    newAnswerKey[answerIdx] = { text };
    updateStep({ answerKey: newAnswerKey });
  };

  const handleRemoveAnswer = (answerIdx: number) => {
    const newAnswerKey = (step.answerKey || []).filter((_, i) => i !== answerIdx);
    updateStep({ answerKey: newAnswerKey.length > 0 ? newAnswerKey : undefined });
  };

  const handleRemoveAnswerKey = () => {
    updateStep({ answerKey: undefined });
  };

  // Listening Script handlers
  const handleAddListeningScript = () => {
    updateStep({ listeningScript: '' });
  };

  const handleRemoveListeningScript = () => {
    updateStep({ listeningScript: undefined });
  };

  return (
    <div className="tgs-step">
      <span className="tgs-number">{stepIndex + 1}</span>
      <div className="tgs-content">
        <input
          type="text"
          className="tgs-instruction-input"
          value={step.instruction}
          onChange={e => updateStep({ instruction: (e.target as HTMLInputElement).value })}
          placeholder="Enter instruction..."
        />

        {/* Scripts (array-based) */}
        {step.scripts && step.scripts.map((script, scriptIdx) => (
          <div key={scriptIdx} className="tgs-script-item">
            <span className="tgs-script-bullet">●</span>
            <input
              type="text"
              className="tgs-script-input"
              value={script.text}
              onChange={e => handleUpdateScript(scriptIdx, (e.target as HTMLInputElement).value)}
              placeholder="Script text..."
            />
            <button
              className="tgs-remove-btn"
              onClick={() => handleRemoveScript(scriptIdx)}
            >
              <i className="ri-close-line" />
            </button>
          </div>
        ))}

        {/* Tips (array-based) */}
        {step.tips && step.tips.map((tip, tipIdx) => (
          <div key={tipIdx} className="tgs-tip-item">
            <span className="tgs-tip-icon">◆</span>
            <input
              type="text"
              className="tgs-tip-input"
              value={tip.text}
              onChange={e => handleUpdateTip(tipIdx, (e.target as HTMLInputElement).value)}
              placeholder="Tip text..."
            />
            <button
              className="tgs-remove-btn"
              onClick={() => handleRemoveTip(tipIdx)}
            >
              <i className="ri-close-line" />
            </button>
          </div>
        ))}

        {/* Questions Box */}
        {step.questions && step.questions.length > 0 && (
          <div className="tgs-questions-box">
            {step.questions.map((q, qIdx) => (
              <div key={qIdx} className="tgs-question-item">
                <span className="tgs-question-bullet">•</span>
                <div className="tgs-question-content">
                  <input
                    type="text"
                    className="tgs-question-input"
                    value={q.question}
                    onChange={e => handleUpdateQuestion(qIdx, 'question', (e.target as HTMLInputElement).value)}
                    placeholder="Question..."
                  />
                  <input
                    type="text"
                    className="tgs-answer-hint-input"
                    value={q.answer || ''}
                    onChange={e => handleUpdateQuestion(qIdx, 'answer', (e.target as HTMLInputElement).value)}
                    placeholder="Answer hint..."
                  />
                </div>
                <button 
                  className="tgs-remove-btn"
                  onClick={() => handleRemoveQuestion(qIdx)}
                >
                  <i className="ri-close-line" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Answer Key Box */}
        {step.answerKey && step.answerKey.length > 0 && (
          <div className="tgs-answer-key-box">
            <div className="tgs-answer-key-header">
              <span>ANSWER KEY</span>
              <button
                className="tgs-remove-answer-key-btn"
                onClick={handleRemoveAnswerKey}
                title="Remove Answer Key"
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="tgs-answer-key-items">
              {step.answerKey.map((answer, answerIdx) => (
                <div key={answerIdx} className="tgs-answer-key-item">
                  <span className="tgs-answer-number">{answerIdx + 1}.</span>
                  <input
                    type="text"
                    className="tgs-answer-key-input"
                    value={answer.text}
                    onChange={e => handleUpdateAnswer(answerIdx, (e.target as HTMLInputElement).value)}
                    placeholder="Answer..."
                  />
                  <button
                    className="tgs-remove-answer-btn"
                    onClick={() => handleRemoveAnswer(answerIdx)}
                  >
                    <i className="ri-close-line" />
                  </button>
                </div>
              ))}
              <button
                className="tgs-add-answer-btn"
                onClick={handleAddAnswer}
              >
                <i className="ri-add-line" /> Add Answer
              </button>
            </div>
          </div>
        )}

        {/* Listening Script Box */}
        {step.listeningScript !== undefined && RichTextInput && (
          <div className="tgs-listening-script-box">
            <div className="tgs-listening-script-header">
              <span>Listening Script</span>
              <button 
                className="tgs-remove-btn"
                onClick={handleRemoveListeningScript}
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <RichTextInput
              value={step.listeningScript}
              onChange={(html: string) => updateStep({ listeningScript: html })}
              placeholder="Enter the listening script..."
              className="tgs-listening-script-input"
              singleLine={false}
            />
          </div>
        )}

        {/* Add buttons */}
        <div className="tgs-add-btns">
          {opts.showScripts && (
            <button
              className="tgs-add-script-btn"
              onClick={handleAddScript}
            >
              <i className="ri-chat-quote-line" /> Script
            </button>
          )}
          {opts.showTips && (
            <button
              className="tgs-add-tip-btn"
              onClick={handleAddTip}
            >
              <i className="ri-error-warning-line" /> Tip
            </button>
          )}
          {opts.showQuestions && !step.questions && (
            <button
              className="tgs-add-question-btn"
              onClick={handleAddQuestion}
            >
              <i className="ri-question-line" /> Question
            </button>
          )}
          {opts.showQuestions && step.questions && step.questions.length > 0 && (
            <button
              className="tgs-add-question-btn"
              onClick={handleAddQuestion}
            >
              <i className="ri-add-line" /> Add Question
            </button>
          )}
          {opts.showAnswerKey && !step.answerKey && (
            <button
              className="tgs-add-answer-key-btn"
              onClick={handleAddAnswerKey}
            >
              <i className="ri-file-list-3-line" /> Answer Key
            </button>
          )}
          {opts.showListeningScript && step.listeningScript === undefined && (
            <button
              className="tgs-add-listening-script-btn"
              onClick={handleAddListeningScript}
            >
              <i className="ri-file-text-line" /> Listening Script
            </button>
          )}
        </div>
      </div>

      {canRemove && onRemove && (
        <button 
          className="tgs-step-remove"
          onClick={onRemove}
        >
          <i className="ri-delete-bin-line" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// FULL TUTOR GUIDE COMPONENT
// ============================================================================

interface TutorGuideProps {
  title: string;
  duration?: string;
  steps: UniversalTutorStep[];
  onStepsChange: (steps: UniversalTutorStep[]) => void;
  onDurationChange?: (duration: string) => void;
  features?: TutorGuideFeatures;
  className?: string;
  RichTextInput?: any;
}

export function TutorGuide({
  title,
  duration,
  steps,
  onStepsChange,
  onDurationChange,
  features = DEFAULT_FEATURES,
  className = '',
  RichTextInput,
}: TutorGuideProps) {
  
  const handleStepChange = (stepIdx: number, updatedStep: UniversalTutorStep) => {
    const newSteps = [...steps];
    newSteps[stepIdx] = updatedStep;
    onStepsChange(newSteps);
  };

  const handleRemoveStep = (stepIdx: number) => {
    const newSteps = steps.filter((_, i) => i !== stepIdx);
    onStepsChange(newSteps);
  };

  const handleAddStep = () => {
    // For legacy mode, initialize with null script/tip
    if (features?.legacyMode) {
      onStepsChange([...steps, { instruction: '', script: null, tip: null }]);
    } else {
      onStepsChange([...steps, { instruction: '' }]);
    }
  };

  return (
    <div className={`tgs-tutor-guide ${className}`}>
      <div className="tgs-header">
        <span className="tgs-title">{title}</span>
        {duration !== undefined && onDurationChange && (
          <span className="tgs-duration">
            (<input
              type="text"
              className="tgs-duration-input"
              value={duration}
              onChange={e => onDurationChange((e.target as HTMLInputElement).value)}
              placeholder="3 minutes"
            />)
          </span>
        )}
      </div>

      <div className="tgs-steps">
        {steps.map((step, stepIdx) => (
          <TutorGuideStep
            key={stepIdx}
            step={step}
            stepIndex={stepIdx}
            onChange={(updatedStep) => handleStepChange(stepIdx, updatedStep)}
            onRemove={() => handleRemoveStep(stepIdx)}
            canRemove={steps.length > 1}
            features={features}
            RichTextInput={RichTextInput}
          />
        ))}

        <button className="tgs-add-step-btn" onClick={handleAddStep}>
          <i className="ri-add-line" /> Add Tutor Step
        </button>
      </div>
    </div>
  );
}

export default TutorGuide;
