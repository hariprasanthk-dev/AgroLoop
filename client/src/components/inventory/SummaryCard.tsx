import React from 'react';

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}

/**
 * A stat card used in the FarmerInventory summary section.
 * Accepts a color class string (e.g. 'border-emerald-500/30') and derives
 * its background tint automatically.
 */
const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, sub, color }) => (
  <div className={`glass-card p-5 flex items-center gap-4 border ${color}`}>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color.replace('border-', 'bg-').replace('/30', '/10')}`}>
      {icon}
    </div>
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
      <p className="text-xl font-bold text-slate-100 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  </div>
);

export default SummaryCard;
