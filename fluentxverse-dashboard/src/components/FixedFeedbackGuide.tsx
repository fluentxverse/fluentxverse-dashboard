import './FixedFeedbackGuide.css';

const rows = [
  {
    area: 'RANGE',
    meaning: 'Vocabulary',
    focus: 'Use words learned in the lesson accurately and avoid repeating the same basic word.',
    example: "You used 'welcoming' well. Next time, try 'helpful' instead of repeating 'nice'.",
  },
  {
    area: 'ACCURACY',
    meaning: 'Grammar',
    focus: 'Check verb forms, sentence structure, and time expressions.',
    example: "You said 'since two years.' Use 'for two years' to describe a duration.",
  },
  {
    area: 'FLUENCY',
    meaning: 'Smooth delivery',
    focus: 'Speak at a steady pace with fewer long pauses and fillers.',
    example: "Your idea was clear. Try a brief pause between thoughts instead of filling the silence with 'um'.",
  },
] as const;

export function FixedFeedbackGuide() {
  return (
    <section className="fixed-feedback-guide" aria-label="Personalized feedback guide">
      <h3>PERSONALIZED FEEDBACK GUIDE</h3>
      <table>
        <thead>
          <tr><th scope="col">Area</th><th scope="col">Focus on</th><th scope="col">Example feedback</th></tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.area}>
              <th scope="row"><strong>{row.area}</strong><span>{row.meaning}</span></th>
              <td>{row.focus}</td>
              <td>{row.example}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
