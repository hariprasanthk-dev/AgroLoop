import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '' }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <div
      className={`${sizeMap[size]} animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500`}
    />
  </div>
);

export default LoadingSpinner;
