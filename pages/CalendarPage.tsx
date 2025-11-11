import React, { useState, useEffect, useMemo } from 'react';
import { JournalEntry, PerformerProfile, PerformerMemory } from '../types';
import { getAllJournalEntries, getAllPerformers, getPerformerMemories, upsertJournalEntry } from '../services/db';
import JournalModal from '../components/JournalModal';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons/Icons';
import { 
    format, 
    startOfMonth, 
    endOfMonth, 
    eachDayOfInterval, 
    startOfWeek, 
    endOfWeek, 
    addMonths, 
    subMonths, 
    isSameDay, 
    isToday,
    parseISO,
    differenceInDays
} from 'date-fns';

type ViewMode = 'calendar' | 'timeline';

interface TimelineEvent {
    date: Date;
    type: 'journal' | 'memory';
    data: JournalEntry | PerformerMemory;
    performerId?: string;
}

const CalendarPage: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [entries, setEntries] = useState<Map<string, JournalEntry>>(new Map());
    const [performers, setPerformers] = useState<PerformerProfile[]>([]);
    const [selectedPerformer, setSelectedPerformer] = useState<string | 'all'>('all');
    const [performerMemories, setPerformerMemories] = useState<Map<string, PerformerMemory[]>>(new Map());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('calendar');
    const [isLoading, setIsLoading] = useState(true);
    
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [allEntries, allPerformers] = await Promise.all([
                getAllJournalEntries(),
                getAllPerformers()
            ]);
            
            const entriesMap = new Map<string, JournalEntry>(allEntries.map(entry => [entry.date, entry]));
            setEntries(entriesMap);
            setPerformers(allPerformers);

            // Fetch memories for each performer
            const memoriesMap = new Map<string, PerformerMemory[]>();
            for (const performer of allPerformers) {
                const memories = await getPerformerMemories(performer.id);
                memoriesMap.set(performer.id, memories);
            }
            setPerformerMemories(memoriesMap);
        } catch (error) {
            console.error("Failed to fetch calendar data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const listener = () => fetchData();
        window.addEventListener('memories-updated', listener);
        window.addEventListener('performer-interactions-updated', listener as EventListener);
        return () => {
            window.removeEventListener('memories-updated', listener);
            window.removeEventListener('performer-interactions-updated', listener as EventListener);
        };
    }, []);

    const firstDayOfMonth = useMemo(() => startOfMonth(currentDate), [currentDate]);
    const lastDayOfMonth = useMemo(() => endOfMonth(currentDate), [currentDate]);
    
    const daysInMonth = useMemo(() => eachDayOfInterval({
        start: startOfWeek(firstDayOfMonth),
        end: endOfWeek(lastDayOfMonth)
    }), [firstDayOfMonth, lastDayOfMonth]);

    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Build timeline events
    const timelineEvents = useMemo(() => {
        const events: TimelineEvent[] = [];
        
        // Add journal entries
        entries.forEach((entry) => {
            events.push({
                date: parseISO(entry.date),
                type: 'journal',
                data: entry
            });
        });

        // Add performer memories
        if (selectedPerformer === 'all') {
            performerMemories.forEach((memories, performerId) => {
                memories.forEach((memory) => {
                    events.push({
                        date: new Date(memory.timestamp),
                        type: 'memory',
                        data: memory,
                        performerId
                    });
                });
            });
        } else {
            const memories = performerMemories.get(selectedPerformer) || [];
            memories.forEach((memory) => {
                events.push({
                    date: new Date(memory.timestamp),
                    type: 'memory',
                    data: memory,
                    performerId: selectedPerformer
                });
            });
        }

        return events.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [entries, performerMemories, selectedPerformer]);

    const getEventsForDate = (date: Date): TimelineEvent[] => {
        return timelineEvents.filter(event => isSameDay(event.date, date));
    };

    const handleDateClick = (day: Date) => {
        setSelectedDate(day);
    };

    const handleModalClose = () => {
        setSelectedDate(null);
    };

    const handleModalSave = (entry: JournalEntry) => {
        fetchData();
        setSelectedDate(null);
    };

    const getPerformerName = (performerId: string): string => {
        return performers.find(p => p.id === performerId)?.name || 'Unknown';
    };

    const getPerformerIcon = (performerId: string): string => {
        return performers.find(p => p.id === performerId)?.icon || '👤';
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
                    <p className="text-gray-400">Loading your timeline...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-3 md:p-8 flex flex-col h-full gap-4 md:gap-6 bg-gradient-to-br from-[#0a0b0c] via-[#111315] to-[#0a0b0c]">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                            Temporal Journal
                        </h1>
                        <span className="text-2xl animate-pulse">📅</span>
                    </div>
                    <p className="text-sm text-gray-400 max-w-2xl">
                        Track continuity across time. Journal entries and performer memories weave together to create a living timeline.
                        <span className="text-purple-400 font-medium"> Every moment matters.</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('calendar')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            viewMode === 'calendar' 
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/50 scale-105' 
                                : 'bg-[#1e1f20] text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-600 hover:scale-105'
                        }`}
                    >
                        📅 Calendar
                    </button>
                    <button
                        onClick={() => setViewMode('timeline')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            viewMode === 'timeline' 
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/50 scale-105' 
                                : 'bg-[#1e1f20] text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-600 hover:scale-105'
                        }`}
                    >
                        📜 Timeline
                    </button>
                </div>
            </div>

            {/* Performer Filter */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-400 font-medium">Filter by performer:</span>
                <button
                    onClick={() => setSelectedPerformer('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        selectedPerformer === 'all'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md scale-105'
                            : 'bg-[#1e1f20] text-gray-400 hover:text-gray-200 border border-gray-700 hover:scale-105'
                    }`}
                >
                    All Performers
                </button>
                {performers.map(performer => (
                    <button
                        key={performer.id}
                        onClick={() => setSelectedPerformer(performer.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2 ${
                            selectedPerformer === performer.id
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md scale-105'
                                : 'bg-[#1e1f20] text-gray-400 hover:text-gray-200 border border-gray-700 hover:scale-105'
                        }`}
                    >
                        <span>{performer.icon || '👤'}</span>
                        <span>{performer.name}</span>
                    </button>
                ))}
            </div>

            {/* Main Content */}
            {viewMode === 'calendar' ? (
                <>
                    {/* Calendar Navigation */}
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setCurrentDate(subMonths(currentDate, 1))} 
                                className="p-2 rounded-lg hover:bg-gray-700/50 transition-all duration-200 hover:scale-110 active:scale-95"
                            >
                                <ChevronLeftIcon className="w-5 h-5 text-gray-300" />
                            </button>
                            <h2 className="text-3xl font-semibold bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent w-64 text-center">
                                {format(currentDate, 'MMMM yyyy')}
                            </h2>
                            <button 
                                onClick={() => setCurrentDate(addMonths(currentDate, 1))} 
                                className="p-2 rounded-lg hover:bg-gray-700/50 transition-all duration-200 hover:scale-110 active:scale-95"
                            >
                                <ChevronRightIcon className="w-5 h-5 text-gray-300" />
                            </button>
                        </div>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="px-4 py-2 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-200 hover:bg-blue-600/30 text-sm font-medium transition-all duration-200 hover:scale-105"
                        >
                            Today
                        </button>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-px bg-gray-700/50 border border-gray-700/50 rounded-lg overflow-hidden shadow-2xl">
                        {/* Desktop: 7 columns, Mobile: Hide day headers and use simpler layout */}
                        {weekDays.map((day, index) => (
                            <div key={day} className="text-center font-semibold text-xs text-gray-400 py-2 md:py-3 bg-gradient-to-b from-[#1e1f20] to-[#141517] border-b border-gray-700/50">
                                <span className="hidden sm:inline">{day}</span>
                                <span className="sm:hidden">{day.charAt(0)}</span>
                            </div>
                        ))}

                        {daysInMonth.map(day => {
                            const entryKey = format(day, 'yyyy-MM-dd');
                            const hasJournalEntry = entries.has(entryKey);
                            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                            const dayEvents = getEventsForDate(day);
                            const hasPerformerMemory = dayEvents.some(e => e.type === 'memory' && (selectedPerformer === 'all' || e.performerId === selectedPerformer));
                            const isTodayDate = isToday(day);

                            return (
                                <div
                                    key={day.toString()}
                                    onClick={() => handleDateClick(day)}
                                    className={`p-1.5 md:p-3 min-h-[60px] md:min-h-[120px] flex flex-col bg-gradient-to-br from-[#1e1f20] to-[#141517] hover:from-[#2a2b2c] hover:to-[#1e1f20] transition-all duration-200 cursor-pointer relative group border border-transparent hover:border-purple-500/30 ${
                                        isCurrentMonth ? '' : 'opacity-40'
                                    } ${isTodayDate ? 'ring-1 md:ring-2 ring-blue-500/50 ring-offset-1 md:ring-offset-2 ring-offset-[#0a0b0c]' : ''}`}
                                >
                                    <span className={`font-semibold text-xs md:text-sm mb-1 md:mb-2 ${
                                        isTodayDate
                                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full w-6 h-6 md:w-8 md:h-8 flex items-center justify-center shadow-lg text-[10px] md:text-sm'
                                            : 'text-gray-300'
                                    }`}>
                                        {format(day, 'd')}
                                    </span>
                                    
                                    <div className="flex-1 flex flex-col gap-1">
                                        {hasJournalEntry && (
                                            <div className="w-full h-1.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full shadow-sm" title="Journal entry"></div>
                                        )}
                                        {hasPerformerMemory && (
                                            <div className="flex gap-1 flex-wrap">
                                                {dayEvents
                                                    .filter(e => e.type === 'memory' && (selectedPerformer === 'all' || e.performerId === selectedPerformer))
                                                    .slice(0, 3)
                                                    .map((event, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-pink-500 to-amber-500 shadow-sm"
                                                            title={event.performerId ? `${getPerformerName(event.performerId)} memory` : 'Memory'}
                                                        ></div>
                                                    ))}
                                                {dayEvents.filter(e => e.type === 'memory').length > 3 && (
                                                    <span className="text-xs text-gray-500">+{dayEvents.filter(e => e.type === 'memory').length - 3}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {dayEvents.length > 0 && (
                                        <div className="absolute top-1 right-1 text-xs text-gray-500 font-medium">
                                            {dayEvents.length}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                /* Timeline View */
                <div className="flex-1 overflow-y-auto">
                    {timelineEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                            <div className="text-6xl animate-pulse">📜</div>
                            <p className="text-xl font-medium">No timeline events yet</p>
                            <p className="text-sm text-gray-600">Start creating journal entries and memories to build your timeline</p>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Timeline Line */}
                            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 via-pink-500 to-blue-500"></div>
                            
                            <div className="space-y-6 pb-8">
                                {timelineEvents.map((event, index) => {
                                    const isJournal = event.type === 'journal';
                                    const memory = isJournal ? null : event.data as PerformerMemory;
                                    const journal = isJournal ? event.data as JournalEntry : null;
                                    const performer = event.performerId ? performers.find(p => p.id === event.performerId) : null;
                                    
                                    return (
                                        <div key={`${event.type}-${index}`} className="relative pl-20 animate-in fade-in slide-in-from-left-2">
                                            {/* Timeline Dot */}
                                            <div className={`absolute left-6 w-4 h-4 rounded-full border-4 border-[#0a0b0c] ${
                                                isJournal 
                                                    ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                                                    : 'bg-gradient-to-r from-pink-500 to-amber-500'
                                            } shadow-lg`}></div>
                                            
                                            {/* Event Card */}
                                            <div className={`bg-gradient-to-br from-[#1e1f20] to-[#141517] rounded-lg border ${
                                                isJournal 
                                                    ? 'border-blue-500/30 shadow-lg shadow-blue-500/10' 
                                                    : 'border-pink-500/30 shadow-lg shadow-pink-500/10'
                                            } p-5 hover:scale-[1.02] transition-all duration-200`}>
                                                <div className="flex items-start justify-between gap-4 mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`text-2xl ${
                                                            isJournal ? 'text-blue-400' : 'text-pink-400'
                                                        }`}>
                                                            {isJournal ? '📝' : performer?.icon || '💭'}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-semibold text-gray-200">
                                                                    {isJournal 
                                                                        ? 'Journal Entry' 
                                                                        : `${performer?.name || 'Performer'} Memory`
                                                                    }
                                                                </h3>
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                                    isJournal 
                                                                        ? 'bg-blue-900/30 text-blue-200 border border-blue-600/30' 
                                                                        : 'bg-pink-900/30 text-pink-200 border border-pink-600/30'
                                                                }`}>
                                                                    {isJournal ? 'Journal' : 'Memory'}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {format(event.date, 'MMMM d, yyyy • h:mm a')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    {isJournal && journal ? (
                                                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                                            {journal.content}
                                                        </p>
                                                    ) : memory ? (
                                                        <>
                                                            <p className="text-gray-300 text-sm leading-relaxed">
                                                                {memory.summary}
                                                            </p>
                                                            {memory.tags.length > 0 && (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {memory.tags.map((tag, idx) => (
                                                                        <span 
                                                                            key={idx}
                                                                            className="px-2 py-1 rounded-md text-xs bg-purple-900/20 text-purple-300 border border-purple-600/30"
                                                                        >
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {memory.transcriptSnippet && (
                                                                <div className="mt-2 p-3 bg-[#0a0b0c] rounded border border-gray-800">
                                                                    <p className="text-xs text-gray-500 mb-1">Snippet:</p>
                                                                    <p className="text-xs text-gray-400 italic">
                                                                        {memory.transcriptSnippet.length > 200 
                                                                            ? `${memory.transcriptSnippet.slice(0, 200)}...` 
                                                                            : memory.transcriptSnippet}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {selectedDate && (
                <JournalModal 
                    date={selectedDate} 
                    entry={entries.get(format(selectedDate, 'yyyy-MM-dd'))} 
                    onClose={handleModalClose} 
                    onSave={handleModalSave}
                />
            )}
        </div>
    );
};

export default CalendarPage;
