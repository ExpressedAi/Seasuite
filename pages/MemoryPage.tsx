
import React, { useState, useEffect, useMemo } from 'react';
import { Memory } from '../types';
import { getAllMemories, updateMemory, deleteMemoryById, clearMemories } from '../services/db';
import { processMemory, applyProcessingResult } from '../services/memoryProcessor';
import MemoryCard from '../components/MemoryCard';
import { SearchIcon, TrashIcon, RefreshIcon } from '../components/icons/Icons';
import { CardSkeleton } from '../components/SkeletonLoader';
import { showToast } from '../components/Toast';

type SortKey = 'timestamp' | 'relevance';

const MemoryPage: React.FC = () => {
    const [memories, setMemories] = useState<Memory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortKey, setSortKey] = useState<SortKey>('timestamp');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [selectedMemoryIds, setSelectedMemoryIds] = useState<Set<number>>(new Set());
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [batchProgress, setBatchProgress] = useState<Record<number, 'pending' | 'processing' | 'completed' | 'error'>>({});

  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const storedMemories = await getAllMemories();
        setMemories(storedMemories);
      } catch (error) {
        console.error("Failed to fetch memories:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMemories();

    const handleUpdate = () => fetchMemories();
    window.addEventListener('memories-updated', handleUpdate);
    return () => {
      window.removeEventListener('memories-updated', handleUpdate);
    };
  }, []);

  const refreshMemories = async () => {
    setIsLoading(true);
    try {
      const stored = await getAllMemories();
      setMemories(stored);
    } catch (error) {
      console.error('Failed to refresh memories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedMemories = useMemo(() => {
    const filtered = memories.filter(memory => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const inSummary = memory.summary.toLowerCase().includes(query);
        const inTags = memory.tags.some(tag => tag.toLowerCase().includes(query));
        return inSummary || inTags;
    });

    return filtered.sort((a, b) => {
        if (sortKey === 'relevance') {
            return b.relevance - a.relevance;
        }
        return b.timestamp - a.timestamp; // default to timestamp
    });
  }, [memories, sortKey, searchQuery]);

  const SortButton: React.FC<{
    value: SortKey;
    label: string;
  }> = ({ value, label }) => (
    <button
        onClick={() => setSortKey(value)}
        className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${
            sortKey === value
                ? 'bg-blue-600 text-white'
                : 'bg-[#1e1f20] hover:bg-gray-700 text-gray-300'
        }`}
    >
        {label}
    </button>
  );

  const handleUpdateMemory = async (next: Memory) => {
    try {
      await updateMemory(next);
      setMemories(prev => prev.map(mem => (mem.id === next.id ? next : mem)));
      setStatusMessage('Memory updated.');
    } catch (error) {
      console.error('Failed to update memory:', error);
      setStatusMessage('Could not update memory.');
    } finally {
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleDeleteMemory = async (id: number) => {
    try {
      await deleteMemoryById(id);
      setMemories(prev => prev.filter(mem => mem.id !== id));
      setStatusMessage('Memory deleted.');
    } catch (error) {
      console.error('Failed to delete memory:', error);
      setStatusMessage('Could not delete memory.');
    } finally {
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleClearMemories = async () => {
    const confirmation = window.confirm('Clear all stored memories?');
    if (!confirmation) return;
    try {
      await clearMemories();
      setMemories([]);
      setSelectedMemoryIds(new Set());
      setStatusMessage('All memories cleared.');
    } catch (error) {
      console.error('Failed to clear memories:', error);
      setStatusMessage('Could not clear memories.');
    } finally {
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleSelectMemory = (id: number, selected: boolean) => {
    setSelectedMemoryIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedMemoryIds.size === filteredAndSortedMemories.length) {
      setSelectedMemoryIds(new Set());
    } else {
      setSelectedMemoryIds(new Set(filteredAndSortedMemories.map(m => m.id).filter((id): id is number => id !== undefined)));
    }
  };

  const handleBatchProcess = async () => {
    if (selectedMemoryIds.size === 0) {
      setStatusMessage('Select at least one memory to process.');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    setIsBatchProcessing(true);
    const selectedMemories = memories.filter(m => m.id !== undefined && selectedMemoryIds.has(m.id));
    
    // Initialize progress
    const initialProgress: Record<number, 'pending' | 'processing' | 'completed' | 'error'> = {};
    selectedMemories.forEach(m => {
      if (m.id !== undefined) {
        initialProgress[m.id] = 'pending';
      }
    });
    setBatchProgress(initialProgress);

    try {
      // Process all selected memories in parallel
      const processPromises = selectedMemories.map(async (memory) => {
        if (!memory.id) return;
        
        setBatchProgress(prev => ({ ...prev, [memory.id!]: 'processing' }));
        
        try {
          const result = await processMemory(memory);
          await applyProcessingResult(memory.id, result);
          
          // Update memory with new relevance
          const updatedMemory = { ...memory, relevance: result.rerankedRelevance };
          await updateMemory(updatedMemory);
          setMemories(prev => prev.map(m => m.id === memory.id ? updatedMemory : m));
          
          setBatchProgress(prev => ({ ...prev, [memory.id!]: 'completed' }));
          
          // Show toast for what was extracted
          const updates: string[] = [];
          if (result.clientUpdates.length > 0) updates.push(`${result.clientUpdates.length} client update${result.clientUpdates.length > 1 ? 's' : ''}`);
          if (result.brandUpdates) updates.push('brand intelligence');
          if (result.performerUpdates.length > 0) updates.push(`${result.performerUpdates.length} performer update${result.performerUpdates.length > 1 ? 's' : ''}`);
          if (result.calendarEntries.length > 0) updates.push(`${result.calendarEntries.length} calendar entr${result.calendarEntries.length > 1 ? 'ies' : 'y'}`);
          if (result.knowledgeConnections.length > 0) updates.push(`${result.knowledgeConnections.length} knowledge connection${result.knowledgeConnections.length > 1 ? 's' : ''}`);
          
          if (updates.length > 0) {
            showToast(
              `Memory ${memory.id}: ${updates.join(', ')}`,
              'info',
              4000
            );
          }
        } catch (error) {
          console.error(`Failed to process memory ${memory.id}:`, error);
          setBatchProgress(prev => ({ ...prev, [memory.id!]: 'error' }));
        }
      });

      await Promise.all(processPromises);
      
      const completed = Object.values(batchProgress).filter(s => s === 'completed').length;
      const errors = Object.values(batchProgress).filter(s => s === 'error').length;
      
      setStatusMessage(`Batch processing complete: ${completed} succeeded${errors > 0 ? `, ${errors} failed` : ''}`);
      setSelectedMemoryIds(new Set());
      setTimeout(() => {
        setStatusMessage(null);
        setBatchProgress({});
      }, 5000);
    } catch (error) {
      console.error('Batch processing failed:', error);
      setStatusMessage('Batch processing encountered errors.');
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      setIsBatchProcessing(false);
    }
  };


  return (
    <div className="p-8 h-full flex flex-col overflow-y-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <h1 className="text-4xl font-bold text-gray-200">Agent Memory</h1>
        <div className="flex items-center gap-3 text-sm text-gray-400">
            {statusMessage && <span className="text-blue-300">{statusMessage}</span>}
            {selectedMemoryIds.size > 0 && (
              <span className="text-purple-300 font-semibold">
                {selectedMemoryIds.size} selected
              </span>
            )}
            {selectedMemoryIds.size > 0 && (
              <button
                onClick={handleBatchProcess}
                disabled={isBatchProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-purple-600/50 text-purple-200 bg-purple-900/20 hover:bg-purple-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isBatchProcessing ? 'Processing...' : `Batch Process (${selectedMemoryIds.size})`}
              </button>
            )}
            <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-600 bg-[#1e1f20] text-gray-300 hover:bg-gray-700"
            >
                {selectedMemoryIds.size === filteredAndSortedMemories.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
                onClick={refreshMemories}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-600 bg-[#1e1f20] text-gray-300 hover:bg-gray-700"
            >
                <RefreshIcon className="h-4 w-4" /> Refresh
            </button>
            <button
                onClick={handleClearMemories}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-red-600/50 text-red-200 bg-red-900/20 hover:bg-red-900/40"
            >
                <TrashIcon className="h-4 w-4" /> Clear All
            </button>
        </div>
        <div className="flex items-center gap-4">
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                    <SearchIcon className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    placeholder="Search memories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#2a2b2c] text-gray-300 rounded-lg pl-10 pr-4 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-lg">
                <SortButton value="timestamp" label="Most Recent" />
                <SortButton value="relevance" label="Most Relevant" />
            </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filteredAndSortedMemories.length === 0 ? (
        <div className="text-center py-16">
            {memories.length === 0 ? (
                 <>
                    <p className="text-gray-400 text-lg">No memories stored yet.</p>
                    <p className="text-gray-500">Start a conversation to build the agent's knowledge base.</p>
                </>
            ) : (
                <>
                    <p className="text-gray-400 text-lg">No memories found for "{searchQuery}".</p>
                    <p className="text-gray-500">Try searching with different keywords.</p>
                </>
            )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedMemories.map((memory, index) => (
            <div
              key={memory.id}
              className="animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
            >
              <MemoryCard
                memory={memory}
                onUpdate={handleUpdateMemory}
                onDelete={id => handleDeleteMemory(id)}
                isSelected={memory.id !== undefined && selectedMemoryIds.has(memory.id)}
                onSelect={handleSelectMemory}
                batchProcessing={isBatchProcessing}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MemoryPage;
