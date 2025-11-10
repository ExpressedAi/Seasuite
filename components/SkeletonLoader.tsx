import React from 'react';

interface SkeletonProps {
    className?: string;
    lines?: number;
    circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', lines = 1, circle = false }) => {
    if (circle) {
        return (
            <div
                className={`animate-pulse bg-gray-700/50 rounded-full ${className}`}
                aria-label="Loading..."
            />
        );
    }

    if (lines > 1) {
        return (
            <div className={`space-y-2 ${className}`}>
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className={`h-4 animate-pulse bg-gray-700/50 rounded ${
                            i === lines - 1 ? 'w-3/4' : 'w-full'
                        }`}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            className={`h-4 animate-pulse bg-gray-700/50 rounded ${className}`}
            aria-label="Loading..."
        />
    );
};

export const CardSkeleton: React.FC = () => (
    <div className="bg-[#1e1f20] rounded-lg p-6 border border-gray-700 animate-pulse">
        <Skeleton className="h-6 w-3/4 mb-4" />
        <Skeleton lines={3} className="mb-4" />
        <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
        </div>
    </div>
);

export const MessageSkeleton: React.FC = () => (
    <div className="flex gap-4 p-4 animate-pulse">
        <Skeleton circle className="w-10 h-10" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton lines={3} />
        </div>
    </div>
);

