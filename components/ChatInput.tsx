import React, { useState, useEffect, useMemo } from 'react';
import {
  SendIcon,
  PreflectionIcon,
  MemoryIcon,
  TaskListIcon,
  AuditIcon,
  StageIcon,
  MonologueIcon,
  SpatialIcon,
  TemporalIcon,
  BiasIcon,
  HistoryIcon,
  GradeIcon,
  InsightIcon,
  TraceIcon,
  RefreshIcon,
  BirdIcon
} from './icons/Icons';
import { PerformerProfile } from '../types';

export interface ActiveFeatures {
  usePreflection: boolean;
  useMemory: boolean;
  useTaskList: boolean;
  useAudit: boolean;
  useStageDirections: boolean;
  useMonologue: boolean;
  usePromptRewrite: boolean;
}

interface ChatInputProps {
  onSendMessage: (
    message: string,
    features: ActiveFeatures,
    image: File | null,
    speakerPersonaId: string | null
  ) => void;
  isLoading: boolean;
  performers: PerformerProfile[];
  activePerformerIds: string[];
  onTogglePerformer: (id: string) => void;
  isCoreAgentMuted: boolean;
  onToggleCoreAgent: () => void;
  unlockedToggleFeatures: Set<string>;
}

const performerIconMap: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  stage: StageIcon,
  monologue: MonologueIcon,
  spatial: SpatialIcon,
  temporal: TemporalIcon,
  bias: BiasIcon,
  history: HistoryIcon,
  insight: InsightIcon,
  reasoning: TraceIcon,
  evaluator: GradeIcon
};

const defaultFeatures: ActiveFeatures = {
  usePreflection: false,
  useMemory: true,
  useTaskList: false,
  useAudit: false,
  useStageDirections: false,
  useMonologue: false,
  usePromptRewrite: false
};

const ToolbarButton: React.FC<{
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  tooltip: string;
  badge?: string | null;
  emphasis?: 'primary' | 'warning';
}> = ({ isActive, onClick, disabled = false, children, tooltip, badge = null, emphasis = 'primary' }) => (
  <div className="relative group">
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded-md transition-all duration-200 relative transform ${
        isActive
          ? emphasis === 'warning'
            ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30 scale-105'
            : 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105'
          : 'text-gray-400 hover:bg-gray-700/50 hover:text-white hover:scale-110 active:scale-95'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-label={tooltip}
    >
      {children}
      {badge && (
        <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 text-[10px] rounded-full bg-blue-500 text-white flex items-center justify-center animate-pulse shadow-md">
          {badge}
        </span>
      )}
    </button>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg z-50">
      {tooltip}
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
    </div>
  </div>
);

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  performers,
  activePerformerIds,
  onTogglePerformer,
  isCoreAgentMuted,
  onToggleCoreAgent,
  unlockedToggleFeatures
}) => {
  const [input, setInput] = useState('');
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [features, setFeatures] = useState<ActiveFeatures>(defaultFeatures);
  const [speakerPersonaId, setSpeakerPersonaId] = useState<string | null>(null);

  const featureUnlockMap: Record<keyof ActiveFeatures, string | null> = {
    usePreflection: 'preflection',
    useMemory: null,
    useTaskList: 'taskList',
    useAudit: 'audit',
    useStageDirections: 'stageDirections',
    useMonologue: 'monologue',
    usePromptRewrite: 'promptRewrite'
  };

  const isFeatureUnlocked = (feature: keyof ActiveFeatures) => {
    const required = featureUnlockMap[feature];
    if (!required) return true;
    return unlockedToggleFeatures.has(required);
  };

  useEffect(() => {
    if (!features.useTaskList && features.useAudit) {
      setFeatures(prev => ({ ...prev, useAudit: false }));
    }
  }, [features.useTaskList, features.useAudit]);

  useEffect(() => {
    setFeatures(prev => {
      const next = { ...prev };
      let changed = false;
      (Object.keys(featureUnlockMap) as Array<keyof ActiveFeatures>).forEach(key => {
        if (!isFeatureUnlocked(key) && next[key]) {
          next[key] = false;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [unlockedToggleFeatures]);

  useEffect(() => {
    if (speakerPersonaId && !performers.find(p => p.id === speakerPersonaId)) {
      setSpeakerPersonaId(null);
    }
  }, [speakerPersonaId, performers]);

  const availableSpeakerOptions = useMemo(
    () => [
      { id: null as string | null, label: 'You' },
      ...performers.map(p => ({ id: p.id, label: p.name }))
    ],
    [performers]
  );

  const handleSend = () => {
    if ((input.trim() || image) && !isLoading) {
      onSendMessage(input.trim(), features, image?.file || null, speakerPersonaId);
      setInput('');
      setImage(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleFeature = (feature: keyof ActiveFeatures) => {
    if (!isFeatureUnlocked(feature)) {
      return;
    }
    setFeatures(prev => ({ ...prev, [feature]: !prev[feature] }));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setImage({ file, preview: reader.result as string });
      reader.readAsDataURL(file);
      return;
    }

    if (file.type === 'text/plain' || file.type === 'text/markdown') {
      const reader = new FileReader();
      reader.onload = evt => setInput(prev => prev + (evt.target?.result as string));
      reader.readAsText(file);
      return;
    }

    alert('Unsupported file type. Please upload an image or a text/markdown file.');
  };

  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, isEntering: boolean) => {
    e.preventDefault();
    setIsDragging(isEntering);
  };

  const handleSelectSpeaker = () => {
    if (!availableSpeakerOptions.length) return;
    const currentIndex = availableSpeakerOptions.findIndex(option => option.id === speakerPersonaId);
    const nextIndex = (currentIndex + 1) % availableSpeakerOptions.length;
    setSpeakerPersonaId(availableSpeakerOptions[nextIndex].id);
  };

  const speakerLabel = availableSpeakerOptions.find(opt => opt.id === speakerPersonaId)?.label ?? 'You';

  return (
      <div
        className={`bg-[#1e1f20] p-4 border-t transition-all duration-300 ${
          isDragging 
            ? 'border-blue-500 bg-blue-500/5 shadow-lg shadow-blue-500/20' 
            : 'border-gray-700'
        }`}
        onDrop={handleDrop}
        onDragEnter={e => handleDragEvents(e, true)}
        onDragOver={e => handleDragEvents(e, true)}
        onDragLeave={e => handleDragEvents(e, false)}
      >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <ToolbarButton
          isActive={features.usePreflection}
          onClick={() => toggleFeature('usePreflection')}
          tooltip={isFeatureUnlocked('usePreflection') ? 'Preflection' : 'Unlock Preflection Mastery to enable'}
          disabled={!isFeatureUnlocked('usePreflection')}
        >
          <PreflectionIcon className="w-5 h-5" />
        </ToolbarButton>
        <ToolbarButton isActive={features.useMemory} onClick={() => toggleFeature('useMemory')} tooltip="Save Memory">
          <MemoryIcon className="w-5 h-5" />
        </ToolbarButton>
        <ToolbarButton
          isActive={features.usePromptRewrite}
          onClick={() => toggleFeature('usePromptRewrite')}
          tooltip={isFeatureUnlocked('usePromptRewrite') ? 'Rewrite Prompt' : 'Unlock Prompt Rewrite+'}
          disabled={!isFeatureUnlocked('usePromptRewrite')}
        >
          <RefreshIcon className="w-5 h-5" />
        </ToolbarButton>
        <ToolbarButton
          isActive={features.useStageDirections}
          onClick={() => toggleFeature('useStageDirections')}
          tooltip={isFeatureUnlocked('useStageDirections') ? 'Stage Directions' : 'Unlock Stagecraft skill'}
          disabled={!isFeatureUnlocked('useStageDirections')}
        >
          <StageIcon className="w-5 h-5" />
        </ToolbarButton>
        <ToolbarButton
          isActive={features.useMonologue}
          onClick={() => toggleFeature('useMonologue')}
          tooltip={isFeatureUnlocked('useMonologue') ? 'Internal Monologue' : 'Unlock Internal Voice skill'}
          disabled={!isFeatureUnlocked('useMonologue')}
        >
          <MonologueIcon className="w-5 h-5" />
        </ToolbarButton>
        <ToolbarButton
          isActive={features.useTaskList}
          onClick={() => toggleFeature('useTaskList')}
          tooltip={isFeatureUnlocked('useTaskList') ? 'Task List' : 'Unlock Workflow Overdrive'}
          disabled={!isFeatureUnlocked('useTaskList')}
        >
          <TaskListIcon className="w-5 h-5" />
        </ToolbarButton>
        <ToolbarButton
          isActive={features.useAudit}
          onClick={() => toggleFeature('useAudit')}
          disabled={!features.useTaskList || !isFeatureUnlocked('useAudit')}
          tooltip={isFeatureUnlocked('useAudit') ? 'Audit (Requires Task List)' : 'Unlock Audit Eye skill'}
        >
          <AuditIcon className="w-5 h-5" />
        </ToolbarButton>
        <ToolbarButton
          isActive={isCoreAgentMuted}
          onClick={onToggleCoreAgent}
          tooltip={isCoreAgentMuted ? 'Performer Solo Mode' : 'Boardroom Collaboration'}
          emphasis={isCoreAgentMuted ? 'warning' : 'primary'}
        >
          <BirdIcon className={`w-5 h-5 ${isCoreAgentMuted ? 'opacity-60' : ''}`} />
        </ToolbarButton>
        <ToolbarButton
          isActive={speakerPersonaId !== null}
          onClick={handleSelectSpeaker}
          tooltip={`Speak as ${speakerLabel}`}
        >
          <MonologueIcon className="w-5 h-5" />
        </ToolbarButton>
        <div className="text-xs text-gray-400 ml-2">
          Voice: <span className="text-blue-300">{speakerLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {performers.map(performer => {
          const IconComponent = performerIconMap[performer.icon || 'stage'] || StageIcon;
          const isActive = activePerformerIds.includes(performer.id);
          const badge = isActive ? String(activePerformerIds.indexOf(performer.id) + 1) : null;
          return (
            <ToolbarButton
              key={performer.id}
              isActive={isActive}
              onClick={() => onTogglePerformer(performer.id)}
              disabled={isLoading}
              tooltip={performer.name}
              badge={badge}
            >
              <IconComponent className="w-5 h-5" />
            </ToolbarButton>
          );
        })}
      </div>

      <div className="relative">
        {image && (
          <div className="relative w-24 h-24 mb-2 p-1 border border-gray-600 rounded-lg">
            <img src={image.preview} alt="upload preview" className="w-full h-full object-cover rounded" />
            <button
              onClick={() => setImage(null)}
              className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full w-6 h-6 flex items-center justify-center border-2 border-[#1e1f20] hover:bg-red-500"
              aria-label="Remove image"
            >
              &times;
            </button>
          </div>
        )}
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isDragging ? 'Drop file here' : 'Type or drop a file...'}
          className="w-full bg-[#2a2b2c] text-gray-300 rounded-lg p-3 pr-12 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all duration-200 placeholder:text-gray-500"
          rows={1}
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || (!input.trim() && !image)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-blue-600/20 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all duration-200 transform hover:scale-110 active:scale-95"
          aria-label="Send message"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <SendIcon />
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
