import React, { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { PerformerRelationship, DramaEvent, PerformerProfile } from '../types';
import { HeartIcon } from './icons/Icons';

interface RomanceTimelineProps {
  relationships: PerformerRelationship[];
  dramaEvents: DramaEvent[];
  performers: PerformerProfile[];
}

const RomanceTimeline: React.FC<RomanceTimelineProps> = ({
  relationships,
  dramaEvents,
  performers
}) => {
  const romanticRelationships = useMemo(() => {
    return relationships
      .filter(rel => rel.type === 'romantic')
      .sort((a, b) => (b.attraction || 0) - (a.attraction || 0));
  }, [relationships]);

  const romanceEvents = useMemo(() => {
    return dramaEvents
      .filter(event => event.type === 'romance' || event.type === 'confession' || event.type === 'revelation')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [dramaEvents]);

  const getPerformerName = (id: string): string => {
    if (id === 'user') return 'You';
    if (id === 'sylvia') return 'Seasuite';
    return performers.find(p => p.id === id)?.name || 'Unknown';
  };

  const getRomanceStage = (attraction: number, trust: number, intensity: number): string => {
    if (attraction < 30) return 'Initial Spark';
    if (attraction < 50) return 'Growing Interest';
    if (attraction < 70) return 'Deepening Connection';
    if (attraction < 85) return 'Serious Romance';
    return 'True Love';
  };

  const getIntensityColor = (intensity: number): string => {
    if (intensity < 30) return 'text-gray-400';
    if (intensity < 60) return 'text-blue-400';
    if (intensity < 85) return 'text-pink-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Active Romances */}
      <div className="rounded-xl border border-pink-500/30 bg-pink-500/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <HeartIcon className="w-5 h-5 text-pink-400" />
          <h2 className="text-lg font-semibold text-pink-300">Active Romances</h2>
          <span className="text-xs text-pink-200/80">({romanticRelationships.length})</span>
        </div>
        
        {romanticRelationships.length === 0 ? (
          <p className="text-sm text-gray-400">No romantic relationships yet. Create some chemistry!</p>
        ) : (
          <div className="space-y-4">
            {romanticRelationships.map(rel => {
              const attraction = rel.attraction || 0;
              const stage = getRomanceStage(attraction, rel.trust, rel.intensity);
              
              return (
                <div
                  key={rel.id}
                  className="rounded-lg border border-pink-500/30 bg-[#111315] p-4 hover:border-pink-500/50 transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
                        <span className="font-semibold text-pink-200">
                          {getPerformerName(rel.performerId)} ❤️ {getPerformerName(rel.targetId)}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-pink-200/80 uppercase tracking-wider">{stage}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Attraction</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-pink-500 to-red-500 rounded-full transition-all duration-300"
                            style={{ width: `${attraction}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${getIntensityColor(attraction)}`}>
                          {attraction}%
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Trust</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-300"
                            style={{ width: `${rel.trust}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-blue-400">{rel.trust}%</span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Tension</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all duration-300"
                            style={{ width: `${rel.tension}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-amber-400">{rel.tension}%</span>
                      </div>
                    </div>
                  </div>
                  
                  {rel.history.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-800">
                      <div className="text-xs text-gray-500 mb-1">Recent Moments</div>
                      <div className="text-xs text-gray-400 line-clamp-2">
                        {rel.history.slice(-2).join(' • ')}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-2 text-[11px] text-gray-500">
                    Last interaction {formatDistanceToNow(new Date(rel.lastInteraction), { addSuffix: true })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Romance Events Timeline */}
      <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-5">
        <h2 className="text-lg font-semibold text-purple-300 mb-4">Romance Events</h2>
        
        {romanceEvents.length === 0 ? (
          <p className="text-sm text-gray-400">No romance events yet. Sparks will fly!</p>
        ) : (
          <div className="space-y-3">
            {romanceEvents.map(event => (
              <div
                key={event.id}
                className="rounded-lg border border-purple-500/30 bg-[#111315] p-3 hover:border-purple-500/50 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="text-xs uppercase tracking-wider text-purple-200">
                      {event.type === 'romance' ? '💕 Romance' : event.type === 'confession' ? '💌 Confession' : '✨ Revelation'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">{event.description}</p>
                <div className="mt-2 text-[11px] text-gray-500">
                  {event.participants.map(getPerformerName).join(' • ')}
                  {' • '}
                  Intensity: {event.intensity}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RomanceTimeline;

