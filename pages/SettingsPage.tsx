import React, { useState } from 'react';
import {
    loadAiSettings,
    saveAiSettings,
    AiSettings,
    AdmonitionVisibility,
    GOOGLE_MODELS,
    OPENAI_MODELS,
    OPENROUTER_MODELS,
    AIProvider
} from '../services/aiService';

interface ProviderConfig {
    id: AIProvider;
    title: string;
    description: string;
    apiKeyField: keyof Pick<AiSettings, 'googleApiKey' | 'openaiApiKey' | 'openRouterApiKey'>;
    modelField: keyof Pick<AiSettings, 'googleModel' | 'openaiModel' | 'openRouterModel'>;
    models: readonly string[];
    helperText: string;
}

const ADMONITION_OPTIONS: Array<{ key: keyof AdmonitionVisibility; label: string; description: string }> = [
  { key: 'preflection', label: 'Preflection', description: 'Show the reasoning primer before the agent responds.' },
  { key: 'monologue', label: 'Internal Monologue', description: 'Display the agent’s inner voice when available.' },
  { key: 'stageDirections', label: 'Stage Directions', description: 'Surface stage directions or situational cues.' },
  { key: 'memory', label: 'Memory', description: 'Reveal saved memory summaries and tags.' },
  { key: 'tasks', label: 'Task List', description: 'Show generated task lists for the response.' },
  { key: 'audit', label: 'Task Audit', description: 'Show completion audit for generated tasks.' },
  { key: 'postProcessing', label: 'Post-processing', description: 'Expose sentiment, subtext, and other post-processing callouts.' }
];

const PROVIDER_CONFIGS: ProviderConfig[] = [
    {
        id: 'google',
        title: 'Google Gemini',
        description: 'Use Gemini via Google AI Studio.',
        apiKeyField: 'googleApiKey',
        modelField: 'googleModel',
        models: GOOGLE_MODELS,
        helperText: 'Create a Gemini API key in Google AI Studio and paste it here.'
    },
    {
        id: 'openai',
        title: 'OpenAI',
        description: 'Use OpenAI chat completions.',
        apiKeyField: 'openaiApiKey',
        modelField: 'openaiModel',
        models: OPENAI_MODELS,
        helperText: 'Use a standard OpenAI API key with access to the selected model.'
    },
    {
        id: 'openrouter',
        title: 'OpenRouter',
        description: 'Route through OpenRouter.io.',
        apiKeyField: 'openRouterApiKey',
        modelField: 'openRouterModel',
        models: OPENROUTER_MODELS,
        helperText: 'Generate an OpenRouter API key and select any supported upstream model.'
    }
];

const SettingsPage: React.FC = () => {
  const [systemInstruction, setSystemInstruction] = useState(
    () => localStorage.getItem('systemInstruction') || ''
  );
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => loadAiSettings());
  const [instructionSaved, setInstructionSaved] = useState(false);
  const [aiSettingsSaved, setAiSettingsSaved] = useState(false);

  const handleSaveInstruction = () => {
    localStorage.setItem('systemInstruction', systemInstruction);
    setInstructionSaved(true);
    setTimeout(() => setInstructionSaved(false), 3000);
  };

  const handleProviderChange = (provider: AIProvider) => {
    setAiSettings(prev => ({ ...prev, provider }));
  };

  const handleModelChange = (
    field: ProviderConfig['modelField'],
    value: string
  ) => {
    setAiSettings(prev => ({ ...prev, [field]: value } as AiSettings));
  };

  const handleApiKeyChange = (
    field: ProviderConfig['apiKeyField'],
    value: string
  ) => {
    setAiSettings(prev => ({ ...prev, [field]: value } as AiSettings));
  };


  const handleToggleAdmonition = (key: keyof AdmonitionVisibility) => {
    setAiSettings(prev => ({
      ...prev,
      admonitionVisibility: {
        ...prev.admonitionVisibility,
        [key]: !prev.admonitionVisibility[key]
      }
    }));
  };

  const handleSaveAiSettings = () => {
    saveAiSettings(aiSettings);
    setAiSettingsSaved(true);
    setTimeout(() => setAiSettingsSaved(false), 3000);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold text-gray-200 mb-8">Settings</h1>
      
      <div className="space-y-8">
        {/* System Instruction Section */}
        <div className="bg-[#1e1f20] p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-200">
                Custom System Instruction
            </h3>
            <p className="text-sm text-gray-400 mt-1 mb-4">
                Define the base behavior and personality for the agent. This will be used in every conversation.
            </p>
            <textarea
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                placeholder="Define the agent's core personality. e.g., 'You are a historian specializing in ancient Rome.' The agent will automatically be instructed on how to use its memory systems."
                className="w-full h-32 bg-[#2a2b2c] text-gray-300 rounded-lg p-3 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            <button
                onClick={handleSaveInstruction}
                className="mt-4 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
                Save Instruction
            </button>
            {instructionSaved && (
                <p className="mt-2 text-sm text-green-400">Instruction saved.</p>
            )}
        </div>

        <div className="bg-[#1e1f20] p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-200">
                AI Provider Configuration
            </h3>
            <p className="text-sm text-gray-400 mt-1 mb-4">
                Choose which provider to use at runtime and configure API keys and default models. All keys are stored locally in your browser so you can bring your own credentials.
            </p>

            <label className="block text-sm font-medium text-gray-300 mb-2">
                Active Provider
            </label>
            <select
                value={aiSettings.provider}
                onChange={(event) => handleProviderChange(event.target.value as AIProvider)}
                className="w-full bg-[#2a2b2c] text-gray-300 rounded-lg p-3 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
            >
                {PROVIDER_CONFIGS.map(config => (
                    <option key={config.id} value={config.id}>
                        {config.title}
                    </option>
                ))}
            </select>

            <div className="space-y-6">
                {PROVIDER_CONFIGS.map(config => {
                    const isActive = aiSettings.provider === config.id;
                    const apiKeyValue = aiSettings[config.apiKeyField];
                    const modelValue = aiSettings[config.modelField];

                    return (
                        <div
                            key={config.id}
                            className={`p-4 rounded-lg border ${isActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-[#1a1b1c]'}`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h4 className="text-md font-semibold text-gray-200">{config.title}</h4>
                                    <p className="text-sm text-gray-400">{config.description}</p>
                                </div>
                                {isActive && (
                                    <span className="text-xs uppercase tracking-wide text-blue-300 font-semibold">
                                        Active
                                    </span>
                                )}
                            </div>

                            <label className="block text-xs font-medium text-gray-400 uppercase mb-1">
                                API Key
                            </label>
                            <input
                                type="password"
                                value={apiKeyValue}
                                onChange={(event) => handleApiKeyChange(config.apiKeyField, event.target.value)}
                                placeholder="Enter API key"
                                className="w-full bg-[#2a2b2c] text-gray-300 rounded-lg p-3 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                            />
                            <p className="text-xs text-gray-500 mb-4">{config.helperText}</p>

                            <label className="block text-xs font-medium text-gray-400 uppercase mb-1">
                                Default Model
                            </label>
                            <select
                                value={modelValue}
                                onChange={(event) => handleModelChange(config.modelField, event.target.value)}
                                className="w-full bg-[#2a2b2c] text-gray-300 rounded-lg p-3 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {config.models.map(model => (
                                    <option key={model} value={model}>
                                        {model}
                                    </option>
                                ))}
                            </select>
                        </div>
                    );
                })}
            </div>

        <div className="bg-[#1e1f20] p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-200">Transparency Controls</h3>
            <p className="text-sm text-gray-400 mt-1 mb-4">Choose which markdown callouts (admonitions) appear in the chat transcript when the agent responds.</p>
            <div className="space-y-3">
                {ADMONITION_OPTIONS.map(option => (
                    <label key={option.key as string} className="flex items-start gap-3 bg-[#161719] border border-gray-700 rounded-lg p-3 hover:border-blue-500/40 transition-colors">
                        <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 text-blue-500 focus:ring-blue-500"
                            checked={aiSettings.admonitionVisibility[option.key]}
                            onChange={() => handleToggleAdmonition(option.key)}
                        />
                        <div>
                            <div className="text-sm font-semibold text-gray-200">{option.label}</div>
                            <p className="text-xs text-gray-500">{option.description}</p>
                        </div>
                    </label>
                ))}
            </div>
        </div>

            <button

                onClick={handleSaveAiSettings}
                className="mt-6 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
                Save AI Settings
            </button>
            {aiSettingsSaved && (
                <p className="mt-2 text-sm text-green-400">AI settings saved.</p>
            )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
