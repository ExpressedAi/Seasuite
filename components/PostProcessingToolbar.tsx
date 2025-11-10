import React from 'react';
import {
    CopyIcon,
    SpeakerIcon,
    SentimentIcon,
    InsightIcon,
    TraceIcon,
    CalendarSparkIcon,
    SpatialIcon,
    TemporalIcon,
    BiasIcon,
    HistoryIcon,
    GradeIcon
} from './icons/Icons';
import { PostProcessingAction, POST_PROCESSING_DETAILS } from '../services/aiService';

export interface PostProcessingActionDefinition {
    id: PostProcessingAction;
    label: string;
    description: string;
    Icon: React.FC<React.SVGProps<SVGSVGElement>>;
    iconOnly?: boolean;
}

export const POST_PROCESSING_ACTIONS: PostProcessingActionDefinition[] = [
    {
        id: 'sentiment',
        label: POST_PROCESSING_DETAILS.sentiment.label,
        description: POST_PROCESSING_DETAILS.sentiment.tagline,
        Icon: SentimentIcon,
        iconOnly: true
    },
    {
        id: 'subtext',
        label: POST_PROCESSING_DETAILS.subtext.label,
        description: POST_PROCESSING_DETAILS.subtext.tagline,
        Icon: InsightIcon,
        iconOnly: true
    },
    {
        id: 'reverse',
        label: POST_PROCESSING_DETAILS.reverse.label,
        description: POST_PROCESSING_DETAILS.reverse.tagline,
        Icon: TraceIcon,
        iconOnly: true
    },
    {
        id: 'calendar',
        label: POST_PROCESSING_DETAILS.calendar.label,
        description: POST_PROCESSING_DETAILS.calendar.tagline,
        Icon: CalendarSparkIcon,
        iconOnly: true
    },
    {
        id: 'spatial',
        label: POST_PROCESSING_DETAILS.spatial.label,
        description: POST_PROCESSING_DETAILS.spatial.tagline,
        Icon: SpatialIcon,
        iconOnly: true
    },
    {
        id: 'temporal',
        label: POST_PROCESSING_DETAILS.temporal.label,
        description: POST_PROCESSING_DETAILS.temporal.tagline,
        Icon: TemporalIcon,
        iconOnly: true
    },
    {
        id: 'bias',
        label: POST_PROCESSING_DETAILS.bias.label,
        description: POST_PROCESSING_DETAILS.bias.tagline,
        Icon: BiasIcon,
        iconOnly: true
    },
    {
        id: 'history',
        label: POST_PROCESSING_DETAILS.history.label,
        description: POST_PROCESSING_DETAILS.history.tagline,
        Icon: HistoryIcon,
        iconOnly: true
    }
];

interface MessageActionButtonProps {
    onClick: () => void;
    disabled?: boolean;
    isActive?: boolean;
    label: string;
    tooltip: string;
    children: React.ReactNode;
    iconOnly?: boolean;
}

const MessageActionButton: React.FC<MessageActionButtonProps> = ({
    onClick,
    disabled = false,
    isActive = false,
    label,
    tooltip,
    children,
    iconOnly = false
}) => (
    <div className="relative group">
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center ${iconOnly ? 'justify-center w-9 h-9 p-0' : 'gap-2 px-3 py-1.5'} rounded-full border border-gray-700/70 bg-gray-900/60 text-xs font-medium tracking-wide text-gray-300 hover:bg-gray-800/70 hover:border-gray-600 transition-colors shadow-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <span className="flex items-center justify-center w-4 h-4">
                {isActive ? (
                    <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                    children
                )}
            </span>
            {!iconOnly && <span>{label}</span>}
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 text-[10px] rounded-md bg-gray-900 text-gray-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg ring-1 ring-black/40">
            {tooltip}
        </div>
    </div>
);

interface PostProcessingToolbarProps {
    onCopy: () => void;
    onSpeak: () => void;
    isSpeaking: boolean;
    onAction: (action: PostProcessingAction) => void;
    inFlightAction: PostProcessingAction | null;
    disabled?: boolean;
    onOpenRating: () => void;
    currentGrade?: string | null;
    showRating?: boolean;
}

const PostProcessingToolbar: React.FC<PostProcessingToolbarProps> = ({
    onCopy,
    onSpeak,
    isSpeaking,
    onAction,
    inFlightAction,
    disabled = false,
    onOpenRating,
    currentGrade,
    showRating = true
}) => {
    return (
        <div className="flex flex-wrap items-center gap-2 mt-3">
            <MessageActionButton
                onClick={onCopy}
                label="Copy"
                tooltip="Copy message to clipboard"
                disabled={disabled}
            >
                <CopyIcon className="w-4 h-4" />
            </MessageActionButton>

            <MessageActionButton
                onClick={onSpeak}
                label={isSpeaking ? 'Stop' : 'Listen'}
                tooltip={isSpeaking ? 'Stop playback' : 'Listen to this message'}
                disabled={disabled}
            >
                <SpeakerIcon className={`w-4 h-4 ${isSpeaking ? 'text-blue-300' : ''}`} />
            </MessageActionButton>

            {showRating && (
                <MessageActionButton
                    onClick={onOpenRating}
                    label={currentGrade ? currentGrade : 'Grade'}
                    tooltip={currentGrade ? `Current rating: ${currentGrade}` : 'Rate this response'}
                    disabled={disabled}
                >
                    <GradeIcon className="w-4 h-4" />
                </MessageActionButton>
            )}

            {POST_PROCESSING_ACTIONS.map(({ id, label, description, Icon, iconOnly }) => (
                <MessageActionButton
                    key={id}
                    onClick={() => onAction(id)}
                    label={label}
                    tooltip={description}
                    isActive={inFlightAction === id}
                    disabled={disabled}
                    iconOnly={iconOnly}
                >
                    <Icon className="w-4 h-4" />
                </MessageActionButton>
            ))}
        </div>
    );
};

export default PostProcessingToolbar;
