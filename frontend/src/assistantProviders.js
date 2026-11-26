// Model providers the backend can send assistant requests to. Ids match the backend's
// AssistantProvider enum; the backend owns which model each provider uses.
export const ASSISTANT_PROVIDERS = {
  openai: { id: 'openai', name: 'OpenAI', keyTitle: 'OpenAI API key', keyPlaceholder: 'sk-…', keyRoute: '/api/profile/openai-key', defaultModel: 'gpt-6.2-sol' },
  anthropic: { id: 'anthropic', name: 'Anthropic', keyTitle: 'Anthropic API key', keyPlaceholder: 'sk-ant-…', keyRoute: '/api/profile/anthropic-key', defaultModel: 'claude-sonnet-5-5' },
};

export const DEFAULT_ASSISTANT_PROVIDER = 'openai';

export function assistantProvider(id) {
  return ASSISTANT_PROVIDERS[id] || ASSISTANT_PROVIDERS[DEFAULT_ASSISTANT_PROVIDER];
}

const kModelNames = {
  'gpt-6.2-sol': 'GPT-6.2 Sol',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
};

/** Friendly name for a model id; unknown ids (custom OPENAI_MODEL/ANTHROPIC_MODEL values) are shown as-is. */
export function modelDisplayName(modelId) {
  if (!modelId) return '';
  return kModelNames[modelId] || modelId;
}

/** The model a provider runs for this profile, as reported by /api/profile/settings. */
export function providerModel(settings, id) {
  return modelDisplayName(settings?.models?.[id] || assistantProvider(id).defaultModel);
}
