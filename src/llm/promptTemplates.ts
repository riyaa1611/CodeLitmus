export const QUESTION_GENERATION_SYSTEM = `You are CodeLitmus, a code understanding assessment engine. You generate quiz questions that test whether a developer truly understands their own code — not general programming knowledge.

Rules:
- Questions must be SPECIFIC to the provided code. Never ask generic programming questions.
- Focus on: edge cases, error scenarios, data flow, "what happens when X fails?", security implications, performance gotchas, implicit assumptions.
- Every question should be something the developer CANNOT answer correctly unless they genuinely understand the code.
- Generate questions at the specified difficulty level (1-5).
- Return ONLY valid JSON.`;

export function buildQuestionPrompt(params: {
  framework: string;
  language: string;
  fileDescription: string;
  filePath: string;
  startLine: number;
  codeBlock: string;
  relatedCode: string;
  count: number;
  difficulty: number;
}): string {
  return `Project context:
- Framework: ${params.framework}
- Language: ${params.language}
- This file handles: ${params.fileDescription}
- File path (USE THIS EXACTLY in codeReference.file): ${params.filePath}
- Code starts at line ${params.startLine} in that file

Code to quiz on (lines ${params.startLine}–${params.startLine + params.codeBlock.split('\n').length - 1}):
\`\`\`${params.language}
${params.codeBlock}
\`\`\`
${params.relatedCode ? `\nRelated code:\n\`\`\`${params.language}\n${params.relatedCode}\n\`\`\`` : ''}

Generate exactly ${params.count} multiple-choice questions about this code.
Difficulty level: ${params.difficulty}/5

IMPORTANT for codeReference:
- "file" MUST be exactly: "${params.filePath}" — do NOT invent or change this path
- "startLine" and "endLine" must be real line numbers from the code above (starting at line ${params.startLine})
- The correct option MUST be derivable from reading the actual code above — not from general knowledge

Return JSON in this exact format:
{
  "questions": [
    {
      "id": "q1",
      "question": "The actual question text",
      "difficulty": 3,
      "category": "error-handling",
      "codeReference": {
        "file": "${params.filePath}",
        "startLine": ${params.startLine},
        "endLine": ${params.startLine + 5}
      },
      "options": [
        {"label": "A", "text": "Option A text", "isCorrect": false},
        {"label": "B", "text": "Option B text", "isCorrect": true},
        {"label": "C", "text": "Option C text", "isCorrect": false},
        {"label": "D", "text": "Option D text", "isCorrect": false}
      ],
      "explanation": "Detailed explanation referencing specific lines of the provided code",
      "dangerNote": "Real-world consequence if developer gets this wrong"
    }
  ]
}`;
}

export function buildAnswerEvalPrompt(params: {
  question: string;
  code: string;
  language: string;
  userAnswer: string;
  correctAnswer: string;
  wasCorrect: boolean;
}): string {
  return `A developer was quizzed on their own code.

Question: "${params.question}"
${params.code ? `\nRelevant code:\n\`\`\`${params.language}\n${params.code}\n\`\`\`` : ''}
Their answer: "${params.userAnswer}"
Correct answer: "${params.correctAnswer}"
Result: ${params.wasCorrect ? 'CORRECT' : 'INCORRECT'}

Write specific, helpful feedback (2-3 sentences) explaining ${params.wasCorrect ? 'why their answer is correct and what to watch out for' : 'what the correct behavior is and why their answer was wrong'}.
Reference the actual code where relevant.

Return JSON:
{
  "understandingDepth": "${params.wasCorrect ? 'moderate" | "deep' : 'surface" | "moderate'}",
  "feedback": "Specific feedback referencing the code",
  "conceptGap": ${params.wasCorrect ? 'null' : '"The specific concept they misunderstood"'}
}`;
}

export function buildLearningPathPrompt(dangerZonesSummary: string): string {
  return `Given these danger zones in the codebase:
${dangerZonesSummary}

Generate a prioritized learning path. For each item, specify:
- Which file to read
- Which specific lines to focus on
- What concept to understand
- Why it matters (real-world consequence of not understanding it)

Return JSON array ordered by priority:
{
  "items": [
    {
      "file": "path/to/file.ts",
      "startLine": 1,
      "endLine": 50,
      "concept": "What to understand",
      "whyItMatters": "Real-world consequence",
      "priority": 1
    }
  ]
}`;
}
