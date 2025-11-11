import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  getAllPrivateConversations,
  getPrivateConversation,
  savePrivateConversation,
  getAllPerformers,
  addPerformerInteractionEvents
} from '../services/db';
import { PrivateConversation, PrivateMessage, PerformerProfile, PerformerInteractionEvent, ExperienceEventType } from '../types';
import { generatePerformerResponse } from '../services/aiService';
import { calculateSentimentScore, detectNarrativeTags, collectIntrigueTags } from '../services/socialSignals';
import { awardExperience } from '../services/progressionEngine';
import { auditDirectMessage, noteDirectMessage } from '../services/watcher';

const buildConversationLabel = (performerA: string, performerB: string, lookup: Map<string, PerformerProfile>) => {
  const left = lookup.get(performerA)?.name ?? 'Unknown';
  const right = lookup.get(performerB)?.name ?? 'Unknown';
  return `${left} ↔ ${right}`;
};

const PrivateDMsPage: React.FC = () => {
  const [conversations, setConversations] = useState<PrivateConversation[]>([]);
  const [performers, setPerformers] = useState<PerformerProfile[]>([]);
  const [selectedConv, setSelectedConv] = useState<PrivateConversation | null>(null);
  const [asPerformerId, setAsPerformerId] = useState<string>('');
  const [toPerformerId, setToPerformerId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const performerLookup = useMemo(
    () => new Map(performers.map(performer => [performer.id, performer])),
    [performers]
  );

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConv?.messages?.length]);

  useEffect(() => {
    if (!selectedConv) return;
    if (selectedConv.participant1Id === asPerformerId || selectedConv.participant2Id === asPerformerId) return;
    setAsPerformerId(selectedConv.participant1Id);
  }, [selectedConv, asPerformerId]);

  const loadData = async () => {
    const [convs, perfs] = await Promise.all([
      getAllPrivateConversations(),
      getAllPerformers()
    ]);

    const ordered = convs.sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
    setConversations(ordered);
    setPerformers(perfs);

    if (!selectedConv && ordered.length > 0) {
      setSelectedConv(ordered[0]);
      setAsPerformerId(ordered[0].participant1Id);
    }
  };

  const getPerformerName = (id: string) => performerLookup.get(id)?.name ?? 'Unknown';

  const getOtherParticipant = (conversation: PrivateConversation, currentId: string): string => {
    return conversation.participant1Id === currentId ? conversation.participant2Id : conversation.participant1Id;
  };

  const handleStartConversation = async () => {
    if (!asPerformerId || !toPerformerId || asPerformerId === toPerformerId) return;

    const existing = await getPrivateConversation(asPerformerId, toPerformerId);
    if (existing) {
      setSelectedConv(existing);
      setToPerformerId('');
      return;
    }

    const timestamp = Date.now();
    const newConv: PrivateConversation = {
      id: `dm_${asPerformerId}_${toPerformerId}_${timestamp}`,
      participant1Id: asPerformerId,
      participant2Id: toPerformerId,
      messages: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await savePrivateConversation(newConv);
    setSelectedConv(newConv);
    setToPerformerId('');
    await loadData();
  };

  const handleSendMessage = async () => {
    if (!selectedConv || !message.trim() || !asPerformerId) return;

    setStatusMessage(null);
    setIsLoading(true);
    const now = Date.now();

    const recipientId = getOtherParticipant(selectedConv, asPerformerId);
    const auditVerdict = auditDirectMessage({
      senderId: asPerformerId,
      recipientId,
      conversationId: selectedConv.id,
      message,
      timestamp: now
    });

    if (auditVerdict.status === 'block') {
      setIsLoading(false);
      setStatusMessage(auditVerdict.reasons.join(' '));
      return;
    }

    if (auditVerdict.status === 'warn') {
      setStatusMessage(auditVerdict.reasons.join(' '));
    }

    const newMessage: PrivateMessage = {
      id: `msg_${now}`,
      senderId: asPerformerId,
      content: message.trim(),
      timestamp: now
    };

    const updatedConversation: PrivateConversation = {
      ...selectedConv,
      messages: [...selectedConv.messages, newMessage],
      updatedAt: now
    };

    setSelectedConv(updatedConversation);
    setMessage('');
    await savePrivateConversation(updatedConversation);

    const otherPerformerId = recipientId;
    const userNarrativeTags = detectNarrativeTags(message.trim());
    const userIntrigueTags = collectIntrigueTags(performerLookup.get(asPerformerId) || null, [otherPerformerId], performerLookup);
    noteDirectMessage({
      senderId: asPerformerId,
      recipientId: otherPerformerId,
      conversationId: updatedConversation.id,
      message,
      timestamp: now
    });

    try {
      await addPerformerInteractionEvents([
        {
          id: `dm-${updatedConversation.id}-${newMessage.id}`,
          conversationId: updatedConversation.id,
          speakerId: asPerformerId,
          speakerName: getPerformerName(asPerformerId),
          speakerType: 'performer',
          targetIds: [otherPerformerId],
          targetNames: [getPerformerName(otherPerformerId)],
          timestamp: now,
          messageId: newMessage.id,
          intrigueTags: userIntrigueTags,
          sentiment: calculateSentimentScore(message.trim()),
          narrativeTags: userNarrativeTags,
          context: 'private',
          origin: 'dm'
        }
      ]);
      const xpType: ExperienceEventType = userIntrigueTags.length ? 'secret_shared' : 'secret_uncovered';
      await awardExperience({
        branch: 'diplomacy',
        type: xpType,
        baseXp: userIntrigueTags.length ? 60 : 35,
        actorIds: [asPerformerId, otherPerformerId],
        context: 'private',
        metadata: { conversationId: updatedConversation.id }
      }).catch(error => console.error('Failed to award DM experience:', error));
    } catch (interactionError) {
      console.error('Failed to log DM interaction:', interactionError);
    }

    const otherPerformer = performerLookup.get(otherPerformerId);

    if (otherPerformer) {
      try {
        const chatHistory = updatedConversation.messages.map(msg => ({
          id: msg.id,
          role: msg.senderId === otherPerformerId ? 'agent' : 'user',
          content: msg.content,
          timestamp: msg.timestamp
        }));

        const response = await generatePerformerResponse(
          otherPerformer,
          message.trim(),
          chatHistory,
          {
            usePreflection: false,
            useMemory: true,
            useTaskList: false,
            useAudit: false,
            useStageDirections: false,
            useMonologue: false,
            usePromptRewrite: false
          },
          null
        );

        if (response.response) {
          const aiTimestamp = Date.now();
          const aiMessage: PrivateMessage = {
            id: `msg_${aiTimestamp}`,
            senderId: otherPerformerId,
            content: response.response,
            timestamp: aiTimestamp
          };

          const finalConversation: PrivateConversation = {
            ...updatedConversation,
            messages: [...updatedConversation.messages, aiMessage],
            updatedAt: aiTimestamp
          };

          setSelectedConv(finalConversation);
          await savePrivateConversation(finalConversation);

          try {
            await addPerformerInteractionEvents([
              {
                id: `dm-${finalConversation.id}-${aiMessage.id}`,
                conversationId: finalConversation.id,
                speakerId: otherPerformerId,
                speakerName: getPerformerName(otherPerformerId),
                speakerType: 'performer',
                targetIds: [asPerformerId],
                targetNames: [getPerformerName(asPerformerId)],
                timestamp: aiTimestamp,
                messageId: aiMessage.id,
                intrigueTags: collectIntrigueTags(otherPerformer, [asPerformerId], performerLookup),
                sentiment: calculateSentimentScore(response.response),
                narrativeTags: detectNarrativeTags(response.response),
                context: 'private',
                origin: 'dm'
              }
            ]);
            await awardExperience({
              branch: 'diplomacy',
              type: 'secret_uncovered',
              baseXp: collectIntrigueTags(otherPerformer, [asPerformerId], performerLookup).length ? 55 : 30,
              actorIds: [otherPerformerId, asPerformerId],
              context: 'private',
              metadata: { conversationId: finalConversation.id }
            }).catch(error => console.error('Failed to award performer DM experience:', error));
          } catch (interactionError) {
            console.error('Failed to log performer DM response:', interactionError);
          }
        }
      } catch (error) {
        console.error('Failed to generate AI response:', error);
      }
    }

    await loadData();
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-[#26282B] text-white">
      {/* Sidebar */}
      <aside className="flex w-full md:w-[22rem] flex-col border-b md:border-r md:border-b-0 border-gray-900 bg-[#1E1F22]">
        <div className="border-b border-gray-900 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Private Channels</h2>
            <span className="text-xs text-gray-500">{conversations.length}</span>
          </div>
          <div className="mt-4 space-y-2 rounded-xl border border-gray-900 bg-[#18191D] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Launch DM</div>
            <select
              value={asPerformerId}
              onChange={(e) => setAsPerformerId(e.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-[#111217] px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Sender</option>
              {performers.map(performer => (
                <option key={performer.id} value={performer.id}>{performer.name}</option>
              ))}
            </select>
            <select
              value={toPerformerId}
              onChange={(e) => setToPerformerId(e.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-[#111217] px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Recipient</option>
              {performers
                .filter(performer => performer.id !== asPerformerId)
                .map(performer => (
                  <option key={performer.id} value={performer.id}>{performer.name}</option>
                ))}
            </select>
            <button
              onClick={handleStartConversation}
              disabled={!asPerformerId || !toPerformerId}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Open Thread
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {conversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-800 bg-[#18191D] p-6 text-center text-sm text-gray-500">
              No private threads yet. Pair performers to spin up covert strategy.
            </div>
          ) : (
            conversations.map(conversation => {
              const isActive = selectedConv?.id === conversation.id;
              const latest = conversation.messages[conversation.messages.length - 1];
              const label = buildConversationLabel(conversation.participant1Id, conversation.participant2Id, performerLookup);
              return (
                <button
                  key={conversation.id}
                  onClick={() => {
                    setSelectedConv(conversation);
                    setAsPerformerId(conversation.participant1Id);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    isActive
                      ? 'border-blue-500/40 bg-blue-500/10'
                      : 'border-transparent bg-[#18191D] hover:border-gray-800 hover:bg-[#202226]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{label}</span>
                    {conversation.updatedAt && (
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">
                        {new Date(conversation.updatedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {latest ? `${getPerformerName(latest.senderId)}: ${latest.content.slice(0, 64)}${latest.content.length > 64 ? '…' : ''}` : 'No messages yet'}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-gray-500">
                    <span className="rounded-full bg-[#121317] px-2 py-1">{conversation.messages.length} msgs</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Chat */}
      <section className="flex flex-1 flex-col">
        {selectedConv ? (
          <>
            <header className="border-b border-gray-900 bg-[#1A1C1F] p-3 md:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {buildConversationLabel(selectedConv.participant1Id, selectedConv.participant2Id, performerLookup)}
                </h1>
                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                  Private Channel
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Discrete back-channel for performers. Messages stay off the public billet.
              </p>
            </header>

            <div className="flex-1 space-y-3 md:space-y-4 overflow-y-auto bg-[#18191D] p-3 md:p-6">
              {selectedConv.messages.length === 0 ? (
                <div className="mt-20 text-center text-sm text-gray-500">
                  No messages yet. Kick off the exchange below.
                </div>
              ) : (
                selectedConv.messages.map(chat => {
                  const isSender = chat.senderId === asPerformerId;
                  return (
                    <div key={chat.id} className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-full md:max-w-[70%] rounded-2xl border px-3 md:px-4 py-2 md:py-3 text-sm shadow-lg ${
                        isSender
                          ? 'border-blue-500/40 bg-blue-600/90 text-white'
                          : 'border-gray-800 bg-[#1F2126] text-gray-200'
                      }`}>
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-gray-400">
                          <span>{getPerformerName(chat.senderId)}</span>
                          <span className="text-gray-600">•</span>
                          <span>{new Date(chat.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="mt-2 leading-relaxed prose prose-invert prose-sm max-w-none text-gray-200">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {chat.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <footer className="border-t border-gray-900 bg-[#1A1C1F] p-3 md:p-6">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Speak as</label>
                <select
                  value={asPerformerId}
                  onChange={(e) => setAsPerformerId(e.target.value)}
                  className="rounded-lg border border-gray-800 bg-[#121317] px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select performer</option>
                  <option value={selectedConv.participant1Id}>{getPerformerName(selectedConv.participant1Id)}</option>
                  <option value={selectedConv.participant2Id}>{getPerformerName(selectedConv.participant2Id)}</option>
                </select>
              </div>
              {statusMessage && (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
                  {statusMessage}
                </div>
              )}
              <div className="flex gap-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isLoading) handleSendMessage();
                    }
                  }}
                  placeholder="Type a discreet update or instruction…"
                  rows={3}
                  disabled={!asPerformerId || isLoading}
                  className="flex-1 resize-none rounded-xl border border-gray-800 bg-[#111217] px-4 py-3 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || !asPerformerId || isLoading}
                  className="h-fit rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isLoading ? 'Sending…' : 'Send' }
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
            Choose a private thread or launch a new one to synchronize performers.
          </div>
        )}
      </section>
    </div>
  );
};

export default PrivateDMsPage;
