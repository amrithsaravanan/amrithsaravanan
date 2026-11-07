import type { BankFile, Question } from '../types';

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  bank?: BankFile;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function validateBank(raw: unknown): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['The file must contain a single JSON object.'], warnings };

  if (!isStr(raw.schemaVersion)) errors.push('"schemaVersion" is required (for example "1.0").');
  else if (raw.schemaVersion !== '1.0') errors.push(`Unsupported schemaVersion "${raw.schemaVersion}". Supported: "1.0".`);
  if (!isStr(raw.setId)) errors.push('"setId" is required (a unique text identifier).');
  if (!isStr(raw.title)) errors.push('"title" is required.');
  if (!isStr(raw.subject)) errors.push('"subject" is required.');
  if (!isNum(raw.durationMinutes) || raw.durationMinutes <= 0) errors.push('"durationMinutes" must be a number greater than 0.');

  let negBank = 0;
  if (raw.negativeMarking !== undefined) {
    if (!isNum(raw.negativeMarking) || raw.negativeMarking < 0) errors.push('"negativeMarking" must be a number ≥ 0 (marks deducted per wrong answer).');
    else negBank = raw.negativeMarking;
  }
  if (raw.totalMarks !== undefined && (!isNum(raw.totalMarks) || raw.totalMarks <= 0)) errors.push('"totalMarks" must be a number greater than 0.');

  let sections: string[] = [];
  if (!Array.isArray(raw.sections) || raw.sections.length === 0) errors.push('"sections" must be a non-empty array of section names.');
  else if (raw.sections.some((s) => !isStr(s))) errors.push('Every entry in "sections" must be non-empty text.');
  else {
    sections = raw.sections as string[];
    if (new Set(sections).size !== sections.length) errors.push('"sections" contains duplicate names.');
  }

  const questions: Question[] = [];
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) errors.push('"questions" must be a non-empty array.');
  else {
    const seen = new Set<string>();
    raw.questions.forEach((q, i) => {
      const label = `Question ${i + 1}${isObj(q) && isStr(q.id) ? ` (${q.id})` : ''}`;
      const err = (m: string) => errors.push(`${label}: ${m}`);
      if (!isObj(q)) return err('must be an object.');
      if (!isStr(q.id)) err('"id" is required.');
      else if (seen.has(q.id)) err(`duplicate question id "${q.id}".`);
      else seen.add(q.id);
      if (!isStr(q.section)) err('"section" is required.');
      else if (sections.length && !sections.includes(q.section)) err(`section "${q.section}" is not listed in "sections".`);
      if (q.type !== 'single_choice') err('"type" must be "single_choice" (the only supported type).');
      if (!isStr(q.question)) err('"question" text is required.');
      if (q.difficulty !== undefined && !['easy', 'medium', 'hard'].includes(String(q.difficulty))) warnings.push(`${label}: difficulty "${String(q.difficulty)}" is not easy/medium/hard.`);

      let optIds: string[] = [];
      if (!Array.isArray(q.options) || q.options.length < 2) err('needs at least 2 options.');
      else if (q.options.length > 10) err('has more than 10 options.');
      else if (!q.options.every((o) => isObj(o) && isStr(o.id) && isStr(o.text))) err('every option needs a non-empty "id" and "text".');
      else {
        optIds = (q.options as { id: string }[]).map((o) => o.id);
        if (new Set(optIds).size !== optIds.length) err('duplicate option ids.');
      }
      if (!isStr(q.correctAnswer)) err('"correctAnswer" is required.');
      else if (optIds.length && !optIds.includes(q.correctAnswer)) err(`correctAnswer "${q.correctAnswer}" does not match any option id.`);
      if (q.marks !== undefined && (!isNum(q.marks) || q.marks <= 0)) err('"marks" must be a number greater than 0.');
      if (q.negativeMarks !== undefined && (!isNum(q.negativeMarks) || q.negativeMarks < 0)) err('"negativeMarks" must be a number ≥ 0.');
      if (q.explanation !== undefined && typeof q.explanation !== 'string') err('"explanation" must be text.');
      if (q.tags !== undefined && (!Array.isArray(q.tags) || q.tags.some((t) => typeof t !== 'string'))) err('"tags" must be an array of text.');
      if (!q.explanation) warnings.push(`${label}: no explanation provided.`);

      questions.push({
        id: String(q.id), section: String(q.section), type: 'single_choice',
        difficulty: q.difficulty as string | undefined,
        question: String(q.question),
        options: Array.isArray(q.options) ? (q.options as { id: string; text: string }[]).map((o) => ({ id: String(o?.id), text: String(o?.text) })) : [],
        correctAnswer: String(q.correctAnswer),
        marks: isNum(q.marks) ? q.marks : 1,
        negativeMarks: isNum(q.negativeMarks) ? q.negativeMarks : negBank,
        explanation: typeof q.explanation === 'string' ? q.explanation : undefined,
        tags: Array.isArray(q.tags) ? (q.tags as string[]) : undefined,
      });
    });
  }

  if (errors.length) return { ok: false, errors, warnings };

  const sum = questions.reduce((a, q) => a + q.marks, 0);
  const total = isNum(raw.totalMarks) ? raw.totalMarks : sum;
  if (Math.abs(total - sum) > 1e-9) warnings.push(`"totalMarks" is ${total} but question marks add up to ${sum}. The calculated value (${sum}) is used.`);
  sections.forEach((s) => { if (!questions.some((q) => q.section === s)) warnings.push(`Section "${s}" has no questions.`); });

  return {
    ok: true, errors, warnings,
    bank: {
      schemaVersion: '1.0', setId: String(raw.setId), title: String(raw.title), subject: String(raw.subject),
      description: typeof raw.description === 'string' ? raw.description : undefined,
      durationMinutes: raw.durationMinutes as number, totalMarks: sum, negativeMarking: negBank, sections, questions,
    },
  };
}
