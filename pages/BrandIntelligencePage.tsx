import React, { useState, useEffect, useMemo } from 'react';
import { getBrandIntelligence, saveBrandIntelligence } from '../services/db';
import { awardExperience } from '../services/progressionEngine';
import { BrandIntelligence } from '../types';
import { logIntelligence } from '../services/intelligenceLog';

type BrandFieldKey = keyof Pick<BrandIntelligence,
  'mission' | 'vision' | 'values' | 'targetAudience' | 'uniqueValue' | 'goals' | 'tone' | 'keyMessages' | 'competitiveEdge' | 'constraints'
>;

const FIELD_SECTIONS: Array<{ title: string; description: string; fields: Array<{ label: string; key: BrandFieldKey; multiline?: boolean }> }> = [
  {
    title: 'Core Identity',
    description: 'Clarify why we exist and the principles the brand stands on.',
    fields: [
      { label: 'Mission Statement', key: 'mission', multiline: true },
      { label: 'Vision', key: 'vision', multiline: true },
      { label: 'Core Values', key: 'values', multiline: true }
    ]
  },
  {
    title: 'Market Position',
    description: 'Capture positioning for AI-led go-to-market decisions.',
    fields: [
      { label: 'Target Audience', key: 'targetAudience', multiline: true },
      { label: 'Unique Value Proposition', key: 'uniqueValue', multiline: true },
      { label: 'Competitive Edge', key: 'competitiveEdge', multiline: true }
    ]
  },
  {
    title: 'Communication',
    description: 'Tone, language, and messaging guardrails for output quality.',
    fields: [
      { label: 'Brand Tone & Voice', key: 'tone', multiline: true },
      { label: 'Key Messages', key: 'keyMessages', multiline: true }
    ]
  },
  {
    title: 'Strategy',
    description: 'Current initiatives, constraints, and operating rules.',
    fields: [
      { label: 'Current Goals & Priorities', key: 'goals', multiline: true },
      { label: 'Constraints & Boundaries', key: 'constraints', multiline: true }
    ]
  }
];

const BrandIntelligencePage: React.FC = () => {
  const [data, setData] = useState<BrandIntelligence | null>(null);
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<Record<BrandFieldKey, string>>({
    mission: '',
    vision: '',
    values: '',
    targetAudience: '',
    uniqueValue: '',
    goals: '',
    tone: '',
    keyMessages: '',
    competitiveEdge: '',
    constraints: ''
  });

  useEffect(() => {
    loadData();
    
    // Listen for brand data updates from background processing
    const handleBrandUpdate = () => {
      loadData();
    };
    window.addEventListener('brand-data-updated', handleBrandUpdate);
    
    return () => {
      window.removeEventListener('brand-data-updated', handleBrandUpdate);
    };
  }, []);

  const loadData = async () => {
    const brand = await getBrandIntelligence();
    if (brand) {
      setData(brand);
      setForm(prev => ({
        ...prev,
        mission: brand.mission || '',
        vision: brand.vision || '',
        values: brand.values || '',
        targetAudience: brand.targetAudience || '',
        uniqueValue: brand.uniqueValue || '',
        goals: brand.goals || '',
        tone: brand.tone || '',
        keyMessages: brand.keyMessages || '',
        competitiveEdge: brand.competitiveEdge || '',
        constraints: brand.constraints || ''
      }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const previous = data;
      const changedEntries = Object.entries(form).filter(([key, value]) => {
        const previousValue = previous ? (previous as Record<string, string>)[key] : '';
        return (value || '').trim() !== (previousValue || '').trim();
      });
      const updatedRecord = {
        ...form,
        updatedAt: Date.now()
      };

      await saveBrandIntelligence({
        ...updatedRecord
      });
      if (changedEntries.length > 0) {
        logIntelligence({
          source: 'brand_update',
          category: 'brand',
          summary: `Updated ${changedEntries.length} brand field${changedEntries.length === 1 ? '' : 's'}`,
          requestPayload: {
            changedFields: changedEntries.map(([key, value]) => ({ field: key, value }))
          },
          responsePayload: updatedRecord
        });
      }
      setEditing(false);
      await loadData();
      await awardExperience({
        branch: 'brand_authority',
        type: 'brand_update',
        baseXp: 60,
        actorIds: ['user'],
        context: 'system',
        metadata: { section: 'brand_intelligence' }
      }).catch(error => console.error('Failed to award brand XP:', error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (data) {
      setForm(prev => ({
        ...prev,
        mission: data.mission || '',
        vision: data.vision || '',
        values: data.values || '',
        targetAudience: data.targetAudience || '',
        uniqueValue: data.uniqueValue || '',
        goals: data.goals || '',
        tone: data.tone || '',
        keyMessages: data.keyMessages || '',
        competitiveEdge: data.competitiveEdge || '',
        constraints: data.constraints || ''
      }));
    }
    setEditing(false);
  };

  const filledStats = useMemo(() => {
    const entries = Object.entries(form) as Array<[BrandFieldKey, string]>;
    const total = entries.length;
    const filled = entries.filter(([, value]) => value.trim().length > 0).length;
    return {
      total,
      filled,
      percent: total === 0 ? 0 : Math.round((filled / total) * 100)
    };
  }, [form]);

  const Field = ({ label, field, multiline = false }: { label: string; field: BrandFieldKey; multiline?: boolean }) => {
    const value = form[field];
    const placeholder = `Capture ${label.toLowerCase()}...`;
    const baseInputClass = 'w-full bg-[#1E1F22] text-white rounded-lg px-3 py-2.5 border border-gray-800 focus:border-blue-500 focus:outline-none text-sm transition-colors';

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
          {!editing && !value.trim() && (
            <span className="text-[11px] text-gray-600">Add detail</span>
          )}
        </div>
        {editing ? (
          multiline ? (
            <textarea
              value={value}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              className={`${baseInputClass} resize-none min-h-[96px]`}
              placeholder={placeholder}
              rows={4}
            />
          ) : (
            <input
              value={value}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              className={baseInputClass}
              placeholder={placeholder}
            />
          )
        ) : (
          <div className="rounded-lg border border-gray-800/60 bg-[#1E1F22] px-4 py-3 text-sm text-gray-200 min-h-[64px] whitespace-pre-wrap">
            {value.trim() ? value : <span className="text-gray-600">Not set</span>}
          </div>
        )}
      </div>
    );
  };

  const updatedLabel = data?.updatedAt
    ? `Updated ${new Date(data.updatedAt).toLocaleString()}`
    : 'No brand data captured yet';

  return (
    <div className="h-full bg-[#26282B] text-white overflow-y-auto">
      <div className="max-w-6xl mx-auto py-4 md:py-8 px-3 md:px-8">
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">Brand Intelligence</h1>
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
                {filledStats.percent}% signal coverage
              </span>
            </div>
            <p className="text-sm text-gray-400">
              Keep your strategic guardrails explicit so every agent output stays on-brand.
            </p>
            <div className="text-xs text-gray-500">{updatedLabel}</div>
          </div>
          <div className="flex flex-wrap gap-3">
            {editing && (
              <button
                onClick={handleCancel}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:border-gray-600 hover:text-white"
                disabled={isSaving}
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => (editing ? handleSave() : setEditing(true))}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                editing
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-blue-600/80 hover:bg-blue-600'
              }`}
              disabled={editing && isSaving}
            >
              {editing ? (isSaving ? 'Saving…' : 'Save Brand Canon') : 'Edit Canon'}
            </button>
          </div>
        </header>

        <section className="mb-6 md:mb-10 grid gap-3 md:gap-4 rounded-2xl border border-gray-900 bg-[#1E1F22] p-3 md:p-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Coverage</div>
            <div className="text-2xl font-semibold">{filledStats.filled}/{filledStats.total}</div>
            <p className="text-xs text-gray-500">Fields with actionable guidance</p>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Canonical Pillars</div>
            <div className="text-sm text-gray-300">
              {form.values?.split('\n').filter(Boolean).slice(0, 3).join(', ') || 'Document core values to anchor tone and priorities.'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Audience Snapshot</div>
            <div className="text-sm text-gray-300">
              {form.targetAudience ? form.targetAudience : 'Spell out who we are building for and why they trust us.'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Differentiation Cue</div>
            <div className="text-sm text-gray-300">
              {form.uniqueValue ? form.uniqueValue : 'Codify the sharpest point of differentiation to guide messaging.'}
            </div>
          </div>
        </section>

        <div className="space-y-6 md:space-y-10">
          {FIELD_SECTIONS.map(section => (
            <section key={section.title} className="rounded-2xl border border-gray-900 bg-[#1B1C1F] p-3 md:p-6">
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-blue-300">{section.title}</h2>
                  <p className="text-sm text-gray-500">{section.description}</p>
                </div>
                {!editing && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {section.fields.reduce((count, field) => count + (form[field.key]?.trim() ? 1 : 0), 0)}/{section.fields.length} ready
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2">
                {section.fields.map(field => (
                  <Field key={field.key} label={field.label} field={field.key} multiline={field.multiline} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BrandIntelligencePage;
