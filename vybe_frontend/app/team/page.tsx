'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getAccessToken, getSavedUser } from '../utils/api';
import { 
  ShieldAlert, Users, AlertTriangle, CheckCircle, 
  Search, ShieldAlert as TeamIcon, ShieldCheck, UserCheck, 
  Clock, Slash, AlertCircle, Ban, ArrowLeft, ArrowUpRight, Coins
} from 'lucide-react';

export default function TeamPanel() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Dashboard tab: 'dashboard' | 'reports' | 'users'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'users'>('dashboard');

  // Stats State
  const [stats, setStats] = useState<any>({
    open_reports: 0,
    reports_resolved_today: 0,
    suspended_users: 0
  });

  // Reports State
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);

  // Users Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Modal State for Warnings & Suspensions
  const [showModModal, setShowModModal] = useState<any | null>(null);
  const [modReason, setModReason] = useState('');
  const [suspendDuration, setSuspendDuration] = useState('1h');
  const [modLoading, setModLoading] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    const user = getSavedUser();
    if (!token || !user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'TEAM' && user.role !== 'ADMIN') {
      router.push('/chat');
      return;
    }
    setCurrentUser(user);
    fetchStats();
    fetchReports();

    // AJAX background process: poll telemetry/stats every 8 seconds
    const statsInterval = setInterval(fetchStats, 8000);

    return () => {
      clearInterval(statsInterval);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const data = await apiFetch('/moderation/stats/');
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const data = await apiFetch('/reports/');
      setReports(data);
    } catch (err) {
      console.error("Error fetching reports:", err);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleFetchReportDetails = async (id: number) => {
    try {
      const data = await apiFetch(`/reports/${id}/`);
      setSelectedReport(data);
    } catch (err: any) {
      alert(`Error fetching report details: ${err.message}`);
    }
  };

  const handleResolveReport = async (id: number) => {
    try {
      await apiFetch(`/reports/${id}/resolve/`, { method: 'POST' });
      alert("Report resolved successfully.");
      if (selectedReport && selectedReport.id === id) {
        handleFetchReportDetails(id);
      }
      fetchReports();
      fetchStats();
    } catch (err: any) {
      alert(`Error resolving report: ${err.message}`);
    }
  };

  const handleUserSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSearch(true);
    try {
      const data = await apiFetch(`/users/search/?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data);
    } catch (err: any) {
      alert(`Search failed: ${err.message}`);
    } finally {
      setLoadingSearch(false);
    }
  };

  const fetchAllUsers = async () => {
    setLoadingSearch(true);
    setSearchQuery('');
    try {
      const data = await apiFetch('/users/search/');
      setSearchResults(data);
    } catch (err: any) {
      console.error("Error loading users:", err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleCardClick = async (filterType: 'reports' | 'status', value: string) => {
    if (filterType === 'reports') {
      setActiveTab('reports');
      fetchReports();
    } else if (filterType === 'status') {
      setActiveTab('users');
      setLoadingSearch(true);
      setSearchQuery('');
      try {
        const data = await apiFetch(`/users/search/?status=${value}`);
        setSearchResults(data);
      } catch (err: any) {
        console.error("Filter status failed:", err);
      } finally {
        setLoadingSearch(false);
      }
    }
  };

  const handleModSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showModModal || !modReason) return;
    
    setModLoading(true);
    const { type, targetUser, reportId } = showModModal;

    try {
      if (type === 'warn') {
        await apiFetch('/moderation/warn/', {
          method: 'POST',
          body: { user_id: targetUser.id, reason: modReason }
        });
        alert(`Warning issued to ${targetUser.username}.`);
      } else if (type === 'suspend') {
        await apiFetch('/moderation/suspend/', {
          method: 'POST',
          body: { user_id: targetUser.id, reason: modReason, duration: suspendDuration }
        });
        alert(`${targetUser.username} has been suspended.`);
      }

      if (reportId) {
        await handleResolveReport(reportId);
      }

      setShowModModal(null);
      setModReason('');
      fetchStats();
      fetchReports();
      
      if (searchQuery) {
        const freshData = await apiFetch(`/users/search/?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(freshData);
      }
    } catch (err: any) {
      alert(`Moderation failed: ${err.message}`);
    } finally {
      setModLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#070a13] text-white">
      {/* Top Header */}
      <header className="h-16 border-b border-white/5 bg-[#090d16]/95 backdrop-blur-md px-6 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/chat')}
            className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold tracking-wide flex items-center gap-2">
            <TeamIcon className="w-5 h-5 text-brand" />
            Moderator Panel
          </span>
        </div>
        <div className="text-xs text-gray-400">
          Logged in as <strong className="text-brand">{currentUser?.username}</strong> ({currentUser?.role})
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-grow flex flex-col md:flex-row max-w-7xl w-full mx-auto p-6 gap-6 overflow-hidden">
        {/* Sidebar Nav */}
        <nav className="flex md:flex-col gap-2 shrink-0 md:w-48 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-brand/10 text-brand border border-brand/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => {
              setActiveTab('reports');
              fetchReports();
            }}
            className={`px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'reports'
                ? 'bg-brand/10 text-brand border border-brand/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            Open Reports
            {stats.open_reports > 0 && (
              <span className="ml-2.5 px-2 py-0.5 bg-brand text-white text-[10px] rounded-full font-bold">
                {stats.open_reports}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('users');
              fetchAllUsers();
            }}
            className={`px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-brand/10 text-brand border border-brand/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            User Search
          </button>
        </nav>

        {/* Content Block */}
        <div className="flex-grow bg-zinc-900/40 border border-white/5 rounded-2xl p-6 overflow-y-auto">
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">Moderation Activity</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div 
                  onClick={() => handleCardClick('reports', '')}
                  className="bg-zinc-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-brand/40 hover:-translate-y-1 transition-all duration-300"
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Open Reports</span>
                    <h3 className="text-3xl font-extrabold mt-1.5">{stats.open_reports}</h3>
                  </div>
                  <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-500/15 rounded-xl flex items-center justify-center text-yellow-500">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>

                <div 
                  className="bg-zinc-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between text-gray-400 select-none"
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Resolved Today</span>
                    <h3 className="text-3xl font-extrabold mt-1.5">{stats.reports_resolved_today}</h3>
                  </div>
                  <div className="w-12 h-12 bg-green-500/10 border border-green-500/15 rounded-xl flex items-center justify-center text-green-500">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                </div>

                <div 
                  onClick={() => handleCardClick('status', 'SUSPENDED')}
                  className="bg-zinc-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-brand/40 hover:-translate-y-1 transition-all duration-300"
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Suspensions</span>
                    <h3 className="text-3xl font-extrabold mt-1.5">{stats.suspended_users}</h3>
                  </div>
                  <div className="w-12 h-12 bg-red-500/10 border border-red-500/15 rounded-xl flex items-center justify-center text-red-500">
                    <Clock className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Guide Box */}
              <div className="mt-8 p-5 bg-white/5 border border-white/5 rounded-2xl">
                <h4 className="font-semibold mb-2 text-sm text-gray-300">Moderator Guidelines</h4>
                <ul className="text-xs text-gray-400 list-disc list-inside space-y-2">
                  <li>Review all incoming reports promptly and check previous report histories.</li>
                  <li>Resolve minor warnings directly or issue warnings.</li>
                  <li>For extreme behavior (nudity, abuse), apply temporary suspensions (1 hour to 7 days).</li>
                  <li>Only administrators have the clearance to ban users permanently.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: REPORTS LIST */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Stranger Reports</h2>
                <button 
                  onClick={fetchReports}
                  className="text-xs text-gray-400 hover:text-white underline"
                >
                  Refresh
                </button>
              </div>

              {loadingReports ? (
                <div className="text-center py-12 text-gray-400">Loading reports...</div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No reports found.</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-gray-500 uppercase border-b border-white/5">
                        <tr>
                          <th className="py-3 px-4">ID</th>
                          <th className="py-3 px-4">Reported</th>
                          <th className="py-3 px-4">Reason</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {reports.map((rep) => (
                          <tr 
                            key={rep.id} 
                            onClick={() => handleFetchReportDetails(rep.id)}
                            className={`hover:bg-white/5 cursor-pointer transition-colors ${
                              selectedReport?.id === rep.id ? 'bg-white/5' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-mono text-gray-400">#{rep.id}</td>
                            <td className="py-3 px-4 font-semibold text-brand">{rep.reported_username}</td>
                            <td className="py-3 px-4 text-xs font-medium text-gray-300">{rep.reason}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                rep.status === 'OPEN' 
                                  ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/25'
                                  : 'bg-green-500/10 text-green-500 border border-green-500/25'
                              }`}>
                                {rep.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-brand underline">Details</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Sidebar Detail Card */}
                  <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 h-fit space-y-5">
                    {selectedReport ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-start border-b border-white/5 pb-3">
                          <h3 className="font-bold">Report Details #{selectedReport.id}</h3>
                          <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                            selectedReport.status === 'OPEN' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'
                          }`}>
                            {selectedReport.status}
                          </span>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <div>
                            <span className="text-gray-500 block">Reported User:</span>
                            <span className="font-bold text-brand">{selectedReport.reported_username}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Account Status:</span>
                            <span className="font-bold text-gray-300">{selectedReport.reported_status}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Previous Reports Count:</span>
                            <span className="font-bold text-gray-300">{selectedReport.reported_prev_reports_count} times</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Reporter:</span>
                            <span className="font-bold text-gray-300">{selectedReport.reporter_username}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Reason:</span>
                            <span className="font-bold text-yellow-500">{selectedReport.reason}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Description:</span>
                            <p className="bg-[#070a13] p-3 rounded-lg border border-white/5 text-gray-400 leading-relaxed mt-1">
                              {selectedReport.description || 'No description provided.'}
                            </p>
                          </div>
                        </div>

                        {selectedReport.status === 'OPEN' && (
                          <div className="flex flex-col gap-2 pt-4">
                            <button
                              onClick={() => handleResolveReport(selectedReport.id)}
                              className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs"
                            >
                              Resolve / Dismiss Report
                            </button>
                            <button
                              onClick={() => setShowModModal({ 
                                type: 'warn', 
                                targetUser: { id: selectedReport.reported_user, username: selectedReport.reported_username },
                                reportId: selectedReport.id 
                              })}
                              className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl text-xs"
                            >
                              Warn User
                            </button>
                            <button
                              onClick={() => setShowModModal({ 
                                type: 'suspend', 
                                targetUser: { id: selectedReport.reported_user, username: selectedReport.reported_username },
                                reportId: selectedReport.id 
                              })}
                              className="w-full py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-xs"
                            >
                              Suspend User
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 text-xs">
                        Select a report from the table to view details and execute actions.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: USER SEARCH */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">User Database Search</h2>

              <form onSubmit={handleUserSearch} className="flex gap-3 mb-6">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    required
                    placeholder="Search by Username or User ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#070a13] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand"
                  />
                  <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                </div>
                <button
                  type="submit"
                  disabled={loadingSearch}
                  className="bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl px-5 text-sm"
                >
                  {loadingSearch ? 'Searching...' : 'Search'}
                </button>
              </form>

              {searchResults.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-gray-500 uppercase border-b border-white/5">
                      <tr>
                        <th className="py-3 px-4">User ID</th>
                        <th className="py-3 px-4">Username</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Verified</th>
                        <th className="py-3 px-4">Credits</th>
                        <th className="py-3 px-4">Reports</th>
                        <th className="py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {searchResults.map((usr) => (
                        <tr key={usr.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-mono text-gray-400">#{usr.id}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold">{usr.username}</span>
                            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full ml-2 text-gray-400">
                              {usr.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              usr.account_status === 'ACTIVE'
                                ? 'bg-green-500/10 text-green-500'
                                : usr.account_status === 'SUSPENDED'
                                  ? 'bg-yellow-500/10 text-yellow-500'
                                  : 'bg-red-500/10 text-red-500'
                            }`}>
                              {usr.account_status}
                            </span>
                            {usr.account_status === 'SUSPENDED' && usr.suspended_until && (
                              <span className="text-[10px] text-gray-500 block mt-1">
                                Until {new Date(usr.suspended_until).toLocaleDateString()}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {usr.email_verified ? (
                              <ShieldCheck className="w-5 h-5 text-green-500" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-gray-500" />
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="flex items-center gap-1 text-brand font-semibold">
                              <Coins className="w-3.5 h-3.5" />
                              {usr.credits ?? 0}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold">{usr.total_reports} times</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setShowModModal({ type: 'warn', targetUser: usr })}
                                className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/25 hover:bg-yellow-500/20 text-yellow-500 text-xs rounded-lg"
                              >
                                Warn
                              </button>
                              {usr.role !== 'ADMIN' && (
                                <button
                                  onClick={() => setShowModModal({ type: 'suspend', targetUser: usr })}
                                  className="px-3 py-1 bg-brand/10 border border-brand/25 hover:bg-brand/20 text-brand text-xs rounded-lg"
                                >
                                  Suspend
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                searchQuery && !loadingSearch && (
                  <div className="text-center py-12 text-gray-500">No users matched your query.</div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODERATION ACTION MODAL */}
      {showModModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              {showModModal.type === 'warn' ? (
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              ) : (
                <Clock className="w-5 h-5 text-brand" />
              )}
              {showModModal.type === 'warn' ? 'Issue Account Warning' : 'Suspend Account'}
            </h3>
            
            <p className="text-xs text-gray-400 mb-6">
              Applying moderation to user <strong className="text-white">{showModModal.targetUser.username}</strong>.
            </p>

            <form onSubmit={handleModSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Reason for Action
                </label>
                <textarea
                  required
                  placeholder="Explain the warning or suspension reason..."
                  className="w-full bg-[#070a13] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand h-28 resize-none"
                  value={modReason}
                  onChange={(e) => setModReason(e.target.value)}
                />
              </div>

              {showModModal.type === 'suspend' && (
                <div>
                  <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Suspension Duration
                  </label>
                  <select
                    className="w-full bg-[#070a13] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
                    value={suspendDuration}
                    onChange={(e) => setSuspendDuration(e.target.value)}
                  >
                    <option value="1h">1 Hour</option>
                    <option value="24h">24 Hours</option>
                    <option value="7d">7 Days</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModModal(null);
                    setModReason('');
                  }}
                  className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-semibold rounded-xl py-2.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modLoading}
                  className="flex-1 bg-brand hover:bg-brand-hover disabled:bg-brand/50 text-white font-bold rounded-xl py-2.5 text-sm"
                >
                  {modLoading ? 'Executing...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
