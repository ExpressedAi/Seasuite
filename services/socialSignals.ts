import { ChatMessage, PerformerInteractionEvent, PerformerProfile } from '../types';
import { getPerformerTraits } from './socialModel';

const POSITIVE_LEXICON = new Set([
    'great', 'good', 'excellent', 'amazing', 'positive', 'love', 'like', 'success', 'win', 'progress', 'awesome', 'helpful', 'confident', 'proud'
]);

const NEGATIVE_LEXICON = new Set([
    'bad', 'terrible', 'awful', 'negative', 'hate', 'dislike', 'fail', 'problem', 'issue', 'worry', 'anxious', 'concern', 'angry', 'frustrated', 'annoyed'
]);

const BIAS_KEYWORDS = new Set(['always', 'never', 'must', 'everyone', 'noone', 'obviously', 'clearly']);

export const HIGH_INTRIGUE_THRESHOLD = 70;

export const KEYWORD_REGEX = /[a-z0-9]+/gi;

export interface SocialSignal {
    id: string;
    kind: 'pressure' | 'celebration' | 'secret';
    message: string;
    severity: number;
    timestamp: number;
    participants: string[];
    actorIds: string[];
    context: PerformerInteractionEvent['context'];
}

export const sanitizeText = (value: string): string => value?.replace(/[`*_#>\[\]]/g, ' ') ?? '';

export const addKeywordsFromText = (text: string | undefined, bucket: Set<string>) => {
    if (!text) return;
    const matches = sanitizeText(text).toLowerCase().match(KEYWORD_REGEX);
    matches?.forEach(word => {
        if (word.length > 2) {
            bucket.add(word);
        }
    });
};

export const buildKeywordSet = (prompt: string, history: ChatMessage[]): Set<string> => {
    const keywords = new Set<string>();
    addKeywordsFromText(prompt, keywords);
    history.slice(-6).forEach(msg => addKeywordsFromText(msg.content, keywords));
    return keywords;
};

export const calculateSentimentScore = (text: string): number => {
    if (!text) return 0;
    const words = sanitizeText(text).toLowerCase().match(/[a-z]+/g) || [];
    if (!words.length) return 0;
    let positive = 0;
    let negative = 0;
    words.forEach(word => {
        if (POSITIVE_LEXICON.has(word)) positive += 1;
        if (NEGATIVE_LEXICON.has(word)) negative += 1;
    });
    const total = positive + negative;
    if (!total) return 0;
    return (positive - negative) / total;
};

export const detectNarrativeTags = (text: string): string[] => {
    const tags: string[] = [];
    const lower = sanitizeText(text).toLowerCase();
    BIAS_KEYWORDS.forEach(keyword => {
        if (lower.includes(keyword)) {
            tags.push('bias');
        }
    });
    if (lower.includes('secret') || lower.includes('confidential')) {
        tags.push('secret');
    }
    if (lower.includes('mission') || lower.includes('objective')) {
        tags.push('mission');
    }
    return Array.from(new Set(tags));
};

export const collectIntrigueTags = (
    speaker: PerformerProfile | null,
    targetIds: string[],
    performerMap: Map<string, PerformerProfile>
): string[] => {
    const tags = new Set<string>();
    if (speaker?.intrigueLevel && speaker.intrigueLevel >= HIGH_INTRIGUE_THRESHOLD) {
        tags.add('speaker-high-intrigue');
    }
    targetIds.forEach(id => {
        const performer = performerMap.get(id);
        if (performer?.intrigueLevel && performer.intrigueLevel >= HIGH_INTRIGUE_THRESHOLD) {
            tags.add('target-high-intrigue');
        }
    });
    return Array.from(tags);
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const buildPressureMessage = (speaker: string, target: string, severity: number): string => {
    if (severity > 0.75) {
        return `${speaker}'s tone is rattling ${target}. The room feels electric.`;
    }
    if (severity > 0.55) {
        return `${speaker} puts ${target} on the spot—tension is spiking.`;
    }
    return `${speaker}'s comment lands sharp; ${target} looks uneasy.`;
};

const buildCelebrationMessage = (speaker: string, targets: string[]): string => {
    if (!targets.length) {
        return `${speaker}'s energy lifts the room.`;
    }
    if (targets.length === 1) {
        return `${speaker}'s encouragement fires up ${targets[0]}.`;
    }
    return `${speaker} rallies ${targets.join(' & ')}—momentum surges.`;
};

const buildSecretMessage = (speaker: string, targets: string[]): string => {
    if (!targets.length) {
        return `${speaker} is plotting behind the scenes.`;
    }
    if (targets.length === 1) {
        return `${speaker} trades hush-hush intel with ${targets[0]}.`;
    }
    return `${speaker} is spinning a covert thread with ${targets.join(' & ')}.`;
};

export const generateSocialSignals = (
    event: PerformerInteractionEvent,
    performerMap: Map<string, PerformerProfile>
): SocialSignal[] => {
    const context = event.context || 'public';
    const speakerProfile = performerMap.get(event.speakerId) || null;
    const speakerTraits = getPerformerTraits(speakerProfile || undefined);
    const sentiment = typeof event.sentiment === 'number' ? event.sentiment : 0;
    const magnitude = Math.abs(sentiment);
    const isPositive = sentiment >= 0.45;
    const isNegative = sentiment <= -0.25;
    const signals: SocialSignal[] = [];

    if (context === 'private' && (event.intrigueTags?.length || speakerTraits.cunning > 60)) {
        const severity = clamp01(0.4 + (speakerTraits.cunning / 100) * 0.6);
        signals.push({
            id: `${event.id}-secret`,
            kind: 'secret',
            message: buildSecretMessage(event.speakerName, event.targetNames),
            severity,
            timestamp: event.timestamp,
            participants: [event.speakerName, ...event.targetNames],
            actorIds: [event.speakerId, ...event.targetIds],
            context
        });
    }

    if (!event.targetIds.length) {
        return signals;
    }

    event.targetIds.forEach((targetId, index) => {
        const targetProfile = performerMap.get(targetId) || null;
        const targetTraits = getPerformerTraits(targetProfile || undefined);
        const targetName = event.targetNames[index] || targetProfile?.name || 'Unknown';

    if (isNegative) {
        const expressiveness = speakerTraits.charisma / 100;
        const volatility = targetTraits.volatility / 100;
        const resilience = 1 - (targetTraits.discipline + targetTraits.empathy + targetTraits.loyalty / 2) / 250;
        const contextWeight = context === 'public' ? 1.25 : 0.75;
        const severity = clamp01(magnitude * (0.55 + expressiveness * 0.35 + volatility * 0.6 + resilience * 0.6) * contextWeight);
            if (severity > 0.35) {
                signals.push({
                    id: `${event.id}-pressure-${targetId}`,
                    kind: 'pressure',
                    message: buildPressureMessage(event.speakerName, targetName, severity),
                    severity,
                    timestamp: event.timestamp,
                    participants: [event.speakerName, targetName],
                    actorIds: [event.speakerId, targetId],
                    context
                });
            }
        } else if (isPositive) {
            const magnetism = speakerTraits.charisma / 100;
            const empathy = speakerTraits.empathy / 100;
            const loyalty = targetTraits.loyalty / 100;
            const curiosity = speakerTraits.curiosity / 100;
            const contextWeight = context === 'public' ? 1.1 : 0.85;
            const severity = clamp01(
                magnitude * (0.45 + magnetism * 0.35 + empathy * 0.25 + loyalty * 0.35 + curiosity * 0.15) * contextWeight
            );
            if (severity > 0.4) {
                signals.push({
                    id: `${event.id}-celebration-${targetId}`,
                    kind: 'celebration',
                    message: buildCelebrationMessage(event.speakerName, [targetName]),
                    severity,
                    timestamp: event.timestamp,
                    participants: [event.speakerName, targetName],
                    actorIds: [event.speakerId, targetId],
                    context
                });
            }
        }
    });

    if (isPositive && event.targetIds.length > 1) {
        const combined = buildCelebrationMessage(event.speakerName, event.targetNames);
        const severity = clamp01(
            0.35 + magnitude * 0.35 + (speakerTraits.charisma / 100) * 0.2 + (speakerTraits.empathy / 100) * 0.15
        );
        signals.push({
            id: `${event.id}-celebration-group`,
            kind: 'celebration',
            message: combined,
            severity,
            timestamp: event.timestamp,
            participants: [event.speakerName, ...event.targetNames],
            actorIds: [event.speakerId, ...event.targetIds],
            context
        });
    }

    return signals;
};
