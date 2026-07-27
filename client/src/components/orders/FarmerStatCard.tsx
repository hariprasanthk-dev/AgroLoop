import React from 'react';

interface FarmerStatCardProps {
  label:      string;
  value:      string | number;
  icon:       React.ReactNode;
  colorClass: string;
  bgClass:    string;
}

/**
 * A compact stat card used in the FarmerOrders summary row.
 */
const FarmerStatCard: React.FC<FarmerStatCardProps> = ({ label, value, icon, colorClass, bgClass }) => (
  <div className={`glass-card p-4 border ${bgClass}`}>
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bgClass}`}>{icon}</div>
    </div>
    <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
  </div>
);

export default FarmerStatCard;
