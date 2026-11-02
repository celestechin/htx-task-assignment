import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateJson } from '../src/llm/gemini';
import { identifySkills } from '../src/services/skillIdentification';

vi.mock('../src/llm/gemini', () => ({ generateJson: vi.fn() }));

const SKILLS = ['Frontend', 'Backend'];
const llm = vi.mocked(generateJson);

beforeEach(() => {
  llm.mockReset();
});

// checks how gemini's answer is validated, with the http call faked
// the real api is checked by hand with npm run llm:check
describe('identifySkills', () => {
  it('returns skills in title order even if the LLM answers out of order', async () => {
    llm.mockResolvedValue([
      { index: 1, skills: ['Backend'] },
      { index: 0, skills: ['Frontend', 'Backend'] },
    ]);

    expect(await identifySkills(['First', 'Second'], SKILLS)).toEqual([
      ['Frontend', 'Backend'],
      ['Backend'],
    ]);
    expect(llm).toHaveBeenCalledTimes(1);
  });

  it('sends every title and the available skills in one call', async () => {
    llm.mockResolvedValue([
      { index: 0, skills: ['Backend'] },
      { index: 1, skills: ['Backend'] },
    ]);

    await identifySkills(['First title', 'Second title'], SKILLS);

    const prompt = llm.mock.calls[0][0];
    expect(prompt).toContain('First title');
    expect(prompt).toContain('Second title');
    expect(prompt).toContain('["Frontend","Backend"]');
  });

  it('retries once when the call fails', async () => {
    llm.mockRejectedValueOnce(new Error('Gemini responded with status 429'));
    llm.mockResolvedValueOnce([{ index: 0, skills: ['Backend'] }]);

    expect(await identifySkills(['Title'], SKILLS)).toEqual([['Backend']]);
    expect(llm).toHaveBeenCalledTimes(2);
  });

  it('gives up after the second failure', async () => {
    llm.mockRejectedValue(new Error('Gemini responded with status 500'));

    await expect(identifySkills(['Title'], SKILLS)).rejects.toThrow('status 500');
    expect(llm).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a skill that does not exist', [{ index: 0, skills: ['Database'] }]],
    ['no skills', [{ index: 0, skills: [] }]],
    ['too few answers', []],
    ['an index out of range', [{ index: 5, skills: ['Backend'] }]],
    ['something that is not a list', { skills: ['Backend'] }],
  ])('rejects an answer with %s', async (_description, answer) => {
    llm.mockResolvedValue(answer);
    await expect(identifySkills(['Title'], SKILLS)).rejects.toThrow();
  });

  it('rejects two answers for the same task', async () => {
    llm.mockResolvedValue([
      { index: 0, skills: ['Backend'] },
      { index: 0, skills: ['Frontend'] },
    ]);
    await expect(identifySkills(['First', 'Second'], SKILLS)).rejects.toThrow('twice');
  });
});
