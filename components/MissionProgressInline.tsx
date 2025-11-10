import React from 'react';
import { MissionUpdate } from '../types';
import { SKILL_BRANCHES } from '../services/skills';

interface MissionProgressInlineProps {
  missionMetadata?: MissionUpdate;
}

const MissionProgressInline: React.FC<MissionProgressInlineProps> = ({ missionMetadata }) => {
  if (!missionMetadata) return null;
  const branch = SKILL_BRANCHES[missionMetadata.branch];
  const title = missionMetadata.title || `Mission: ${branch.title}`;
  const completion = Math.min(100, Math.round((missionMetadata.progress / missionMetadata.target) * 100));

  return (
    <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-blue-100">{title}</span>
        <span>{missionMetadata.progress}/{missionMetadata.target}</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-blue-900">
        <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${completion}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="uppercase tracking-wider text-[10px] text-blue-200/80">{branch.title}</span>
        <span className="text-[10px] text-blue-200/80">Reward +{missionMetadata.rewardXp} XP</span>
      </div>
    </div>
  );
};

export default MissionProgressInline;
