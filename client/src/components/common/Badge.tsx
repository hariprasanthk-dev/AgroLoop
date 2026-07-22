import React from 'react';
import { getStatusColor, getCategoryColor } from '../../utils/helpers';

interface BadgeProps {
  label: string;
  type?: 'status' | 'category' | 'custom';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ label, type = 'status', className = '' }) => {
  const colorClass =
    type === 'category'
      ? getCategoryColor(label)
      : getStatusColor(label);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass} ${className}`}
    >
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
};

export default Badge;
