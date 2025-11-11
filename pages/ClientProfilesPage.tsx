import React, { useState, useEffect, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { getAllClientProfiles, getClientProfile, saveClientProfile, deleteClientProfile } from '../services/db';
import { awardExperience } from '../services/progressionEngine';
import { ClientProfile } from '../types';
import { logIntelligence } from '../services/intelligenceLog';

type FieldKey = keyof Pick<ClientProfile,
  'name' | 'company' | 'industry' | 'role' | 'painPoints' | 'goals' | 'budget' | 'decisionProcess' |
  'personality' | 'communicationStyle' | 'objections' | 'opportunities' | 'history' | 'notes'
>;

const INITIAL_FORM: Record<FieldKey, string> = {
  name: '',
  company: '',
  industry: '',
  role: '',
  painPoints: '',
  goals: '',
  budget: '',
  decisionProcess: '',
  personality: '',
  communicationStyle: '',
  objections: '',
  opportunities: '',
  history: '',
  notes: ''
};

const ClientProfilesPage: React.FC = () => {
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<Record<FieldKey, string>>(INITIAL_FORM);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProfiles();
    
    // Listen for client data updates from background processing
    const handleClientUpdate = () => {
      loadProfiles();
    };
    window.addEventListener('client-data-updated', handleClientUpdate);
    
    return () => {
      window.removeEventListener('client-data-updated', handleClientUpdate);
    };
  }, []);

  const loadProfiles = async () => {
    const data = await getAllClientProfiles();
    setProfiles(data);
    if (data.length === 0) {
      setSelectedId(null);
      setForm(INITIAL_FORM);
      return;
    }

    if (!selectedId || !data.some(profile => profile.id === selectedId)) {
      const first = data[0];
      setSelectedId(first.id);
      await loadProfile(first.id, data);
    }
  };

  const loadProfile = async (id: string, cachedProfiles?: ClientProfile[]) => {
    const source = cachedProfiles?.find(profile => profile.id === id) ?? await getClientProfile(id);
    if (!source) return;
    setForm({
      name: source.name,
      company: source.company || '',
      industry: source.industry || '',
      role: source.role || '',
      painPoints: source.painPoints || '',
      goals: source.goals || '',
      budget: source.budget || '',
      decisionProcess: source.decisionProcess || '',
      personality: source.personality || '',
      communicationStyle: source.communicationStyle || '',
      objections: source.objections || '',
      opportunities: source.opportunities || '',
      history: source.history || '',
      notes: source.notes || ''
    });
  };

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    setEditing(false);
    await loadProfile(id, profiles);
  };

  const handleNew = () => {
    setSelectedId(null);
    setEditing(true);
    setForm(INITIAL_FORM);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setIsSaving(true);
    const now = Date.now();
    const existing = selectedId ? profiles.find(p => p.id === selectedId) : undefined;
    const changedEntries = (Object.entries(form) as Array<[FieldKey, string]>).filter(([key, value]) => {
      const previousValue = existing ? (existing as Record<string, string>)[key] : '';
      return (value || '').trim() !== (previousValue || '').trim();
    });
    const profile: ClientProfile = {
      id: selectedId || `client_${now}`,
      ...form,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now
    };

    await saveClientProfile(profile);
    if (changedEntries.length > 0) {
      logIntelligence({
        source: 'client_update',
        category: 'client',
        summary: `${existing ? 'Updated' : 'Created'} client profile: ${profile.name}`,
        requestPayload: {
          clientId: profile.id,
          changedFields: changedEntries.map(([field, value]) => ({ field, value }))
        },
        responsePayload: profile
      });
    }
    setEditing(false);
    setSelectedId(profile.id);
    setIsSaving(false);
    await loadProfiles();
    await awardExperience({
      branch: 'brand_authority',
      type: 'client_success',
      baseXp: 55,
      actorIds: ['user'],
      context: 'system',
      metadata: { clientId: profile.id }
    }).catch(error => console.error('Failed to award client XP:', error));
  };

  const handleDelete = async () => {
    if (!selectedId || !window.confirm('Delete this client profile?')) return;
    await deleteClientProfile(selectedId);
    setSelectedId(null);
    await loadProfiles();
  };

  const filteredProfiles = useMemo(() => {
    if (!search.trim()) return profiles;
    const term = search.toLowerCase();
    return profiles.filter(profile => {
      const haystack = [profile.name, profile.company, profile.industry, profile.role]
        .map(value => value?.toLowerCase() || '')
        .join(' ');
      return haystack.includes(term);
    });
  }, [profiles, search]);

  const activeProfile = selectedId ? profiles.find(profile => profile.id === selectedId) : null;

  const Field = ({ label, field, multiline = false }: { label: string; field: FieldKey; multiline?: boolean }) => {
    const value = form[field];
    const baseClass = 'w-full bg-[#141518] text-white rounded-lg border border-gray-800 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none transition-colors';
    const placeholder = `Add ${label.toLowerCase()}...`;
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</label>
        {editing ? (
          multiline ? (
            <textarea
              value={value}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              placeholder={placeholder}
              className={`${baseClass} resize-none min-h-[100px]`}
            />
          ) : (
            <input
              value={value}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              placeholder={placeholder}
              className={baseClass}
            />
          )
        ) : (
          <div className="rounded-lg border border-gray-800/60 bg-[#1E1F22] px-4 py-3 text-sm text-gray-200 min-h-[64px] whitespace-pre-wrap">
            {value.trim() ? value : <span className="text-gray-600">Not captured</span>}
          </div>
        )}
      </div>
    );
  };

  const renderSummaryChip = (label: string, value: string | undefined) => (
    <div className="rounded-lg border border-gray-800/80 bg-[#1A1C1E] px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-sm text-gray-200 line-clamp-2">
        {value?.trim() || '––'}
      </div>
    </div>
  );

  return (
    <div className="h-full bg-[#26282B] text-white flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-80 bg-[#1E1F22] border-b md:border-r md:border-b-0 border-gray-900 flex flex-col">
        <div className="border-b border-gray-900 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Client Roster</h2>
            <span className="text-xs text-gray-500">{profiles.length}</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients"
              className="w-full rounded-lg border border-gray-800 bg-[#141518] px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={handleNew}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold tracking-wide hover:bg-blue-700"
            >
              New
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {profiles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-800 bg-[#18191D] p-4 text-center text-sm text-gray-500">
              No client intelligence yet. Spin up the first profile to brief the team.
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-800 bg-[#18191D] p-4 text-center text-sm text-gray-500">
              No matches for “{search}”.
            </div>
          ) : (
            filteredProfiles.map(profile => {
              const isSelected = selectedId === profile.id;
              const subline = profile.company || profile.industry || profile.role;
              const lastUpdatedLabel = profile.updatedAt
                ? `${formatDistanceToNow(profile.updatedAt, { addSuffix: true })}`
                : 'No activity yet';
              return (
                <button
                  key={profile.id}
                  onClick={() => handleSelect(profile.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? 'border-blue-500/40 bg-blue-500/10'
                      : 'border-transparent bg-[#1A1C1F] hover:border-gray-800 hover:bg-[#202226]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm">{profile.name}</div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">{lastUpdatedLabel}</div>
                  </div>
                  {subline && <div className="mt-1 text-xs text-gray-400">{subline}</div>}
                  {profile.industry && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-gray-500">
                      <span className="rounded-full bg-[#16171A] px-2 py-1 text-gray-400">{profile.industry}</span>
                      {profile.role && <span className="rounded-full bg-[#16171A] px-2 py-1 text-gray-400">{profile.role}</span>}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedId || editing ? (
          <div className="mx-auto max-w-5xl space-y-4 md:space-y-8 p-3 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {editing && !selectedId ? 'New Client Profile' : form.name || 'Untitled Client'}
                  </h1>
                  {activeProfile?.company && (
                    <span className="rounded-full border border-gray-800 bg-[#16171A] px-3 py-1 text-xs font-medium text-gray-300">
                      {activeProfile.company}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  Give agents context to tailor outreach, negotiations, and delivery around this account.
                </p>
                {activeProfile?.updatedAt && (
                  <div className="text-xs text-gray-500">
                    Refreshed {formatDistanceToNow(activeProfile.updatedAt, { addSuffix: true })}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {selectedId && !editing && (
                  <button
                    onClick={handleDelete}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 hover:border-red-500/40"
                  >
                    Delete Client
                  </button>
                )}
                {editing && selectedId && (
                  <button
                    onClick={async () => {
                      await loadProfile(selectedId!);
                      setEditing(false);
                    }}
                    className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:border-gray-600"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => (editing ? handleSave() : setEditing(true))}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    editing
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-blue-600/80 hover:bg-blue-600'
                  }`}
                  disabled={editing && (!form.name.trim() || isSaving)}
                >
                  {editing ? (isSaving ? 'Saving…' : 'Save Client Signals') : 'Edit Profile'}
                </button>
              </div>
            </div>

            {!editing && (
              <div className="grid gap-4 rounded-2xl border border-gray-900 bg-[#1A1C1E] p-3 md:p-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {renderSummaryChip('Primary Goal', activeProfile?.goals)}
                {renderSummaryChip('Biggest Friction', activeProfile?.painPoints)}
                {renderSummaryChip('Buying Power', activeProfile?.budget)}
                {renderSummaryChip('Decision Motion', activeProfile?.decisionProcess)}
              </div>
            )}

            <div className="space-y-4 md:space-y-8">
              <section className="rounded-2xl border border-gray-900 bg-[#15171B] p-3 md:p-6">
                <h2 className="text-lg font-semibold text-blue-300">Identity</h2>
                <p className="text-sm text-gray-500">Baseline firmographic data and who we're interfacing with.</p>
                <div className="mt-4 md:mt-6 grid gap-5 grid-cols-1 md:grid-cols-2">
                  <Field label="Name" field="name" />
                  <Field label="Company" field="company" />
                  <Field label="Industry" field="industry" />
                  <Field label="Role / Title" field="role" />
                </div>
              </section>

              <section className="rounded-2xl border border-gray-900 bg-[#15171B] p-3 md:p-6">
                <h2 className="text-lg font-semibold text-blue-300">Business Intel</h2>
                <p className="text-sm text-gray-500">Why they buy, what success looks like, and the plays that work.</p>
                <div className="mt-6 grid gap-5">
                  <Field label="Pain Points & Challenges" field="painPoints" multiline />
                  <Field label="Goals & Objectives" field="goals" multiline />
                  <Field label="Budget & Resources" field="budget" multiline />
                  <Field label="Decision-Making Process" field="decisionProcess" multiline />
                </div>
              </section>

              <section className="rounded-2xl border border-gray-900 bg-[#15171B] p-3 md:p-6">
                <h2 className="text-lg font-semibold text-blue-300">Psychology</h2>
                <p className="text-sm text-gray-500">Social dynamics and emotional levers to personalize outreach.</p>
                <div className="mt-4 md:mt-6 grid gap-5 grid-cols-1 md:grid-cols-2">
                  <Field label="Personality & Motivations" field="personality" multiline />
                  <Field label="Communication Style" field="communicationStyle" multiline />
                  <Field label="Common Objections" field="objections" multiline />
                </div>
              </section>

              <section className="rounded-2xl border border-gray-900 bg-[#15171B] p-3 md:p-6">
                <h2 className="text-lg font-semibold text-blue-300">Moves & History</h2>
                <p className="text-sm text-gray-500">Notes to guide future engagements, campaigns, or upsell motions.</p>
                <div className="mt-6 grid gap-5">
                  <Field label="Opportunities & Angles" field="opportunities" multiline />
                  <Field label="Interaction History" field="history" multiline />
                  <Field label="Additional Notes" field="notes" multiline />
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            <div className="text-center space-y-4">
              <p>No client selected</p>
              <button
                onClick={handleNew}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold hover:bg-blue-700"
              >
                Create First Client
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientProfilesPage;
