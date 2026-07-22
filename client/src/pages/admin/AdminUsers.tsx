import React, { useEffect, useState } from 'react';
import { Search, Trash2, ShieldCheck } from 'lucide-react';
import { userApi } from '../../api/user.api';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatDate, getInitials } from '../../utils/helpers';
import type { User } from '../../types';

const roleBadge: Record<string, string> = {
  admin:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  farmer: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  client: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    userApi.list().then(res => { setUsers(res.data.data ?? []); setIsLoading(false); });
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    await userApi.delete(deleteId);
    setUsers(prev => prev.filter(u => u._id !== deleteId));
    setDeleteId(null);
  };

  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{users.length} registered users</p>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" className="input-field pl-10" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? <LoadingSpinner className="py-20" /> : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>User</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-16 text-slate-500">No users found</td></tr>
                ) : filtered.map(user => (
                  <tr key={user._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-700/60 border border-slate-600/50 flex items-center justify-center text-sm font-bold text-slate-300">
                          {getInitials(user.name)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleBadge[user.role] ?? ''}`}>
                        <ShieldCheck className="w-3 h-3" />
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="text-slate-400">{formatDate(user.createdAt)}</td>
                    <td>
                      <button onClick={() => setDeleteId(user._id)} className="btn-danger">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete User" size="sm">
        <p className="text-slate-400 text-sm mb-5">This will permanently delete the user account.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger border">Delete User</button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminUsers;
