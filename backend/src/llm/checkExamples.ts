import 'dotenv/config';
import { identifySkills } from '../services/skillIdentification';

// quick manual check with the real gemini api: npm run llm:check
// uses the 3 examples from the brief, not part of the automated tests since it needs a key
const EXAMPLES = [
  {
    title:
      'As a visitor, I want to see a responsive homepage so that I can easily navigate on both desktop and mobile devices.',
    expected: ['Frontend'],
  },
  {
    title:
      'As a system administrator, I want audit logs of all data access and modifications so that I can ensure compliance with data protection regulations and investigate any security incidents.',
    expected: ['Backend'],
  },
  {
    title:
      'As a logged-in user, I want to update my profile information and upload a profile picture so that my account details are accurate and personalized.',
    expected: ['Backend', 'Frontend'],
  },
];

async function check() {
  const answers = await identifySkills(
    EXAMPLES.map((example) => example.title),
    ['Frontend', 'Backend'],
  );

  let allPassed = true;
  EXAMPLES.forEach((example, index) => {
    // sort so the order gemini lists skills in doesn't matter
    const actual = [...answers[index]].sort();
    const passed = actual.join() === example.expected.join();
    allPassed &&= passed;
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${actual.join(', ')} <- ${example.title}`);
  });

  if (!allPassed) {
    process.exit(1);
  }
}

check().catch((error) => {
  console.error('LLM check failed:', error.message);
  process.exit(1);
});
