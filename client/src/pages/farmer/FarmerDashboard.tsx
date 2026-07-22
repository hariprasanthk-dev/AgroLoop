import React, { useEffect } from 'react';
import { Package, TrendingUp, ShoppingCart, Leaf, MapPin } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useInventoryStore } from '../../stores/inventory.store';
import { useOrderStore } from '../../stores/order.store';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency, formatDate, formatWeight, getCategoryIcon } from '../../utils/helpers';

const FarmerDashboard: React.FC = () => {
  const { batches, stats, isLoading, fetchBatches, fetchStats } = useInventoryStore();
  const { orders, fetchOrders } = useOrderStore();

  useEffect(() => {
    fetchBatches({ limit: 50 });
    fetchStats();
    fetchOrders({ limit: 50 });
  }, [fetchBatches, fetchStats, fetchOrders]);

  const totalKg     = batches.reduce((s, b) => s + b.quantityKg, 0);
  const availableKg = batches.filter(b => b.status === 'available').reduce((s, b) => s + b.quantityKg, 0);
  const earnings    = orders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + o.totalAmount, 0);

  // Per-category stats from the store (aggregated from server)
  const catStats = ['fresh', 'sprouted', 'rotten'].map(cat => {
    const s = stats.find(x => x._id === cat);
    return { cat, totalKg: s?.totalQuantityKg ?? 0, available: s?.availableQuantityKg ?? 0 };
  });

  const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
  const chartData = paidOrders.slice(0, 7).reverse().map(o => ({
    date: formatDate(o.createdAt),
    amount: o.totalAmount,
  }));

  if (isLoading) return <LoadingSpinner className="min-h-[60vh]" size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Top Stat Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Earnings"  value={formatCurrency(earnings)}                                     subtitle="From paid orders"          icon={<TrendingUp   className="w-5 h-5 text-emerald-400" />} iconBg="bg-emerald-500/10" delay={0}   />
        <StatCard title="Active Batches"  value={batches.filter(b => b.status === 'available').length}         subtitle="Available for sale"        icon={<Leaf         className="w-5 h-5 text-amber-400"   />} iconBg="bg-amber-500/10"   delay={100} />
        <StatCard title="Total Stock"     value={formatWeight(totalKg)}                                        subtitle={`${formatWeight(availableKg)} available`} icon={<Package className="w-5 h-5 text-blue-400" />} iconBg="bg-blue-500/10"    delay={200} />
        <StatCard title="Total Orders"    value={orders.length}                                                subtitle={`${orders.filter(o => o.orderStatus === 'pending').length} pending`} icon={<ShoppingCart className="w-5 h-5 text-purple-400" />} iconBg="bg-purple-500/10"  delay={300} />
      </div>

      {/* ── Category Breakdown ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { cat: 'fresh',    label: 'Fresh (Grade A)', color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30', textColor: 'text-emerald-400' },
          { cat: 'sprouted', label: 'Sprouted',         color: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',     textColor: 'text-amber-400'   },
          { cat: 'rotten',   label: 'Rotten',           color: 'from-red-500/20 to-red-500/5 border-red-500/30',           textColor: 'text-red-400'     },
        ].map(({ cat, label, color, textColor }) => {
          const cs = catStats.find(c => c.cat === cat) ?? { totalKg: 0, available: 0 };
          return (
            <div key={cat} className={`glass-card p-5 bg-gradient-to-br ${color} border`}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{getCategoryIcon(cat)}</span>
                <div>
                  <p className="font-bold text-slate-200">{label}</p>
                  <p className="text-xs text-slate-500">{batches.filter(b => b.category === cat).length} batch{batches.filter(b => b.category === cat).length !== 1 ? 'es' : ''}</p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total Stock</span>
                  <span className={`font-bold ${textColor}`}>{formatWeight(cs.totalKg)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Available</span>
                  <span className="text-slate-300 font-medium">{formatWeight(cs.available)}</span>
                </div>
                {/* Mini progress bar */}
                <div className="mt-2 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      cat === 'fresh' ? 'bg-emerald-500' : cat === 'sprouted' ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: cs.totalKg > 0 ? `${Math.round((cs.available / cs.totalKg) * 100)}%` : '0%' }}
                  />
                </div>
                <p className="text-xs text-slate-600 text-right">
                  {cs.totalKg > 0 ? Math.round((cs.available / cs.totalKg) * 100) : 0}% available
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sales / Earnings Chart ─────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-5">Sales Statistics</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill:'#64748B', fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#64748B', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor:'#1E293B', border:'1px solid rgba(100,116,139,0.3)', borderRadius:'12px', color:'#CBD5E1' }}
                formatter={(value) => [formatCurrency(Number(value)), 'Earnings']}
              />
              <Area type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} fill="url(#earningsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Recent Activity ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Batches */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Recent Batches</h3>
            <a href="/farmer/inventory" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">Manage →</a>
          </div>
          {batches.length === 0 ? (
            <div className="empty-state text-sm">No batches yet</div>
          ) : (
            <div className="space-y-3">
              {batches.slice(0, 5).map(batch => (
                <div key={batch._id} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getCategoryIcon(batch.category)}</span>
                    <div>
                      <p className="font-medium text-slate-200 capitalize">{batch.category} Onions</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        {formatWeight(batch.quantityKg)} · {formatCurrency(batch.pricePerKg)}/kg
                        <MapPin className="w-3 h-3 ml-1" /> {batch.location}
                      </p>
                    </div>
                  </div>
                  <Badge label={batch.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Recent Orders</h3>
            <a href="/farmer/orders" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">View all →</a>
          </div>
          {orders.length === 0 ? (
            <div className="empty-state text-sm">No orders received yet</div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map(order => {
                const client = typeof order.clientId === 'object' ? order.clientId : null;
                return (
                  <div key={order._id} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
                    <div>
                      <p className="font-medium text-slate-200">{client?.name ?? 'Client'}</p>
                      <p className="text-xs text-slate-500">{formatWeight(order.quantityKg)} · {formatDate(order.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge label={order.orderStatus} />
                      <span className="text-xs text-emerald-400 font-semibold">{formatCurrency(order.totalAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FarmerDashboard;
