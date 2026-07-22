import React, { useEffect } from 'react';
import { Package, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import StatCard from '../../components/common/StatCard';
import { useAdminStore } from '../../stores/admin.store';
import { useOrderStore } from '../../stores/order.store';
import { formatCurrency, formatWeight } from '../../utils/helpers';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const CATEGORY_COLORS: Record<string, string> = {
  fresh: '#10B981', sprouted: '#F59E0B', rotten: '#EF4444',
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: '#3B82F6',
  accepted: '#8B5CF6',
  packed: '#06B6D4',
  shipped: '#F59E0B',
  delivered: '#10B981',
  cancelled: '#EF4444',
};

const AdminDashboard: React.FC = () => {
  const { stats, isLoading: adminLoading, fetchStats } = useAdminStore();
  const { orders, isLoading: orderLoading, fetchOrders } = useOrderStore();

  useEffect(() => {
    fetchStats();
    fetchOrders({ limit: 5 });
  }, [fetchStats, fetchOrders]);

  if (adminLoading || orderLoading) {
    return <LoadingSpinner className="min-h-[60vh]" size="lg" />;
  }

  const data = stats;
  if (!data) {
    return (
      <div className="text-center py-20 glass-card">
        <p className="text-slate-400 text-lg">Failed to load admin statistics.</p>
        <button onClick={() => fetchStats()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  // Inventory donut data
  const pieData = [
    { name: 'Fresh (Grade A)', value: data.inventoryBreakdown.fresh, color: CATEGORY_COLORS.fresh },
    { name: 'Sprouted', value: data.inventoryBreakdown.sprouted, color: CATEGORY_COLORS.sprouted },
    { name: 'Rotten', value: data.inventoryBreakdown.rotten, color: CATEGORY_COLORS.rotten },
  ].filter(item => item.value > 0);

  // Orders status bar data
  const barData = Object.entries(data.orderBreakdown).map(([status, count]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1),
    Orders: count,
    color: ORDER_STATUS_COLORS[status] ?? '#64748B',
  }));

  // Sales Trend chart data
  const chartSalesData = data.salesHistory.map(h => ({
    date: new Date(h._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Revenue: h.revenue,
    Orders: h.count,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Top stats grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          title="Total Farmers"
          value={data.totalFarmers}
          subtitle="Registered suppliers"
          icon={<Users className="w-5 h-5 text-emerald-400" />}
          iconBg="bg-emerald-500/10"
          delay={0}
        />
        <StatCard
          title="Total Clients"
          value={data.totalClients}
          subtitle="Registered buyers"
          icon={<Users className="w-5 h-5 text-blue-400" />}
          iconBg="bg-blue-500/10"
          delay={100}
        />
        <StatCard
          title="Total Inventory"
          value={formatWeight(data.totalInventoryKg)}
          subtitle="Stored stock"
          icon={<Package className="w-5 h-5 text-amber-400" />}
          iconBg="bg-amber-500/10"
          delay={200}
        />
        <StatCard
          title="Total Orders"
          value={data.totalOrders}
          subtitle={`${data.orderBreakdown.pending} pending`}
          icon={<ShoppingCart className="w-5 h-5 text-purple-400" />}
          iconBg="bg-purple-500/10"
          delay={300}
        />
        <StatCard
          title="Revenue"
          value={formatCurrency(data.revenue)}
          subtitle="From paid checkout"
          icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
          iconBg="bg-emerald-500/10"
          delay={400}
        />
      </div>

      {/* ── Waste Analytics & Circular Economy ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 glass-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Waste Statistics & Supply Classification</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-400 uppercase font-medium">Fresh (Grade A)</span>
                <span className="text-xl">🧅</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{formatWeight(data.wasteStats.freshKg)}</p>
              <p className="text-xs text-emerald-400 mt-1">High quality, newly harvested</p>
            </div>

            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-400 uppercase font-medium">Sprouted (Salvaged)</span>
                <span className="text-xl">🌱</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{formatWeight(data.wasteStats.sproutedKg)}</p>
              <p className="text-xs text-amber-400 mt-1">Reclassified & reusable</p>
            </div>

            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-400 uppercase font-medium">Rotten (Waste)</span>
                <span className="text-xl">♻️</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{formatWeight(data.wasteStats.rottenKg)}</p>
              <p className="text-xs text-red-400 mt-1">Expired / unsold long duration</p>
            </div>
          </div>
        </div>

        {/* Circular Gauge */}
        <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 self-start">Waste Reduction</h3>
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="rgba(71,85,105,0.2)" strokeWidth="8" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#10B981"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 40}
                strokeDashoffset={2 * Math.PI * 40 * (1 - data.wasteStats.wasteReductionPercent / 100)}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-white">{data.wasteStats.wasteReductionPercent}%</span>
              <span className="text-[9px] text-slate-500 uppercase font-semibold">Saved</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
            Supply salvaged via sprouted reclassification instead of rotting.
          </p>
        </div>
      </div>

      {/* ── Interactive Analytics Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales & Revenue History */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-5">Sales & Revenue Trend (30 Days)</h3>
          {chartSalesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartSalesData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', border: '1px solid rgba(100,116,139,0.3)', borderRadius: '12px', color: '#CBD5E1' }}
                  formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                />
                <Area type="monotone" dataKey="Revenue" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state h-[240px]">No sales transactions in the last 30 days.</div>
          )}
        </div>

        {/* Inventory Distribution */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-5">Inventory Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', border: '1px solid rgba(100,116,139,0.3)', borderRadius: '12px', color: '#CBD5E1' }}
                  formatter={(value) => [formatWeight(Number(value)), 'Quantity']}
                />
                <Legend formatter={(v) => <span className="text-xs text-slate-400">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state h-[240px]">No inventory data available.</div>
          )}
        </div>

        {/* Orders by Status */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-5">Orders by Status</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" vertical={false} />
                <XAxis dataKey="status" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid rgba(100,116,139,0.3)', borderRadius: '12px', color: '#CBD5E1' }} />
                <Bar dataKey="Orders" radius={[6, 6, 0, 0]}>
                  {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state h-[240px]">No orders data available.</div>
          )}
        </div>

        {/* Recent Orders List */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Recent Orders</h3>
            <a href="/admin/orders" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">View all →</a>
          </div>
          {orders.length === 0 ? (
            <div className="empty-state h-[240px]">No orders yet.</div>
          ) : (
            <div className="space-y-3.5">
              {orders.slice(0, 5).map(order => {
                const client = typeof order.clientId === 'object' ? order.clientId : null;
                const batch  = typeof order.inventoryBatchId === 'object' ? order.inventoryBatchId : null;
                return (
                  <div key={order._id} className="flex items-center justify-between py-2 border-b border-slate-700/20 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-700/40 rounded-xl flex items-center justify-center text-sm font-bold text-slate-300">
                        📦
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{client?.name ?? 'Client'}</p>
                        <p className="text-xs text-slate-500">{batch ? `${batch.category} · ${order.quantityKg}kg` : `${order.quantityKg}kg`}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge label={order.orderStatus} />
                      <span className="text-xs font-semibold text-slate-400">{formatCurrency(order.totalAmount)}</span>
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

export default AdminDashboard;
