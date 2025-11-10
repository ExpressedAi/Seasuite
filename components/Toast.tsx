import React, { useEffect, useState } from 'react';
import { XIcon } from './icons/Icons';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastProps {
    toast: Toast;
    onDismiss: (id: string) => void;
}

const ToastComponent: React.FC<ToastProps> = ({ toast, onDismiss }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const duration = toast.duration ?? 4000;
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => onDismiss(toast.id), 300);
        }, duration);
        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onDismiss]);

    const handleDismiss = () => {
        setIsExiting(true);
        setTimeout(() => onDismiss(toast.id), 300);
    };

    const typeStyles = {
        success: 'bg-green-600/90 border-green-500 text-white',
        error: 'bg-red-600/90 border-red-500 text-white',
        info: 'bg-blue-600/90 border-blue-500 text-white',
        warning: 'bg-amber-600/90 border-amber-500 text-white'
    };

    return (
        <div
            className={`mb-3 flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 ${
                isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
            } ${typeStyles[toast.type]}`}
            role="alert"
            aria-live="polite"
        >
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button
                onClick={handleDismiss}
                className="text-white/80 hover:text-white transition-colors"
                aria-label="Dismiss notification"
            >
                <XIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

interface ToastContainerProps {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
    if (toasts.length === 0) return null;

    return (
        <div
            className="fixed top-4 right-4 z-[100] max-w-md w-full pointer-events-none"
            aria-live="polite"
            aria-atomic="true"
        >
            <div className="pointer-events-auto">
                {toasts.map(toast => (
                    <ToastComponent key={toast.id} toast={toast} onDismiss={onDismiss} />
                ))}
            </div>
        </div>
    );
};

// Toast manager hook
let toastIdCounter = 0;
const toastListeners = new Set<(toast: Toast) => void>();

export const showToast = (message: string, type: ToastType = 'info', duration?: number) => {
    const toast: Toast = {
        id: `toast-${++toastIdCounter}-${Date.now()}`,
        message,
        type,
        duration
    };
    toastListeners.forEach(listener => listener(toast));
    return toast.id;
};

export const useToast = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const listener = (toast: Toast) => {
            setToasts(prev => [...prev, toast]);
        };
        toastListeners.add(listener);
        return () => {
            toastListeners.delete(listener);
        };
    }, []);

    const dismiss = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return { toasts, dismiss };
};

