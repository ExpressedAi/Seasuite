import { PerformerProfile, PerformerTraits } from '../types';

export const TRAIT_DEFINITIONS: Array<{
    key: keyof PerformerTraits;
    label: string;
    description: string;
}> = [
    { key: 'charisma', label: 'Charisma', description: 'Presence and ability to sway a room.' },
    { key: 'empathy', label: 'Empathy', description: 'Sensitivity to others and desire to keep harmony.' },
    { key: 'loyalty', label: 'Loyalty', description: 'Likelihood to defend teammates and stay aligned.' },
    { key: 'ambition', label: 'Ambition', description: 'Drive to climb, compete, and win.' },
    { key: 'volatility', label: 'Volatility', description: 'Emotional reactivity and dramatic swings.' },
    { key: 'cunning', label: 'Cunning', description: 'Comfort with secrets, misdirection, and gambits.' },
    { key: 'discipline', label: 'Discipline', description: 'Composure under pressure and focus on process.' },
    { key: 'curiosity', label: 'Curiosity', description: 'Instinct to probe, question, and explore ideas.' },
    { key: 'boldness', label: 'Boldness', description: 'Willingness to take social and strategic risks.' },
    { key: 'transparency', label: 'Transparency', description: 'Preference for openness versus hidden agendas.' }
];

export const DEFAULT_TRAITS: PerformerTraits = {
    charisma: 55,
    empathy: 55,
    loyalty: 55,
    ambition: 55,
    volatility: 45,
    cunning: 45,
    discipline: 55,
    curiosity: 55,
    boldness: 55,
    transparency: 50
};

export const withDefaultTraits = (traits?: Partial<PerformerTraits> | null): PerformerTraits => ({
    ...DEFAULT_TRAITS,
    ...(traits || {})
});

export const getPerformerTraits = (performer?: PerformerProfile | null): PerformerTraits =>
    withDefaultTraits(performer?.traits || null);

