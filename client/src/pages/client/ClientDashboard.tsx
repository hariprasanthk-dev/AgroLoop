import React, { useEffect } from 'react';
import { ShoppingCart, Package, CheckCircle, Wallet, Clock } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useOrderStore } from '../../stores/order.store';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency, formatDate, formatWeight, getCategoryIcon } from '../../utils/helpers';

const ClientDashboard: React.FC = () => {
  const { orders, isLoading, fetchOrders } = useOrderStore();

  useEffect(() => { fetchOrders({ limit: 50 }); }, [fetchOrders]);

  const totalSpent  = orders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + o.totalAmount, 0);
  const pendingPayments = orders.filter(o => ['accepted', 'packed', 'shipped', 'delivered'].includes(o.orderStatus) && o.paymentStatus === 'pending').length;
  const completedPayments = orders.filter(o => o.paymentStatus === 'paid').length;
  const totalKg     = orders.reduce((s, o) => s + o.quantityKg, 0);

  const chartData = orders.slice(0, 7).reverse().map(o => ({
    date: formatDate(o.createdAt),
    amount: o.totalAmount,
  }));

  if (isLoading) return <LoadingSpinner className="min-h-[60vh]" size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Spent"    value={formatCurrency(totalSpent)} subtitle="Completed payments"     icon={<Wallet       className="w-5 h-5 text-emerald-400" />} iconBg="bg-emerald-500/10" delay={0}   />
        <StatCard title="Pending Payments" value={pendingPayments}          subtitle="Awaiting checkout"       icon={<Clock        className="w-5 h-5 text-amber-400"   />} iconBg="bg-amber-500/10"   delay={100} />
        <StatCard title="Completed Payments" value={completedPayments}      subtitle="Successfully paid"       icon={<CheckCircle  className="w-5 h-5 text-emerald-400" />} iconBg="bg-emerald-500/10" delay={200} />
        <StatCard title="Total Purchased" value={formatWeight(totalKg)}     subtitle="Across all orders"       icon={<Package      className="w-5 h-5 text-blue-400"    />} iconBg="bg-blue-500/10"    delay={300} />
      </div>

      {chartData.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-5">Recent Spending</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill:'#64748B', fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#64748B', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor:'#1E293B', border:'1px solid rgba(100,116,139,0.3)', borderRadius:'12px', color:'#CBD5E1' }}
                formatter={(value) => [formatCurrency(Number(value)), 'Amount']}
              />
              <Area type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} fill="url(#spendGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">My Recent Orders</h3>
          <a href="/client/orders" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">View all →</a>
        </div>
        {orders.length === 0 ? (
          <div className="empty-state">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
            <p>No orders yet.</p>
            <a href="/client/browse" className="mt-3 btn-primary text-sm">Browse Inventory</a>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.slice(0, 6).map(order => {
              const batch = typeof order.inventoryBatchId === 'object' ? order.inventoryBatchId : null;
              return (
                <div key={order._id} className="flex items-center justify-between py-3 border-b border-slate-700/30 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center text-xl">
                      {getCategoryIcon(batch?.category ?? 'fresh')}
                    </div>
                    <div>
                      <p className="font-medium text-slate-200 capitalize">{batch?.category ?? 'Onion'} Onions</p>
                      <p className="text-xs text-slate-500">{formatWeight(order.quantityKg)} · {order.destination}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge label={order.orderStatus} />
                    <span className="text-sm font-semibold text-slate-300">{formatCurrency(order.totalAmount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;
