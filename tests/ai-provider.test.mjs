import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAI,aiProvider} from '../server/ai-provider.mjs';

test('Gemini is selected explicitly or from its server secret; Groq stays compatible',()=>{
  const gemini=resolveAI({}, {IRON_AI_PROVIDER:'',GEMINI_API_KEY:'test-gemini'});
  assert.equal(gemini.name,'gemini');assert.equal(gemini.model,'gemini-3.5-flash');
  assert.equal(gemini.endpoint,'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  assert.equal(resolveAI({},{}).name,'groq');
  assert.equal(resolveAI({provider:'groq',apiKey:'test-groq'},{GEMINI_API_KEY:'other'}).name,'groq');
  assert.throws(()=>aiProvider('https://evil.example'),/gemini oder groq/);
});
