import assert from 'node:assert/strict';
import test from 'node:test';
import { ASSISTANT_PROVIDERS, assistantProvider, modelDisplayName, providerModel } from '../src/assistantProviders.js';

test('both providers have their own key route and placeholder', () => {
  assert.deepEqual(Object.keys(ASSISTANT_PROVIDERS), ['openai', 'anthropic']);
  assert.equal(ASSISTANT_PROVIDERS.anthropic.keyRoute, '/api/profile/anthropic-key');
  assert.equal(ASSISTANT_PROVIDERS.openai.keyRoute, '/api/profile/openai-key');
  assert.match(ASSISTANT_PROVIDERS.anthropic.keyPlaceholder, /^sk-ant-/);
});

test('unknown provider ids fall back to OpenAI', () => {
  assert.equal(assistantProvider('gemini').id, 'openai');
  assert.equal(assistantProvider(undefined).id, 'openai');
});

test('model names are friendly when known and raw otherwise', () => {
  assert.equal(modelDisplayName('gpt-6.2-sol'), 'GPT-6.2 Sol');
  assert.equal(modelDisplayName('claude-sonnet-5-5'), 'Claude Sonnet 5.5');
  assert.equal(modelDisplayName('custom-model'), 'custom-model');
  assert.equal(providerModel({ models: { anthropic: 'claude-sonnet-5-5' } }, 'anthropic'), 'Claude Sonnet 5.5');
  assert.equal(providerModel({}, 'openai'), 'GPT-6.2 Sol');
});
