import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  iconBg?: string;
  delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({
  title, value, subtitle, icon, trend, iconBg = 'bg-emerald-500/10', delay = 0
}) => (
  <div
    className="stat-card animate-slide-up"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.value >= 0
              ? <TrendingUp className="w-3.5 h-3.5" />
              : <TrendingDown className="w-3.5 h-3.5" />}
            <span>{Math.abs(trend.value)}% {trend.label}</span>
          </div>
        )}
      </div>
      <div className={`${iconBg} p-3 rounded-xl`}>
        {icon}
      </div>
    </div>
  </div>
);

export default StatCard;
