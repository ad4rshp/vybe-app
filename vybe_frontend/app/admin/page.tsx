'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getAccessToken, getSavedUser } from '../utils/api';
import { 
  ShieldCheck, Users, ShieldAlert, AlertTriangle, 
  Search, Trash2, ShieldAlert as AdminIcon, ArrowLeft,
  UserX, CheckCircle, RefreshCw, Clock, UserCheck, Coins, Plus,
  Activity, Settings as SettingsIcon, ShieldAlert as AlertIcon, Ban, Heart, Zap
} from 'lucide-react';

export default function AdminPanel() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Tab State: 'dashboard' | 'users' | 'team' | 'monitoring' | 'toggles'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'team' | 'monitoring' | 'toggles'>('dashboard');

  // Stats state
  const [stats, setStats] = useState<any>({
    total_users: 0,
    verified_users: 0,
    active_users: 0,
    open_reports: 0,
    suspended_users: 0,
    banned_users: 0,
  });

  // User Management state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Team Management state
  const [teamList, setTeamList] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [promotionUsername, setPromotionUsername] = useState('');
  const [promoting, setPromoting] = useState(false);

  // Monitoring Log Mock State (Operational logs)
  const [sysLogs, setSysLogs] = useState<any[]>([
    { id: 1, type: 'INFO', msg: 'Matchmaking loop triggered', time: 'Just Now' },
    { id: 2, type: 'WARN', msg: 'DevTools inspection reported for User_402', time: '2m ago' },
    { id: 3, type: 'SUCCESS', msg: 'System backup generated successfully', time: '10m ago' },
    { id: 4, type: 'INFO', msg: 'Cleaned up 4 expired token verification hashes', time: '1h ago' }
  ]);

  // Global settings mock state
  const [globalBanner, setGlobalBanner] = useState('Standard weekend server updates are active.');
  const [emergencyLock, setEmergencyLock] = useState(false);
  const [genderMatchingFee, setGenderMatchingFee] = useState(5);

  // Modals state
  const [showModModal, setShowModModal] = useState<any | null>(null); // { type: 'suspend'|'ban'|'unsuspend'|'unban'|'grant_credits', targetUser: any }
  const [modReason, setModReason] = useState('');
  const [suspendDuration, setSuspendDuration] = useState('24h');
  const [grantAmount, setGrantAmount] = useState('100');
  const [modLoading, setModLoading] = useState(false);

  // Silent monitoring state
  const [monitoringMatch, setMonitoringMatch] = useState<any | null>(null);
  const socketRef = useRef<any>(null);
  const monitorPcsRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  const targetVideoRef = useRef<HTMLVideoElement | null>(null);
  const partnerVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    const user = getSavedUser();
    if (!token || !user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'ADMIN') {
      router.push('/chat');
      return;
    }
    setCurrentUser(user);
    fetchStats();
    fetchTeamList();

    // AJAX background process: poll telemetry/stats every 8 seconds
    const statsInterval = setInterval(fetchStats, 8000);

    return () => {
      clearInterval(statsInterval);
      // Disconnect socket and close connections on unmount
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      Object.values(monitorPcsRef.current).forEach(pc => {
        try {
          pc.close();
        } catch (e) {}
      });
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

  const fetchTeamList = async () => {
    setLoadingTeam(true);
    try {
      const data = await apiFetch('/admin/team/');
      setTeamList(data);
    } catch (err) {
      console.error("Error fetching team list:", err);
    } finally {
      setLoadingTeam(false);
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

  const handleCardClick = async (filterType: 'status' | 'verified' | 'all' | 'reports', value: string) => {
    setActiveTab('users');
    setLoadingSearch(true);
    setSearchQuery('');
    try {
      let endpoint = '/users/search/';
      if (filterType === 'status') {
        endpoint += `?status=${value}`;
      } else if (filterType === 'verified') {
        endpoint += `?verified=${value}`;
      }
      const data = await apiFetch(endpoint);
      if (filterType === 'reports') {
        data.sort((a: any, b: any) => b.total_reports - a.total_reports);
      }
      setSearchResults(data);
    } catch (err: any) {
      console.error("Filter failed:", err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const startMonitoring = (match: any) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    Object.values(monitorPcsRef.current).forEach(pc => {
      try {
        pc.close();
      } catch (e) {}
    });
    monitorPcsRef.current = {};

    setMonitoringMatch(match);

    const token = getAccessToken();
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';
    
    import('socket.io-client').then(({ io }) => {
      const socket = io(SOCKET_URL, {
        auth: { token: token || '' },
        transports: ['websocket'],
        withCredentials: true
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log("Admin monitoring socket connected");
        socket.emit('monitor:join', { target_id: match.user1_id });
      });

      socket.on('webrtc:monitor-offer', async (data: { offer: any, sender_sid: string, stream_label: string }) => {
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });
        monitorPcsRef.current[data.sender_sid] = pc;

        pc.ontrack = (event) => {
          console.log("Monitor track received:", data.stream_label, event.streams[0]);
          if (data.stream_label === 'target') {
            if (targetVideoRef.current) {
              targetVideoRef.current.srcObject = event.streams[0];
            }
          } else {
            if (partnerVideoRef.current) {
              partnerVideoRef.current.srcObject = event.streams[0];
            }
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('webrtc:monitor-candidate', {
              candidate: event.candidate,
              monitor_sid: socket.id
            });
          }
        };

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc:monitor-answer', {
            target_sid: data.sender_sid,
            answer
          });
        } catch (err) {
          console.error("Monitor sdp error:", err);
        }
      });

      socket.on('webrtc:monitor-candidate', async (data: { candidate: any, sender_sid: string }) => {
        const pc = monitorPcsRef.current[data.sender_sid];
        if (pc && data.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            console.error("Error adding monitor candidate:", err);
          }
        }
      });
    });
  };

  const stopMonitoring = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    Object.values(monitorPcsRef.current).forEach(pc => {
      try {
        pc.close();
      } catch (e) {}
    });
    monitorPcsRef.current = {};
    setMonitoringMatch(null);
  };

  const handleModSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showModModal) return;

    setModLoading(true);
    const { type, targetUser } = showModModal;
    const reason = modReason || `${type.toUpperCase()} performed by admin.`;

    try {
      if (type === 'suspend') {
        await apiFetch('/moderation/suspend/', {
          method: 'POST',
          body: { user_id: targetUser.id, reason, duration: suspendDuration }
        });
        alert(`${targetUser.username} has been suspended.`);
      } else if (type === 'unsuspend') {
        await apiFetch('/moderation/unsuspend/', {
          method: 'POST',
          body: { user_id: targetUser.id, reason }
        });
        alert(`Suspension lifted for ${targetUser.username}.`);
      } else if (type === 'ban') {
        await apiFetch('/moderation/ban/', {
          method: 'POST',
          body: { user_id: targetUser.id, reason }
        });
        alert(`${targetUser.username} has been permanently banned.`);
      } else if (type === 'unban') {
        await apiFetch('/moderation/unban/', {
          method: 'POST',
          body: { user_id: targetUser.id, reason }
        });
        alert(`Ban lifted for ${targetUser.username}.`);
      } else if (type === 'grant_credits') {
        const res = await apiFetch('/admin/credits/', {
          method: 'POST',
          body: { user_id: targetUser.id, amount: parseInt(grantAmount) }
        });
        alert(res.detail || `Granted {grantAmount} tokens.`);
      }

      setShowModModal(null);
      setModReason('');
      setGrantAmount('100');
      fetchStats();
      
      if (searchQuery) {
        const freshData = await apiFetch(`/users/search/?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(freshData);
      }
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setModLoading(false);
    }
  };

  const handlePromoteByUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotionUsername) return;

    setPromoting(true);
    try {
      const matchedUsers = await apiFetch(`/users/search/?q=${encodeURIComponent(promotionUsername)}`);
      const target = matchedUsers.find((u: any) => u.username.toLowerCase() === promotionUsername.toLowerCase());

      if (!target) {
        alert(`User '${promotionUsername}' not found.`);
        return;
      }

      await apiFetch('/admin/team/', {
        method: 'POST',
        body: {
          user_id: target.id,
          action: 'promote'
        }
      });

      alert(`${target.username} promoted to Team Member.`);
      setPromotionUsername('');
      fetchTeamList();
    } catch (err: any) {
      alert(`Promotion failed: ${err.message}`);
    } finally {
      setPromoting(false);
    }
  };

  const handleRemoveTeamRole = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to remove Team role from ${username}?`)) return;

    try {
      await apiFetch('/admin/team/', {
        method: 'POST',
        body: {
          user_id: userId,
          action: 'demote'
        }
      });
      alert(`Team role removed from ${username}.`);
      fetchTeamList();
    } catch (err: any) {
      alert(`Failed to demote member: ${err.message}`);
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
            <AdminIcon className="w-5 h-5 text-brand" />
            Administrator Panel
          </span>
        </div>
        <div className="text-xs text-gray-400">
          Logged in as <strong className="text-brand">{currentUser?.username}</strong> (Superuser)
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-grow flex flex-col md:flex-row max-w-7xl w-full mx-auto p-6 gap-6 overflow-hidden">
        {/* Sidebar Nav */}
        <nav className="flex md:flex-col gap-2 shrink-0 md:w-52 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-brand/10 text-brand border border-brand/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            Dashboard Overview
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
            User Management
          </button>
          <button
            onClick={() => {
              setActiveTab('team');
              fetchTeamList();
            }}
            className={`px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'team'
                ? 'bg-brand/10 text-brand border border-brand/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            Team Management
          </button>
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all whitespace-nowrap flex items-center justify-between ${
              activeTab === 'monitoring'
                ? 'bg-brand/10 text-brand border border-brand/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <span>Live Monitoring</span>
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          </button>
          <button
            onClick={() => setActiveTab('toggles')}
            className={`px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'toggles'
                ? 'bg-brand/10 text-brand border border-brand/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            System Parameters
          </button>
        </nav>

        {/* Content Block */}
        <div className="flex-grow bg-zinc-900/40 border border-white/5 rounded-2xl p-6 overflow-y-auto">
          
          {/* TAB 1: DASHBOARD STATS */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Platform Statistics</h2>
                <button 
                  onClick={fetchStats}
                  className="p-1 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div 
                  onClick={() => handleCardClick('all', '')}
                  className="bg-zinc-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-brand/40 hover:-translate-y-1 transition-all duration-300"
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Users</span>
                    <h3 className="text-3xl font-extrabold mt-1.5">{stats.total_users}</h3>
                  </div>
                  <div className="w-11 h-11 bg-indigo-500/10 border border-indigo-500/15 rounded-xl flex items-center justify-center text-indigo-400">
                    <Users className="w-5.5 h-5.5" />
                  </div>
                </div>

                <div 
                  onClick={() => handleCardClick('verified', 'true')}
                  className="bg-zinc-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-brand/40 hover:-translate-y-1 transition-all duration-300"
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Verified Email</span>
                    <h3 className="text-3xl font-extrabold mt-1.5">{stats.verified_users}</h3>
                  </div>
                  <div className="w-11 h-11 bg-green-500/10 border border-green-500/15 rounded-xl flex items-center justify-center text-green-400">
                    <ShieldCheck className="w-5.5 h-5.5" />
                  </div>
                </div>

                <div 
                  onClick={() => handleCardClick('status', 'ACTIVE')}
                  className="bg-zinc-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-brand/40 hover:-translate-y-1 transition-all duration-300"
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Status</span>
                    <h3 className="text-3xl font-extrabold mt-1.5">{stats.active_users}</h3>
                  </div>
                  <div className="w-11 h-11 bg-teal-500/10 border border-teal-500/15 rounded-xl flex items-center justify-center text-teal-400">
                    <UserCheck className="w-5.5 h-5.5" />
                  </div>
                </div>

                <div 
                  onClick={() => handleCardClick('reports', '')}
                  className="bg-zinc-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-brand/40 hover:-translate-y-1 transition-all duration-300"
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Open Reports</span>
                    <h3 className="text-3xl font-extrabold mt-1.5">{stats.open_reports}</h3>
                  </div>
                  <div className="w-11 h-11 bg-yellow-500/10 border border-yellow-500/15 rounded-xl flex items-center justify-center text-yellow-400">
                    <AlertTriangle className="w-5.5 h-5.5" />
                  </div>
                </div>

                <div 
                  onClick={() => handleCardClick('status', 'SUSPENDED')}
                  className="bg-zinc-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-brand/40 hover:-translate-y-1 transition-all duration-300"
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Suspended Users</span>
                    <h3 className="text-3xl font-extrabold mt-1.5">{stats.suspended_users}</h3>
                  </div>
                  <div className="w-11 h-11 bg-orange-500/10 border border-orange-500/15 rounded-xl flex items-center justify-center text-orange-400">
                    <Clock className="w-5.5 h-5.5" />
                  </div>
                </div>

                <div 
                  onClick={() => handleCardClick('status', 'BANNED')}
                  className="bg-zinc-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-brand/40 hover:-translate-y-1 transition-all duration-300"
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Permanently Banned</span>
                    <h3 className="text-3xl font-extrabold mt-1.5">{stats.banned_users}</h3>
                  </div>
                  <div className="w-11 h-11 bg-brand/10 border border-brand/15 rounded-xl flex items-center justify-center text-brand">
                    <UserX className="w-5.5 h-5.5" />
                  </div>
                </div>
              </div>

              {/* Admin Guide */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5 mt-6">
                <h4 className="font-semibold mb-2 text-sm text-gray-300">Admin Control System</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  As an administrator, you hold absolute authority on the platform. You are responsible for promoting trustworthy users to the Moderator (Team) role, auditing statistics, granting tokens, and performing permanent account bans to clean up bad actors.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">User Search & Action Console</h2>

              <form onSubmit={handleUserSearch} className="flex gap-3 mb-6">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    required
                    placeholder="Search by Username, Email, or User ID..."
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
                        <th className="py-3 px-4">ID</th>
                        <th className="py-3 px-4">User Details</th>
                        <th className="py-3 px-4">Account Status</th>
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
                            <div className="font-semibold text-white">{usr.username}</div>
                            <div className="text-xs text-gray-500">{usr.email}</div>
                            <span className="text-[10px] bg-white/5 px-2 py-0.2 rounded mt-1 inline-block font-mono">
                              Role: {usr.role}
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
                              <AlertTriangle className="w-5 h-5 text-gray-500" />
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-brand">
                            <div className="flex items-center gap-1">
                              <Coins className="w-3.5 h-3.5" />
                              {usr.credits ?? 0}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-300">
                            {usr.total_reports} times
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => setShowModModal({ type: 'grant_credits', targetUser: usr })}
                                className="px-2.5 py-1 bg-brand/10 border border-brand/20 hover:bg-brand/20 text-brand text-xs rounded-lg font-bold flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Grant
                              </button>

                              {usr.account_status === 'SUSPENDED' ? (
                                <button
                                  onClick={() => setShowModModal({ type: 'unsuspend', targetUser: usr })}
                                  className="px-2.5 py-1 bg-green-500/10 border border-green-500/25 hover:bg-green-500/20 text-green-500 text-xs rounded-lg font-medium"
                                >
                                  Unsuspend
                                </button>
                              ) : (
                                usr.role !== 'ADMIN' && (
                                  <button
                                    onClick={() => setShowModModal({ type: 'suspend', targetUser: usr })}
                                    className="px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/25 hover:bg-yellow-500/20 text-yellow-500 text-xs rounded-lg font-medium"
                                  >
                                    Suspend
                                  </button>
                                )
                              )}

                              {usr.account_status === 'BANNED' ? (
                                <button
                                  onClick={() => setShowModModal({ type: 'unban', targetUser: usr })}
                                  className="px-2.5 py-1 bg-green-500/10 border border-green-500/25 hover:bg-green-500/20 text-green-500 text-xs rounded-lg font-medium"
                                >
                                  Unban
                                </button>
                              ) : (
                                usr.role !== 'ADMIN' && (
                                  <button
                                    onClick={() => setShowModModal({ type: 'ban', targetUser: usr })}
                                    className="px-2.5 py-1 bg-brand/10 border border-brand/25 hover:bg-brand/20 text-brand text-xs rounded-lg font-medium"
                                  >
                                    Ban User
                                  </button>
                                )
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
                  <div className="text-center py-12 text-gray-500 text-sm">No users matched.</div>
                )
              )}
            </div>
          )}

          {/* TAB 3: TEAM ROLE MANAGEMENT */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">Team & Moderator Roster</h2>

              <form onSubmit={handlePromoteByUsername} className="bg-zinc-900 border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row gap-3 items-end mb-6">
                <div className="flex-grow space-y-1.5 w-full">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                    Add Team Member (Promote by exact Username)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter username to promote"
                    value={promotionUsername}
                    onChange={(e) => setPromotionUsername(e.target.value)}
                    className="w-full bg-[#070a13] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand"
                  />
                </div>
                <button
                  type="submit"
                  disabled={promoting}
                  className="w-full sm:w-auto bg-brand hover:bg-brand-hover disabled:bg-brand/50 text-white font-bold rounded-xl py-3 px-6 text-sm shrink-0"
                >
                  {promoting ? 'Promoting...' : 'Make Team Member'}
                </button>
              </form>

              {loadingTeam ? (
                <div className="text-center py-12 text-gray-400">Loading roster...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-gray-500 uppercase border-b border-white/5">
                      <tr>
                        <th className="py-3 px-4">Username</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Date Joined</th>
                        <th className="py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {teamList.map((member) => (
                        <tr key={member.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-semibold text-white">{member.username}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              member.role === 'ADMIN' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-brand/10 text-brand'
                            }`}>
                              {member.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-500">
                            {new Date(member.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            {member.role !== 'ADMIN' ? (
                              <button
                                onClick={() => handleRemoveTeamRole(member.id, member.username)}
                                className="text-xs text-brand hover:text-brand-hover font-semibold underline flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove Team Role
                              </button>
                            ) : (
                              <span className="text-xs text-gray-600 italic">No actions</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LIVE MONITORING & ANALYTICS */}
          {activeTab === 'monitoring' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  Live Platform Monitoring & Telemetry Analytics
                </h2>
                <button 
                  onClick={fetchStats}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Metrics
                </button>
              </div>

              {/* Secret Live Session Monitor Feed */}
              {monitoringMatch && (
                <div className="bg-zinc-950 border-2 border-brand/20 rounded-2xl p-6 relative overflow-hidden shadow-2xl animate-scale-in">
                  <div className="absolute top-0 left-0 bg-brand text-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-br-xl">
                    Live Session Monitor
                  </div>
                  <div className="flex justify-between items-center mb-6 mt-2">
                    <div className="text-sm font-semibold text-white">
                      Monitoring session: <span className="text-brand font-bold">{monitoringMatch.user1_username}</span> &lt;=&gt; <span className="text-brand font-bold">{monitoringMatch.user2_username}</span>
                    </div>
                    <button 
                      onClick={stopMonitoring}
                      className="px-4 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-all"
                    >
                      Close Feed
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-black border border-white/5 rounded-xl overflow-hidden relative aspect-video flex flex-col justify-end">
                      <video ref={targetVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/75 rounded text-[10px] text-gray-300 font-mono">
                        Feed A: {monitoringMatch.user1_username}
                      </div>
                    </div>
                    <div className="bg-black border border-white/5 rounded-xl overflow-hidden relative aspect-video flex flex-col justify-end">
                      <video ref={partnerVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/75 rounded text-[10px] text-gray-300 font-mono">
                        Feed B: {monitoringMatch.user2_username}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Server Stats Dashboard */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-zinc-900 border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Active Socket Connections</div>
                  <div className="text-2xl font-bold mt-1 text-indigo-400">{stats.online_users ?? 0} active</div>
                  <div className="text-[10px] text-gray-400 mt-1">Live WebSocket sessions</div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900 border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Matchmaking Queue</div>
                  <div className="text-2xl font-bold mt-1 text-brand">{stats.queue_size ?? 0} searching</div>
                  <div className="text-[10px] text-gray-400 mt-1">Active match seekers</div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900 border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Active Matches</div>
                  <div className="text-2xl font-bold mt-1 text-emerald-400">{stats.active_matches ?? 0} calls</div>
                  <div className="text-[10px] text-gray-400 mt-1">Ongoing live video matches</div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900 border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Average Wait Time</div>
                  <div className="text-2xl font-bold mt-1 text-yellow-400">{(stats.average_wait_time_sec ?? 12.4).toFixed(1)}s</div>
                  <div className="text-[10px] text-gray-400 mt-1">Matchmaker latency query</div>
                </div>
              </div>

              {/* Active Call Sessions List */}
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Active Call Sessions</h3>
                {stats.active_matches_list && stats.active_matches_list.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-gray-500 uppercase border-b border-white/5">
                        <tr>
                          <th className="py-2.5 px-4">Match Reference</th>
                          <th className="py-2.5 px-4">User A</th>
                          <th className="py-2.5 px-4">User B</th>
                          <th className="py-2.5 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {stats.active_matches_list.map((m: any) => (
                          <tr key={m.match_id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 font-mono text-xs text-gray-400">{m.match_id}</td>
                            <td className="py-3 px-4 font-semibold text-white">
                              {m.user1_username} <span className="text-[10px] text-gray-500 font-mono">(#{m.user1_id})</span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-white">
                              {m.user2_username} <span className="text-[10px] text-gray-500 font-mono">(#{m.user2_id})</span>
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => startMonitoring(m)}
                                className="px-3 py-1.5 bg-brand/10 hover:bg-brand/20 border border-brand/20 text-brand text-xs font-bold rounded-lg transition-all"
                              >
                                Monitor Feed
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 text-sm">No live call sessions active.</div>
                )}
              </div>

              {/* Infrastructure Health Status */}
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Infrastructure Health</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3.5 bg-black/35 rounded-xl border border-white/5">
                    <span className="relative flex h-3 w-3">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${stats.db_health === 'HEALTHY' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${stats.db_health === 'HEALTHY' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-gray-400">PostgreSQL Database</div>
                      <div className="text-sm font-bold text-white mt-0.5">{stats.db_health ?? 'HEALTHY'}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 bg-black/35 rounded-xl border border-white/5">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-gray-400">Redis Cache Storage</div>
                      <div className="text-sm font-bold text-white mt-0.5">{stats.redis_health ?? 'CONNECTED'}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 bg-black/35 rounded-xl border border-white/5">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-gray-400">Coturn TURN/STUN Server</div>
                      <div className="text-sm font-bold text-white mt-0.5">{stats.turn_health ?? 'ONLINE'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Telemetry Analytics */}
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Matchmaking & Telemetry Analytics (Past 24 Hours)</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 bg-black/35 rounded-xl border border-white/5">
                    <div className="text-xs text-gray-400">Daily Active Users</div>
                    <div className="text-xl font-bold text-white mt-1">{stats.daily_users ?? 0}</div>
                  </div>
                  <div className="p-3 bg-black/35 rounded-xl border border-white/5">
                    <div className="text-xs text-gray-400">Match Skip Rate</div>
                    <div className="text-xl font-bold text-white mt-1">{stats.skips_today ?? 0} skips</div>
                  </div>
                  <div className="p-3 bg-black/35 rounded-xl border border-white/5">
                    <div className="text-xs text-gray-400">Reports Filed</div>
                    <div className="text-xl font-bold text-white mt-1">{stats.reports_per_day ?? 0} cases</div>
                  </div>
                  <div className="p-3 bg-black/35 rounded-xl border border-white/5">
                    <div className="text-xs text-gray-400">WebRTC Call Success Rate</div>
                    <div className="text-xl font-bold text-green-400 mt-1">
                      {stats.webrtc_success + stats.webrtc_fail > 0 
                        ? ((stats.webrtc_success / (stats.webrtc_success + stats.webrtc_fail)) * 100).toFixed(1) + '%'
                        : '100.0%'}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 mt-3 text-right">
                  WebRTC success matches: {stats.webrtc_success ?? 0} | failed connections: {stats.webrtc_fail ?? 0}
                </div>
              </div>

              {/* Audit logs */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">System Logs</h3>
                <div className="bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-xs space-y-2.5 max-h-60 overflow-y-auto">
                  <div className="flex justify-between items-start gap-4 text-emerald-400">
                    <span className="text-gray-500">[System Audit]</span>
                    <span className="flex-grow">
                      Live Telemetry listener is operational and logging connection performance logs.
                    </span>
                  </div>
                  {sysLogs.map(log => (
                    <div key={log.id} className="flex justify-between items-start gap-4">
                      <span className="text-gray-500">[{log.time}]</span>
                      <span className="flex-grow text-gray-300">
                        <span className={`font-bold mr-2 ${
                          log.type === 'WARN' ? 'text-yellow-500' : log.type === 'SUCCESS' ? 'text-green-500' : 'text-indigo-400'
                        }`}>
                          {log.type}
                        </span>
                        {log.msg}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEM PARAMETERS */}
          {activeTab === 'toggles' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-brand" />
                Global Platform Settings
              </h2>

              <div className="space-y-6 max-w-xl">
                {/* Setting 1: Banner message */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Lobby Alert Banner Message
                  </label>
                  <input
                    type="text"
                    className="w-full bg-[#070a13] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand"
                    value={globalBanner}
                    onChange={(e) => setGlobalBanner(e.target.value)}
                  />
                  <p className="text-[10px] text-gray-500">Displays a notification text on all users lobby screens.</p>
                </div>

                {/* Setting 2: Gender Match Token Fee */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Gender Filter Cost (tokens)
                  </label>
                  <select
                    className="w-full bg-[#070a13] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand"
                    value={genderMatchingFee}
                    onChange={(e) => setGenderMatchingFee(parseInt(e.target.value))}
                  >
                    <option value="0">Free (0 tokens)</option>
                    <option value="1">1 Token</option>
                    <option value="5">5 Tokens (Standard)</option>
                    <option value="10">10 Tokens (Premium)</option>
                  </select>
                </div>

                {/* Setting 3: Emergency stop */}
                <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/5 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-red-400 flex items-center gap-2 text-sm">
                      <AlertIcon className="w-4 h-4" />
                      Platform Emergency Pause
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                      Locks matchmaking queues instantly across all servers. Users won&apos;t connect until enabled again.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEmergencyLock(!emergencyLock);
                      alert(emergencyLock ? 'Matchmaking Resumed.' : 'Matchmaking has been paused.');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      emergencyLock ? 'bg-emerald-500 text-white' : 'bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30'
                    }`}
                  >
                    {emergencyLock ? 'Resume Queue' : 'Lock Matchmaker'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODERATION ACTION DECISION MODAL */}
      {showModModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-brand capitalize">
              <ShieldAlert className="w-5 h-5" />
              {showModModal.type.replace('_', ' ')}
            </h3>
            
            <p className="text-xs text-gray-400 mb-6">
              Confirming admin action on user <strong className="text-white">{showModModal.targetUser.username}</strong>.
            </p>

            <form onSubmit={handleModSubmit} className="space-y-4">
              {showModModal.type === 'grant_credits' ? (
                <div>
                  <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Token Grant Amount
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    required
                    className="w-full bg-[#070a13] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand"
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(e.target.value)}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                      Reason for Action
                    </label>
                    <textarea
                      required
                      placeholder="State the reason for this moderation action..."
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
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModModal(null);
                    setModReason('');
                    setGrantAmount('100');
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
                  {modLoading ? 'Executing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
