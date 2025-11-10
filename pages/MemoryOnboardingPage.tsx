import React, { useEffect, useMemo, useState } from 'react';
import { addMemory } from '../services/db';
import { generateMemoryFromChunk, evaluateMemoryRelevance } from '../services/aiService';
import { MemoryGenerationResult, MemoryEvaluationBreakdown } from '../types';
import { PROVIDERS, GOOGLE_MODELS, OPENAI_MODELS, OPENROUTER_MODELS } from '../services/aiService';
import { RefreshIcon, TrashIcon, SaveIcon } from '../components/icons/Icons';

interface OnboardingSettings {
    provider: 'google' | 'openai' | 'openrouter';
    model: string;
    chunkSize: number;
    overlap: number;
    apiKeys: string[];
}

const SETTINGS_KEY = 'memoryOnboardingSettings';

const defaultSettings: OnboardingSettings = {
    provider: 'openai',
    model: OPENAI_MODELS[0],
    chunkSize: 2200,
    overlap: 200,
    apiKeys: []
};

const providerModels: Record<string, readonly string[]> = {
    google: GOOGLE_MODELS,
    openai: OPENAI_MODELS,
    openrouter: OPENROUTER_MODELS
};

interface ChunkProgress {
    index: number;
    total: number;
    status: 'pending' | 'running' | 'completed' | 'error';
    summary?: string;
    evaluation?: MemoryEvaluationBreakdown;
    error?: string;
}

const chunkText = (text: string, size: number, overlap: number) => {
    const chunks: string[] = [];
    const sanitized = text.replace(/\r\n/g, '\n');
    if (size <= 0) return chunks;
    let start = 0;
    const step = Math.max(1, size - Math.max(0, Math.min(overlap, size - 1)));
    while (start < sanitized.length) {
        const end = Math.min(sanitized.length, start + size);
        const chunk = sanitized.slice(start, end).trim();
        if (chunk) {
            chunks.push(chunk);
        }
        if (end >= sanitized.length) break;
        start += step;
    }
    return chunks;
};

const MemoryOnboardingPage: React.FC = () => {
    const [settings, setSettings] = useState<OnboardingSettings>(defaultSettings);
    const [sourceText, setSourceText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<ChunkProgress[]>([]);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(SETTINGS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as OnboardingSettings;
                if (parsed && typeof parsed === 'object') {
                    setSettings({ ...defaultSettings, ...parsed });
                }
            }
        } catch (error) {
            console.error('Failed to load onboarding settings:', error);
        }
    }, []);

    useEffect(() => {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }, [settings]);

    const models = providerModels[settings.provider] || [];

    useEffect(() => {
        if (!models.includes(settings.model)) {
            setSettings(prev => ({ ...prev, model: models[0] || prev.model }));
        }
    }, [settings.provider]);

    const handleFileUpload = async (file: File) => {
        const text = await file.text();
        setSourceText(prev => (prev ? `${prev}\n\n${text}` : text));
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) {
            handleFileUpload(file);
        }
    };

    const chunks = useMemo(() => {
        if (!sourceText.trim()) return [];
        return chunkText(sourceText, settings.chunkSize, settings.overlap);
    }, [sourceText, settings.chunkSize, settings.overlap]);

    const handleProcess = async () => {
        if (!chunks.length) {
            setStatusMessage('Add text or upload a file before processing.');
            return;
        }
        const keys = settings.apiKeys.map(key => key.trim()).filter(Boolean);
        if ((settings.provider === 'openai' || settings.provider === 'openrouter') && keys.length === 0) {
            setStatusMessage('Add at least one API key for the selected provider.');
            return;
        }

        setIsProcessing(true);
        setStatusMessage(null);
        const initialProgress: ChunkProgress[] = chunks.map((_, index) => ({
            index,
            total: chunks.length,
            status: 'pending'
        }));
        setProgress(initialProgress);

        try {
            const workers = (keys.length > 0 ? keys : [undefined]).map((key, workerIndex) => (async () => {
                for (let i = workerIndex; i < chunks.length; i += (keys.length > 0 ? keys.length : 1)) {
                    setProgress(prev => prev.map(step => (step.index === i ? { ...step, status: 'running' } : step)));
                    const chunk = chunks[i];
                    try {
                        const generation: MemoryGenerationResult = await generateMemoryFromChunk(chunk, {
                            provider: settings.provider,
                            model: settings.model,
                            apiKey: key,
                            temperature: 0.15
                        });

                        let evaluation: MemoryEvaluationBreakdown | null = null;
                        try {
                            evaluation = await evaluateMemoryRelevance(generation.summary, {
                                provider: settings.provider,
                                model: settings.model,
                                apiKey: key,
                                temperature: 0.1
                            });
                        } catch (evaluationError) {
                            console.warn('Memory evaluation failed:', evaluationError);
                        }

                        await addMemory({
                            timestamp: Date.now(),
                            summary: generation.summary,
                            tags: generation.tags,
                            conversation: chunk,
                            relevance: Math.max(0, Math.min(10, Math.round(evaluation?.finalScore ?? generation.relevance)))
                        });

                        setProgress(prev => prev.map(step => (
                            step.index === i ? { ...step, status: 'completed', summary: generation.summary, evaluation: evaluation || undefined } : step
                        )));
                    } catch (error) {
                        console.error('Failed to process chunk:', error);
                        setProgress(prev => prev.map(step => (
                            step.index === i ? { ...step, status: 'error', error: (error as Error).message } : step
                        )));
                    }
                }
            })());

            await Promise.all(workers);
            setStatusMessage('Onboarding complete. Memories saved.');
        } finally {
            setIsProcessing(false);
            setTimeout(() => setStatusMessage(null), 4000);
        }
    };

    const handleClear = () => {
        setSourceText('');
        setProgress([]);
        setStatusMessage(null);
    };

    return (
        <div className="p-8 flex flex-col gap-6 h-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold text-gray-100">Memory Onboarding</h1>
                    <p className="text-sm text-gray-400">
                        Split long docs across multiple API keys, auto-summarize each chunk, and store them as ranked memories in seconds.
                    </p>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                    {statusMessage && <span className="text-blue-300">{statusMessage}</span>}
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-600 bg-[#1e1f20] text-gray-300 hover:bg-gray-700"
                    >
                        <TrashIcon className="h-4 w-4" /> Clear input
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[#1e1f20] border border-gray-700 rounded-lg p-6">
                    <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Source Text</label>
                    <div
                        onDrop={handleDrop}
                        onDragOver={event => event.preventDefault()}
                        className="border border-dashed border-gray-600 rounded-lg p-4 bg-[#141517] text-sm text-gray-400 mb-3"
                    >
                        Drag & drop .txt or .md files here, or paste text below.
                    </div>
                    <textarea
                        value={sourceText}
                        onChange={e => setSourceText(e.target.value)}
                        rows={12}
                        placeholder="Paste source material here..."
                        className="w-full bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="mt-2 text-xs text-gray-500">Chunks prepared: {chunks.length}</div>
                </div>

                <div className="bg-[#1e1f20] border border-gray-700 rounded-lg p-6 space-y-4">
                    <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Provider</label>
                        <select
                            value={settings.provider}
                            onChange={e => setSettings(prev => ({ ...prev, provider: e.target.value as OnboardingSettings['provider'] }))}
                            className="w-full bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {PROVIDERS.map(provider => (
                                <option key={provider} value={provider}>{provider.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Model</label>
                        <select
                            value={settings.model}
                            onChange={e => setSettings(prev => ({ ...prev, model: e.target.value }))}
                            className="w-full bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {models.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    </div>

                    {(settings.provider === 'openai' || settings.provider === 'openrouter') && (
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">API Keys (one per line)</label>
                            <textarea
                                value={settings.apiKeys.join('\n')}
                                onChange={e => setSettings(prev => ({ ...prev, apiKeys: e.target.value.split('\n').map(key => key.trim()).filter(Boolean) }))}
                                rows={4}
                                className="w-full bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="sk-..."
                            />
                            <p className="text-[11px] text-gray-500 mt-1">Keys stay local in your browser. They are rotated across chunks for parallel ingestion.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Chunk Size (characters)</label>
                            <input
                                type="number"
                                min={200}
                                max={8000}
                                value={settings.chunkSize}
                                onChange={e => setSettings(prev => ({ ...prev, chunkSize: Number(e.target.value) }))}
                                className="w-full bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Overlap</label>
                            <input
                                type="number"
                                min={0}
                                max={4000}
                                value={settings.overlap}
                                onChange={e => setSettings(prev => ({ ...prev, overlap: Number(e.target.value) }))}
                                className="w-full bg-[#2a2b2c] text-gray-200 rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleProcess}
                        disabled={isProcessing || chunks.length === 0}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold ${isProcessing || chunks.length === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                    >
                        {isProcessing ? 'Onboarding...' : 'Start Onboarding'}
                    </button>
                    <p className="text-[11px] text-gray-500">Chunks are stored as memories with AI-generated summaries and relevance grades.</p>
                </div>
            </div>

            <div className="flex-1 bg-[#1e1f20] border border-gray-700 rounded-lg p-6 overflow-y-auto">
                <h2 className="text-lg font-semibold text-gray-200 mb-4">Progress</h2>
                {progress.length === 0 ? (
                    <p className="text-gray-500 text-sm">Queue memories to see real-time onboarding progress.</p>
                ) : (
                    <ul className="space-y-3 text-sm">
                        {progress.map(item => (
                            <li
                                key={item.index}
                                className={`rounded-lg border px-4 py-3 ${
                                    item.status === 'completed' ? 'border-green-600/40 bg-green-900/10 text-green-200' :
                                    item.status === 'error' ? 'border-red-600/40 bg-red-900/10 text-red-200' :
                                    item.status === 'running' ? 'border-blue-600/40 bg-blue-900/10 text-blue-200' :
                                    'border-gray-700 bg-[#141517] text-gray-300'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span>Chunk {item.index + 1} / {item.total}</span>
                                    <span className="uppercase tracking-wider text-xs">{item.status}</span>
                                </div>
                                {item.summary && (
                                    <div className="mt-2 space-y-2">
                                        <p className="text-xs text-gray-200">{item.summary}</p>
                                        {item.evaluation && (
                                            <div className="rounded-md border border-blue-600/40 bg-blue-900/10 p-2 text-[11px] text-blue-100 space-y-1">
                                                <div className="flex justify-between"><span>Final</span><span>{item.evaluation.finalScore.toFixed(1)}</span></div>
                                                <div className="grid grid-cols-2 gap-1">
                                                    <span>Novelty: {item.evaluation.dimensions.novelty.toFixed(1)}</span>
                                                    <span>Coaching: {item.evaluation.dimensions.coachingValue.toFixed(1)}</span>
                                                    <span>Operational: {item.evaluation.dimensions.operationalImpact.toFixed(1)}</span>
                                                    <span>Emotional: {item.evaluation.dimensions.emotionalSignal.toFixed(1)}</span>
                                                </div>
                                                <p className="text-blue-200/80">{item.evaluation.justification}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {item.error && (
                                    <p className="mt-2 text-xs text-red-200">{item.error}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default MemoryOnboardingPage;
