
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage as ChatMessageType, HRMR_GRADE_SCALE, HrmrGrade, HrmrRating } from '../types';
import { UserIcon, AgentIcon } from './icons/Icons';
import PreflectionPanel from './PreflectionPanel';
import MemorySavedPanel from './MemorySavedPanel';
import TaskListPanel from './TaskListPanel';
import AuditPanel from './AuditPanel';
import StageDirectionsPanel from './StageDirectionsPanel';
import MonologuePanel from './MonologuePanel';
import EscortPanel from './EscortPanel';
import PostProcessingToolbar, { POST_PROCESSING_ACTIONS } from './PostProcessingToolbar';
import { runPostProcessing, PostProcessingAction, POST_PROCESSING_DETAILS, loadAiSettings } from '../services/aiService';
import { getHrmrRatingByMessageId, upsertHrmrRating, deleteHrmrRating } from '../services/db';
import MissionProgressInline from './MissionProgressInline';

const stripMarkdown = (value: string): string => {
    return value
        .replace(/```[\s\S]*?```/g, '') // remove code fences and content
        .replace(/`([^`]+)`/g, '$1') // inline code
        .replace(/!\[[^\]]*\]\([^\)]*\)/g, '') // images
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // links
        .replace(/^>\s?/gm, '') // blockquotes
        .replace(/^#+\s?/gm, '') // headings
        .replace(/[*_~]/g, '') // emphasis markers
        .replace(/\s+/g, ' ')
        .trim();
};

const ChatMessage: React.FC<{ message: ChatMessageType }> = ({ message }) => {
    const isUser = message.role === 'user';
    const parts = message.agentResponseParts;
    const [copied, setCopied] = useState(false);
    const [postError, setPostError] = useState<string | null>(null);
    const [processingAction, setProcessingAction] = useState<PostProcessingAction | null>(null);
    const [postResults, setPostResults] = useState<Partial<Record<PostProcessingAction, string>>>({});
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isRatingOpen, setIsRatingOpen] = useState(false);
    const [currentGrade, setCurrentGrade] = useState<HrmrGrade | null>(null);
    const [ratingStatus, setRatingStatus] = useState<string | null>(null);
    const [ratingRecord, setRatingRecord] = useState<HrmrRating | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const [admonitions, setAdmonitions] = useState(() => loadAiSettings().admonitionVisibility);

    useEffect(() => {
        const handler = () => setAdmonitions(loadAiSettings().admonitionVisibility);
        window.addEventListener('ai-settings-updated', handler);
        return () => window.removeEventListener('ai-settings-updated', handler);
    }, []);

    const hasTextContent = useMemo(() => Boolean(message.content?.trim().length), [message.content]);

    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const handleCopy = async () => {
        if (!hasTextContent) return;
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(message.content);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = message.content;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy message:', error);
            setPostError('Could not copy to clipboard.');
            setTimeout(() => setPostError(null), 4000);
        }
    };

    const handleSpeak = () => {
        if (!hasTextContent) return;
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            setPostError('Text-to-speech is not supported in this browser.');
            setTimeout(() => setPostError(null), 4000);
            return;
        }

        const synthesis = window.speechSynthesis;

        if (isSpeaking) {
            synthesis.cancel();
            setIsSpeaking(false);
            return;
        }

        const utterance = new SpeechSynthesisUtterance(stripMarkdown(message.content));
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        utteranceRef.current = utterance;
        synthesis.cancel();
        synthesis.speak(utterance);
        setIsSpeaking(true);
    };

    const handlePostAction = async (action: PostProcessingAction) => {
        if (!hasTextContent || processingAction === action) return;
        setPostError(null);
        setProcessingAction(action);
        try {
            const result = await runPostProcessing(action, message.content, message.role);
            setPostResults(prev => ({ ...prev, [action]: result }));
        } catch (error) {
            console.error(`Post-processing (${action}) failed:`, error);
            setPostError('Unable to run post-processing. Double-check AI settings and try again.');
            setTimeout(() => setPostError(null), 5000);
        } finally {
            setProcessingAction(null);
        }
    };

    useEffect(() => {
        if (message.role !== 'agent') return;
        (async () => {
            try {
                const existing = await getHrmrRatingByMessageId(message.id);
                if (existing) {
                    setCurrentGrade(existing.grade);
                    setRatingRecord(existing);
                }
            } catch (error) {
                console.error('Failed to load HRMR rating:', error);
            }
        })();
    }, [message.id, message.role]);

    const modulesUsed = useMemo(() => {
        const moduleSet = new Set<string>();
        Object.keys(postResults).forEach((key) => {
            const info = POST_PROCESSING_DETAILS[key as PostProcessingAction];
            if (info?.relatedModules) {
                info.relatedModules.forEach(m => moduleSet.add(m));
            }
        });
        if (message.agentResponseParts?.internalMonologue) moduleSet.add('Monologue');
        if (message.agentResponseParts?.stageDirections) moduleSet.add('Stage');
        if (message.agentResponseParts?.preflection) moduleSet.add('Preflection');
        if (message.agentResponseParts?.memory) moduleSet.add('Memory');
        if (message.agentResponseParts?.tasks?.length) moduleSet.add('Tasking');
        return Array.from(moduleSet);
    }, [postResults, message.agentResponseParts]);

    const handleGradeSelect = async (grade: HrmrGrade) => {
        if (message.role !== 'agent' || !message.agentResponseParts) return;
        setRatingStatus(null);
        try {
            const now = Date.now();
            const record: HrmrRating = {
                id: message.id,
                messageId: message.id,
                grade,
                agentResponse: message.agentResponseParts.response || message.content,
                preflection: message.agentResponseParts.preflection,
                internalMonologue: message.agentResponseParts.internalMonologue,
                stageDirections: message.agentResponseParts.stageDirections,
                tasks: message.agentResponseParts.tasks,
                memorySummary: message.agentResponseParts.memory?.summary,
                modulesUsed,
                createdAt: ratingRecord?.createdAt ?? now,
                updatedAt: now
            };
            await upsertHrmrRating(record);
            setCurrentGrade(grade);
            setRatingRecord(record);
            setRatingStatus('Saved');
            setIsRatingOpen(false);
        } catch (error) {
            console.error('Failed to store HRMR rating:', error);
            setRatingStatus('Could not save rating.');
        } finally {
            setTimeout(() => setRatingStatus(null), 3000);
        }
    };

    const handleClearRating = async () => {
        try {
            await deleteHrmrRating(message.id);
            setCurrentGrade(null);
            setRatingRecord(null);
            setRatingStatus('Rating cleared.');
        } catch (error) {
            console.error('Failed to clear HRMR rating:', error);
            setRatingStatus('Could not clear rating.');
        } finally {
            setIsRatingOpen(false);
            setTimeout(() => setRatingStatus(null), 3000);
        }
    };

    const isPerformerMessage = !isUser && !!message.performerId;
    const isUserSpeakingAsPerformer = isUser && !!message.speakerPersonaId;
    const speakerName = isUser ? (message.speakerPersonaName || 'You') : (message.performerName || 'Seasuite');
    const collaboratorNote = !isUser && message.collaborators?.length
        ? `With ${message.collaborators.join(', ')}`
        : null;
    const avatarClass = isUser
        ? 'bg-purple-600'
        : isPerformerMessage
            ? 'bg-amber-500'
            : 'bg-blue-600';

    return (
        <div className={`flex items-start gap-4 p-4 ${isUser ? '' : 'bg-gray-800/20'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${avatarClass}`}>
                {isUser ? <UserIcon className="w-5 h-5" /> : <AgentIcon className="w-5 h-5 text-gray-900" />}
            </div>
            <div className="flex-1 overflow-hidden">
                <div className="font-bold text-gray-200 flex items-center gap-2">
                    <span>{speakerName}</span>
                    {isPerformerMessage && (
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-amber-500/20 border border-amber-400/40 text-amber-200 rounded-full">
                            Performer
                        </span>
                    )}
                    {isUserSpeakingAsPerformer && (
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-purple-500/20 border border-purple-400/40 text-purple-200 rounded-full">
                            In Character
                        </span>
                    )}
                    {message.rewriteStatus === 'rewritten' && (
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 rounded-full">
                            Prompt Rewrite
                        </span>
                    )}
                    {!isUser && !isPerformerMessage && message.collaborators?.length ? (
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-blue-500/20 border border-blue-400/40 text-blue-200 rounded-full">
                            Boardroom
                        </span>
                    ) : null}
                </div>
                {collaboratorNote && (
                    <div className="text-xs text-gray-400 mt-1">{collaboratorNote}</div>
                )}
                
                {message.image && (
                    <div className="mt-2">
                        <img src={message.image} alt="user upload" className="max-w-xs rounded-lg border border-gray-700" />
                    </div>
                )}
                
                <div className="space-y-2">
                    <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                        </ReactMarkdown>
                    </div>
                    {message.metadata?.mission && (
                        <MissionProgressInline missionMetadata={message.metadata.mission} />
                    )}
                    {message.metadata?.escortResult && message.metadata?.escortName && (
                        <EscortPanel
                            result={message.metadata.escortResult}
                            escortName={message.metadata.escortName}
                        />
                    )}
                    {message.rewrittenContent && message.rewrittenContent.trim().length > 0 && message.rewrittenContent !== message.content && (
                        <div className="text-xs text-blue-300 bg-blue-900/20 border border-blue-600/30 rounded-md px-3 py-2">
                            <span className="uppercase tracking-wider font-semibold text-blue-200 mr-2">Rewritten</span>
                            <ReactMarkdown remarkPlugins={[remarkGfm]} className="inline prose prose-invert">
                                {message.rewrittenContent}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                <PostProcessingToolbar
                    onCopy={handleCopy}
                    onSpeak={handleSpeak}
                    isSpeaking={isSpeaking}
                    onAction={handlePostAction}
                    inFlightAction={processingAction}
                    disabled={!hasTextContent}
                    onOpenRating={() => {
                        if (isUser) return;
                        setIsRatingOpen(prev => !prev);
                    }}
                    currentGrade={isUser ? null : currentGrade}
                    showRating={!isUser}
                />

                <div className="mt-2 text-xs min-h-[18px]">
                    {postError ? (
                        <span className="text-red-400">{postError}</span>
                    ) : copied ? (
                        <span className="text-green-400">Copied to clipboard.</span>
                    ) : ratingStatus ? (
                        <span className="text-blue-300">{ratingStatus}</span>
                    ) : null}
                </div>

                {isRatingOpen && !isUser && (
                    <div className="mt-3 bg-[#1a1c1f] border border-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs uppercase tracking-wider text-gray-400">Rate Response</span>
                            {currentGrade && (
                                <button
                                    onClick={handleClearRating}
                                    className="text-xs text-red-400 hover:text-red-300"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                            {HRMR_GRADE_SCALE.map(grade => (
                                <button
                                    key={grade}
                                    onClick={() => handleGradeSelect(grade)}
                                    className={`px-2 py-1 rounded-md text-sm font-semibold border transition-colors ${
                                        currentGrade === grade
                                            ? 'bg-blue-600 border-blue-400 text-white'
                                            : 'bg-[#26282B] border-gray-700 text-gray-200 hover:bg-gray-700/60'
                                    }`}
                                >
                                    {grade}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {parts && (
                    <div className="mt-4 space-y-3">
                        {parts.preflection && admonitions.preflection && <PreflectionPanel instruction={parts.preflection} />}
                        {parts.internalMonologue && admonitions.monologue && <MonologuePanel monologue={parts.internalMonologue} />}
                        {parts.stageDirections && admonitions.stageDirections && <StageDirectionsPanel directions={parts.stageDirections} />}
                        {parts.memory && admonitions.memory && <MemorySavedPanel memory={parts.memory} />}
                        {parts.tasks && parts.tasks.length > 0 && admonitions.tasks && <TaskListPanel tasks={parts.tasks} />}
                        {parts.audit && admonitions.audit && <AuditPanel auditResult={parts.audit} />}
                    </div>
                )}

                {admonitions.postProcessing && POST_PROCESSING_ACTIONS.filter(def => postResults[def.id]).length > 0 && (
                    <div className="mt-4 space-y-3">
                        {POST_PROCESSING_ACTIONS.filter(def => postResults[def.id]).map(def => (
                            <div
                                key={def.id}
                                className="border border-gray-700/70 rounded-lg bg-[#1d1f22] p-4 shadow-inner"
                            >
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                                    <def.Icon className="w-4 h-4 text-blue-300" />
                                    <span>{def.label}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {POST_PROCESSING_DETAILS[def.id].relatedModules.map(module => (
                                        <span key={module} className="text-[10px] uppercase tracking-wider bg-blue-900/30 text-blue-200 px-2 py-0.5 rounded-full border border-blue-600/30">
                                            {module}
                                        </span>
                                    ))}
                                </div>
                                <div className="mt-2 prose prose-invert prose-sm max-w-none text-gray-300">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {postResults[def.id] as string}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessage;
