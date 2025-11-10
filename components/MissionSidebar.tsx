import React from 'react';
import { MissionDefinition, MissionProgress, SkillBranchId } from '../types';
import { SKILL_BRANCHES } from '../services/skills';

interface MissionSidebarProps {
  missions: Array<{ mission: MissionProgress; definition: MissionDefinition }>;
  branchXp: Record<SkillBranchId, number>;
  onClose: () => void;
}

const MissionSidebar: React.FC<MissionSidebarProps> = ({ missions, branchXp, onClose }) => {
  return (
    <div className="fixed right-4 top-20 z-30 w-80 rounded-2xl border border-blue-500/30 bg-[#111315] shadow-xl shadow-blue-500/10">
      <div className="flex items-center justify-between border-b border-blue-500/20 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-blue-300">Active Missions</div>
          <div className="text-sm text-gray-300">Earn bonus XP to unlock skills faster.</div>
        </div>
        <button onClick={onClose} className="rounded-full bg-blue-500/10 px-2 py-1 text-xs text-blue-200 hover:bg-blue-500/20">
          Close
        </button>
      </div>
      <div className="max-h-[24rem] overflow-y-auto px-4 py-3">
        {missions.length === 0 ? (
          <p className="text-sm text-gray-500">No missions yet—progress to spawn new objectives.</p>
        ) : (
          <ul className="space-y-3 text-sm text-gray-200">
            {missions.map(({ mission, definition }) => {
              const branchMeta = SKILL_BRANCHES[definition.branch];
              const currentXp = branchXp[definition.branch] ?? 0;
              const completion = Math.min(100, Math.round((mission.progress / mission.target) * 100));
              return (
                <li key={mission.id} className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wider text-blue-200">
                    <span>{branchMeta.title}</span>
                    <span>{completion}%</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-blue-100">{definition.title}</div>
                  <p className="mt-1 text-xs text-blue-200/80">{definition.description}</p>
                  <div className="mt-2 h-2 w-full rounded-full bg-blue-950">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${completion}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-blue-200/80">
                    <span>{mission.progress}/{mission.target} actions</span>
                    <span>Reward +{definition.rewardXp} XP</span>
                  </div>
                  <div className="mt-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] text-blue-100">
                    Branch XP {currentXp} · Next unlock looks brighter when this hits!</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MissionSidebar;

