import React, { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { DramaEvent, PerformerProfile } from '../types';

interface DramaIntensityTimelineProps {
  dramaEvents: DramaEvent[];
  performers: PerformerProfile[];
}

const DramaIntensityTimeline: React.FC<DramaIntensityTimelineProps> = ({
  dramaEvents,
  performers
}) => {
  const sortedEvents = useMemo(() => {
    return [...dramaEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
  }, [dramaEvents]);

  const intensityScore = useMemo(() => {
    if (dramaEvents.length === 0) return 0;
    const total = dramaEvents.reduce((sum, event) => sum + event.intensity, 0);
    return Math.round(total / dramaEvents.length);
  }, [dramaEvents]);

  const recentConflicts = useMemo(() => {
    return dramaEvents.filter(e => e.type === 'conflict').slice(0, 5);
  }, [dramaEvents]);

  const recentBetrayals = useMemo(() => {
    return dramaEvents.filter(e => e.type === 'betrayal').slice(0, 5);
  }, [dramaEvents]);

  const getPerformerName = (id: string): string => {
    if (id === 'user') return 'You';
    if (id === 'sylvia') return 'Seasuite';
    return performers.find(p => p.id === id)?.name || 'Unknown';
  };

  const getDramaColor = (type: DramaEvent['type'], intensity: number): string => {
    const baseColors: Record<DramaEvent['type'], string> = {
      conflict: '#ef4444',
      alliance: '#10b981',
      betrayal: '#dc2626',
      confession: '#8b5cf6',
      revelation: '#f59e0b',
      romance: '#ec4899'
    };
    return baseColors[type] || '#6b7280';
  };

  const getIntensityLevel = (intensity: number): { label: string; color: string } => {
    if (intensity >= 80) return { label: 'Critical', color: 'text-red-400' };
    if (intensity >= 60) return { label: 'High', color: 'text-orange-400' };
    if (intensity >= 40) return { label: 'Moderate', color: 'text-yellow-400' };
    return { label: 'Low', color: 'text-gray-400' };
  };

  return (
    <div className="space-y-6">
      {/* Overall Drama Score */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-red-300">Drama Intensity</h2>
            <p className="text-xs text-gray-500">Aggregate tension across all events</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-red-200">{intensityScore}%</div>
            <div className={`text-xs font-semibold ${getIntensityLevel(intensityScore).color}`}>
              {getIntensityLevel(intensityScore).label}
            </div>
          </div>
        </div>
        <div className="h-3 w-full bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${intensityScore}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-gray-400">
          {dramaEvents.length} total events · {recentConflicts.length} active conflicts · {recentBetrayals.length} betrayals
        </div>
      </div>

      {/* Recent Drama Events */}
      <div className="rounded-xl border border-gray-800 bg-[#1B1C1F] p-5">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Recent Drama</h2>
        {sortedEvents.length === 0 ? (
          <p className="text-sm text-gray-500">No drama events yet. Things are calm.</p>
        ) : (
          <div className="space-y-3">
            {sortedEvents.map(event => {
              const color = getDramaColor(event.type, event.intensity);
              const intensityLevel = getIntensityLevel(event.intensity);
              
              return (
                <div
                  key={event.id}
                  className="rounded-lg border border-gray-800 bg-[#111315] p-4 hover:border-gray-700 transition-all duration-200"
                  style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs uppercase tracking-wider font-semibold" style={{ color }}>
                        {event.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className={intensityLevel.color}>
                        {intensityLevel.label} ({event.intensity}%)
                      </span>
                      <span>{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed mb-2">{event.description}</p>
                  <div className="text-[11px] text-gray-500">
                    Participants: {event.participants.map(getPerformerName).join(' • ')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Conflicts */}
      {recentConflicts.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
          <h2 className="text-lg font-semibold text-red-300 mb-4">Active Conflicts</h2>
          <div className="space-y-3">
            {recentConflicts.map(event => (
              <div
                key={event.id}
                className="rounded-lg border border-red-500/30 bg-[#111315] p-3"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-red-200 font-semibold">
                    {event.participants.map(getPerformerName).join(' vs ')}
                  </span>
                  <span className="text-red-200/80">{event.intensity}% intensity</span>
                </div>
                <p className="text-sm text-gray-300">{event.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Betrayals */}
      {recentBetrayals.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
          <h2 className="text-lg font-semibold text-red-300 mb-4">Recent Betrayals</h2>
          <div className="space-y-3">
            {recentBetrayals.map(event => (
              <div
                key={event.id}
                className="rounded-lg border border-red-500/30 bg-[#111315] p-3"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-red-200 font-semibold">
                    {event.participants.map(getPerformerName).join(' • ')}
                  </span>
                  <span className="text-red-200/80">{event.intensity}% impact</span>
                </div>
                <p className="text-sm text-gray-300">{event.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DramaIntensityTimeline;

