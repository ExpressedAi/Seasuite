import React, { useEffect } from 'react';
import { SocialSignal } from '../services/socialSignals';

const kindStyles: Record<SocialSignal['kind'], { border: string; background: string; text: string; accent: string }> = {
    pressure: {
        border: 'border-red-500/40',
        background: 'bg-red-500/10',
        text: 'text-red-200',
        accent: 'bg-red-500/20'
    },
    celebration: {
        border: 'border-emerald-500/40',
        background: 'bg-emerald-500/10',
        text: 'text-emerald-200',
        accent: 'bg-emerald-500/20'
    },
    secret: {
        border: 'border-purple-500/40',
        background: 'bg-purple-500/10',
        text: 'text-purple-200',
        accent: 'bg-purple-500/20'
    }
};

interface SocialAlertProps {
    signal: SocialSignal;
    onDismiss: (id: string) => void;
}

const SocialAlert: React.FC<SocialAlertProps> = ({ signal, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(signal.id), 12000);
        return () => clearTimeout(timer);
    }, [signal.id, onDismiss]);

    const styles = kindStyles[signal.kind];

    return (
        <div
            className={`mx-auto mt-3 w-full max-w-3xl rounded-xl border ${styles.border} ${styles.background} px-4 py-3 shadow-lg shadow-black/30 backdrop-blur-sm transition-transform hover:scale-[1.01]`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gray-400">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${styles.accent} ${styles.text}`}>
                            {signal.kind === 'pressure' ? 'Social Pressure' : signal.kind === 'celebration' ? 'Momentum' : 'Secret Ops'}
                        </span>
                        <span className="text-[10px] text-gray-500">{new Date(signal.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className={`mt-2 text-sm font-medium leading-relaxed ${styles.text}`}>
                        {signal.message}
                    </p>
                </div>
                <button
                    onClick={() => onDismiss(signal.id)}
                    className="text-gray-500 hover:text-gray-300"
                    aria-label="Dismiss social alert"
                >
                    <span className="text-lg leading-none">×</span>
                </button>
            </div>
        </div>
    );
};

export default SocialAlert;
