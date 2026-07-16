'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { apiFetch, getAccessToken, clearTokens, apiLogout, getSavedUser, saveUser } from '../utils/api';
import { generateDynamicFavicon, getThemeColorHex } from '../utils/favicon';
import { 
  Video, Mic, MicOff, VideoOff, SkipForward, AlertTriangle, 
  Settings, LogOut, ShieldAlert, Sparkles, User, Lock, Check, Loader2,
  MessageSquare, Ban, Send, ShieldX, EyeOff, Menu, MessageSquareQuote,
  ShieldCheck, UserCheck, Inbox, Heart, Coins, ChevronLeft, UserPlus, Camera
} from 'lucide-react';
import { VybeLogo, VybeLogoMark, VybeMatch, VybeShield, VybeChat, VybeCoins, VybeSearch, VybeVideo } from '../components/VybeIcons';


const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';

interface Message {
  sender: string;
  text: string;
}

// Client-side Canvas Logo Component
function CanvasLogo({ theme }: { theme: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colorHex = getThemeColorHex(theme);
    ctx.clearRect(0, 0, 32, 32);

    // Draw background rounded rect
    const grad = ctx.createLinearGradient(0, 0, 32, 32);
    grad.addColorStop(0, colorHex);
    grad.addColorStop(1, '#090d16');

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(4, 4, 24, 24, 8);
    } else {
      ctx.rect(4, 4, 24, 24);
    }
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw V Symbol
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 4;

    ctx.beginPath();
    ctx.moveTo(11, 12);
    ctx.lineTo(16, 21);
    ctx.lineTo(21, 12);
    ctx.stroke();
  }, [theme]);

  return <canvas ref={canvasRef} width={32} height={32} className="w-8 h-8 cursor-pointer" />;
}

export default function ChatPage() {
  const router = useRouter();
  
  // User info
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profilePicUploading, setProfilePicUploading] = useState(false);
  const [profilePicError, setProfilePicError] = useState('');
  const profilePicInputRef = useRef<HTMLInputElement | null>(null);

  // Credit animation
  const [creditAnimation, setCreditAnimation] = useState<{amount: number, show: boolean}>({amount: 0, show: false});
  const prevCreditsRef = useRef<number | null>(null);
  
  // Socket & WebRTC references
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  
  // Video element references
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const lobbyVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // States
  const [status, setStatus] = useState<'IDLE' | 'SEARCHING' | 'CONNECTED'>('IDLE');
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerUsername, setPeerUsername] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // V1.5 Text Chat States
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatMessageInput, setChatMessageInput] = useState('');
  const [chatOpen, setChatOpen] = useState(true);

  // Left Collapsible Side Drawer & Tabs
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState<'PROFILE' | 'INBOX'>('PROFILE');

  // Security & Face Detection States
  const [faceDetectorLoaded, setFaceDetectorLoaded] = useState(false);
  const [noFaceCounter, setNoFaceCounter] = useState(0);
  const [showFaceWarning, setShowFaceWarning] = useState(false);
  const [actionCooldown, setActionCooldown] = useState(false);

  // Gender Filter, Match Mode & Theme States
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [matchMode, setMatchMode] = useState('VIDEO');
  const [userGender, setUserGender] = useState('UNSPECIFIED');
  const [activeTheme, setActiveTheme] = useState('rose');
  
  // Modals
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('INAPPROPRIATE');
  const [reportDescription, setReportDescription] = useState('');
  const [reporting, setReporting] = useState(false);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  // Friends and Direct Messages System States
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingReceived, setPendingReceived] = useState<any[]>([]);
  const [pendingSent, setPendingSent] = useState<any[]>([]);
  const [activeConversationFriend, setActiveConversationFriend] = useState<any | null>(null);
  const [directMessages, setDirectMessages] = useState<any[]>([]);
  const [dmInputText, setDmInputText] = useState('');
  const [addFriendUsernameInput, setAddFriendUsernameInput] = useState('');
  const [addFriendError, setAddFriendError] = useState('');
  const [addFriendSuccess, setAddFriendSuccess] = useState('');
  const [dmsLoading, setDmsLoading] = useState(false);

  const fetchFriendsAndRequests = async () => {
    try {
      const data = await apiFetch('/friends/');
      setFriends(data.friends || []);
      setPendingReceived(data.pending_received || []);
      setPendingSent(data.pending_sent || []);
    } catch (err) {
      console.error("Error fetching friends:", err);
    }
  };

  const fetchDirectMessages = async (friendId: number) => {
    try {
      const data = await apiFetch(`/dms/?friend_id=${friendId}`);
      setDirectMessages(data || []);
    } catch (err) {
      console.error("Error fetching DMs:", err);
    }
  };

  const sendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFriendError('');
    setAddFriendSuccess('');
    if (!addFriendUsernameInput.trim()) return;

    try {
      const res = await apiFetch('/friends/request/', {
        method: 'POST',
        body: { username: addFriendUsernameInput.trim() }
      });
      setAddFriendSuccess(`Request sent to ${res.recipient}!`);
      setAddFriendUsernameInput('');
      fetchFriendsAndRequests();
    } catch (err: any) {
      setAddFriendError(err.message || 'Failed to send request.');
    }
  };

  const respondFriendRequest = async (requestId: number, action: 'ACCEPT' | 'REJECT') => {
    try {
      await apiFetch('/friends/respond/', {
        method: 'POST',
        body: { request_id: requestId, action }
      });
      fetchFriendsAndRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to respond to request.');
    }
  };

  const sendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmInputText.trim() || !activeConversationFriend) return;

    const messageText = dmInputText;
    setDmInputText('');

    try {
      const newDm = await apiFetch('/dms/send/', {
        method: 'POST',
        body: { recipient_id: activeConversationFriend.id, text: messageText }
      });
      setDirectMessages(prev => [...prev, newDm]);
      
      if (activeConversationFriend.username === 'vybe_bot') {
        setTimeout(() => {
          fetchDirectMessages(activeConversationFriend.id);
        }, 1000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to send message.');
    }
  };

  // Poll DMs while conversation is active
  useEffect(() => {
    if (!activeConversationFriend) return;
    fetchDirectMessages(activeConversationFriend.id);
    const interval = setInterval(() => {
      fetchDirectMessages(activeConversationFriend.id);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeConversationFriend]);

  // Fetch when tab changes to INBOX
  useEffect(() => {
    if (activeLeftTab === 'INBOX') {
      fetchFriendsAndRequests();
    }
  }, [activeLeftTab]);

  // Validate Authentication & Fetch Profile on Mount
  useEffect(() => {
    const token = getAccessToken();
    const user = getSavedUser();
    if (!token || !user) {
      router.push('/login');
      return;
    }
    
    setCurrentUser(user);
    setNewUsername(user.username);
    setGenderFilter(user.gender_filter || 'ALL');
    setMatchMode(user.match_mode || 'VIDEO');
    setUserGender(user.gender || 'UNSPECIFIED');

    const savedTheme = localStorage.getItem('vybe-theme') || 'rose';
    setActiveTheme(savedTheme);
    
    // Lightweight DevTools tamper detection (zero CPU cost — no debugger statement)
    const origLog = console.log;
    Object.defineProperty(console, '_vdevCheck', {
      get() { origLog.call(console, '[VYBE] console inspection detected'); return true; },
      configurable: true,
    });

    // Cleanup on unmount
    return () => {
      cleanupCall();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Sync state values when profile is fetched
  useEffect(() => {
    if (currentUser) {
      setGenderFilter(currentUser.gender_filter || 'ALL');
      setMatchMode(currentUser.match_mode || 'VIDEO');
      setUserGender(currentUser.gender || 'UNSPECIFIED');

      // Credit change animation: detect increase
      const newCredits = currentUser.credits ?? 0;
      if (prevCreditsRef.current !== null && newCredits > prevCreditsRef.current) {
        const diff = newCredits - prevCreditsRef.current;
        setCreditAnimation({ amount: diff, show: true });
        setTimeout(() => setCreditAnimation({ amount: 0, show: false }), 2200);
      }
      prevCreditsRef.current = newCredits;
    }
  }, [currentUser]);

  // Periodically poll balance to catch admin grants / topups
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await apiFetch('/users/me/');
        if (data && data.credits !== currentUser?.credits) {
          setCurrentUser(data);
          saveUser(data);
        }
      } catch {}
    }, 15000); // every 15 seconds
    return () => clearInterval(interval);
  }, [currentUser?.credits]);

  // Lazily load face-api only when the user is actually CONNECTED (saves ~1MB on page load)
  useEffect(() => {
    if (status !== 'CONNECTED') return;
    if (faceDetectorLoaded) return;

    const loadFaceApi = async () => {
      try {
        if (!(window as any).faceapi) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js';
          script.async = true;
          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('CDN load failed'));
            document.body.appendChild(script);
          });
        }
        const faceapi = (window as any).faceapi;
        if (faceapi) {
          await faceapi.nets.tinyFaceDetector.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models/');
          setFaceDetectorLoaded(true);
        }
      } catch (err) {
        console.error('Face detection deferred load error:', err);
      }
    };

    loadFaceApi();
  }, [status, faceDetectorLoaded]);

  // Periodic Face Check Hook — only runs when CONNECTED and models loaded
  useEffect(() => {
    if (status !== 'CONNECTED' || !faceDetectorLoaded || !cameraEnabled || matchMode === 'TEXT') {
      setShowFaceWarning(false);
      return;
    }

    const checkFace = async () => {
      const faceapi = (window as any).faceapi;
      if (!faceapi || !localVideoRef.current) return;

      try {
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (!videoTrack || !videoTrack.enabled) {
          setShowFaceWarning(false);
          return;
        }

        const detection = await faceapi.detectSingleFace(
          localVideoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 128 })
        );

        if (!detection) {
          setNoFaceCounter(prev => {
            const nextVal = prev + 1;
            if (nextVal >= 3) setShowFaceWarning(true);
            if (nextVal >= 5) {
              setShowFaceWarning(false);
              alert('Skipped match: You must show your face on camera.');
              handleNextUser();
              return 0;
            }
            return nextVal;
          });
        } else {
          setNoFaceCounter(0);
          setShowFaceWarning(false);
        }
      } catch (err) {
        console.error('Face detection loop error:', err);
      }
    };

    const interval = setInterval(checkFace, 3000); // 3s checks to reduce CPU
    return () => {
      clearInterval(interval);
      setShowFaceWarning(false);
    };
  }, [faceDetectorLoaded, cameraEnabled, status]);

  // Initialize Local Web Camera
  const initLocalMedia = async () => {
    if (matchMode === 'TEXT') return; // Skip media initialization for text-only mode
    try {
      if (localStreamRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      if (lobbyVideoRef.current) {
        lobbyVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing user media:", err);
      alert("Please allow camera and microphone permissions to use VYBE.");
    }
  };

  // Initialize and Connect WebSocket Client
  const connectSocket = () => {
    if (socketRef.current?.connected) return;
    
    const token = getAccessToken();
    socketRef.current = io(SOCKET_URL, {
      query: { token: token || '' },
      auth: { token: token || '' },
      transports: ['websocket'],
      withCredentials: true
    });

    socketRef.current.on('connect', () => {
      console.log("WebSocket connected successfully with ID:", socketRef.current?.id);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error("Connection error:", err.message);
      alert(`Socket Connection Refused: ${err.message}`);
      handleLogout();
    });

    socketRef.current.on('queue:status', (data: { status: 'SEARCHING' | 'IDLE' }) => {
      setStatus(data.status);
    });

    socketRef.current.on('auth:expired', (data: { message: string }) => {
      alert(data.message);
      handleLogout();
    });

    socketRef.current.on('chat:disconnect', () => {
      console.log("Partner disconnected");
      cleanupCall();
      handleStartQueue();
    });

    socketRef.current.on('chat:next', () => {
      console.log("Partner skipped you");
      cleanupCall();
      setStatus('SEARCHING');
    });

    // Real-time Text Messages Listener
    socketRef.current.on('chat:message', (data: { sender: string; text: string }) => {
      console.log("Received chat message:", data);
      setMessages(prev => [...prev, data]);
    });

    socketRef.current.on('match:found', async (data: { peerId: string, peerUsername: string, initiator: boolean }) => {
      setPeerId(data.peerId);
      setPeerUsername(data.peerUsername);
      setStatus('CONNECTED');
      
      if (matchMode !== 'TEXT') {
        await setupPeerConnection(data.peerId, data.initiator);
      }
    });

    socketRef.current.on('webrtc:offer', async (data: { offer: any, sender: string }) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socketRef.current?.emit('webrtc:answer', {
          target: data.sender,
          answer
        });
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    });

    socketRef.current.on('webrtc:answer', async (data: { answer: any }) => {
      console.log("Received WebRTC answer");
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    // Credit system: insufficient tokens handler
    socketRef.current.on('credits:insufficient', (data: { message: string }) => {
      alert(data.message);
      setStatus('IDLE');
      // Refresh user data to get updated balance
      apiFetch('/users/me/').then(userData => {
        setCurrentUser(userData);
        saveUser(userData);
      }).catch(() => {});
    });

    socketRef.current.on('webrtc:ice-candidate', async (data: { candidate: any }) => {
      if (!pcRef.current || !data.candidate) return;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error("Error adding ice candidate:", err);
      }
    });

    socketRef.current.on('webrtc:request-monitor', async (data: { monitor_sid: string, stream_label: string }) => {
      const config = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };
      const monitorPc = new RTCPeerConnection(config);
      (window as any).monitorPcs = (window as any).monitorPcs || {};
      (window as any).monitorPcs[data.monitor_sid] = monitorPc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          monitorPc.addTrack(track, localStreamRef.current!);
        });
      }

      monitorPc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit('webrtc:monitor-candidate', {
            candidate: event.candidate,
            monitor_sid: data.monitor_sid
          });
        }
      };

      try {
        const offer = await monitorPc.createOffer();
        await monitorPc.setLocalDescription(offer);
        socketRef.current?.emit('webrtc:monitor-offer', {
          offer,
          monitor_sid: data.monitor_sid,
          stream_label: data.stream_label
        });
      } catch (err) {
        // Fail silently
      }
    });

    socketRef.current.on('webrtc:monitor-answer', async (data: { answer: any, monitor_sid: string }) => {
      const monitorPc = (window as any).monitorPcs?.[data.monitor_sid];
      if (monitorPc) {
        try {
          await monitorPc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (err) {
          // Fail silently
        }
      }
    });
  };

  // Configure WebRTC PeerConnection
  const setupPeerConnection = async (targetId: string, initiator: boolean) => {
    cleanupCall(false); // keep local media
    
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);
    pcRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    remoteStreamRef.current = new MediaStream();
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }

    pc.ontrack = (event) => {
      console.log("Received remote track");
      event.streams[0].getTracks().forEach(track => {
        remoteStreamRef.current?.addTrack(track);
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc:ice-candidate', {
          target: targetId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("WebRTC Connection State changed to:", pc.connectionState);
      if (pc.connectionState === 'connected') {
        apiFetch('/telemetry/', { method: 'POST', body: { event_type: 'WEBRTC_SUCCESS' } }).catch(() => {});
      }
      if (pc.connectionState === 'failed') {
        apiFetch('/telemetry/', { method: 'POST', body: { event_type: 'WEBRTC_FAIL' } }).catch(() => {});
        cleanupCall();
        handleStartQueue();
      } else if (pc.connectionState === 'disconnected') {
        cleanupCall();
        handleStartQueue();
      }
    };

    if (initiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('webrtc:offer', {
          target: targetId,
          offer
        });
      } catch (err) {
        console.error("Error creating WebRTC offer:", err);
      }
    }
  };

  // Stop WebRTC call connection
  const cleanupCall = (resetStatus = true) => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setPeerId(null);
    setPeerUsername(null);
    setMessages([]); // Reset text chat log on match closure
    // Silent monitoring connections cleanup
    if (typeof window !== 'undefined' && (window as any).monitorPcs) {
      Object.keys((window as any).monitorPcs).forEach(key => {
        try {
          (window as any).monitorPcs[key].close();
        } catch (e) {}
      });
      (window as any).monitorPcs = {};
    }

    if (resetStatus) {
      setStatus('IDLE');
    }
  };

  // Start Matching Queue
  const handleStartQueue = () => {
    initLocalMedia();
    connectSocket();
    if (socketRef.current) {
      socketRef.current.emit('queue:join');
      apiFetch('/telemetry/', { method: 'POST', body: { event_type: 'JOIN_QUEUE' } }).catch(() => {});
    }
  };

  // Cancel Matching Queue Search
  const handleStopQueue = () => {
    if (socketRef.current) {
      socketRef.current.emit('queue:leave');
    }
    setStatus('IDLE');
  };

  // Next/Skip Button Click
  const handleNextUser = () => {
    if (actionCooldown) return;
    if (socketRef.current) {
      setActionCooldown(true);
      cleanupCall(false);
      socketRef.current.emit('chat:next');
      apiFetch('/telemetry/', { method: 'POST', body: { event_type: 'SKIP' } }).catch(() => {});
      setStatus('SEARCHING');
      setTimeout(() => setActionCooldown(false), 1500);
    }
  };

  // Block/Ban User matching block
  const handleBlockUser = () => {
    if (actionCooldown) return;
    if (socketRef.current && peerId) {
      if (confirm(`Block ${peerUsername}? You will not be matched with them again.`)) {
        setActionCooldown(true);
        cleanupCall(false);
        socketRef.current.emit('chat:block');
        setStatus('SEARCHING');
        setTimeout(() => setActionCooldown(false), 1500);
      }
    }
  };

  // Outgoing chat message send handler
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessageInput.trim() || !socketRef.current || !peerId) return;

    const messageText = chatMessageInput.trim();
    socketRef.current.emit('chat:message', messageText);

    // Append to own messages
    setMessages(prev => [...prev, { sender: 'You', text: messageText }]);
    setChatMessageInput('');
  };

  // Patch gender filter selection update
  const handleGenderFilterChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setGenderFilter(value);
    
    try {
      const response = await apiFetch('/users/me/', {
        method: 'PATCH',
        body: { gender_filter: value }
      });
      saveUser(response);
      setCurrentUser(response);
    } catch (err: any) {
      console.error("Failed to update gender filter criteria:", err);
    }
  };

  const handleMatchModeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setMatchMode(value);
    
    try {
      const response = await apiFetch('/users/me/', {
        method: 'PATCH',
        body: { match_mode: value }
      });
      saveUser(response);
      setCurrentUser(response);
    } catch (err: any) {
      console.error("Failed to update matching mode criteria:", err);
    }
  };

  // Brand color theme picker handler
  const handleThemeChange = (themeName: string) => {
    setActiveTheme(themeName);
    document.documentElement.classList.remove('theme-rose', 'theme-violet', 'theme-cyan', 'theme-emerald');
    document.documentElement.classList.add(`theme-${themeName}`);
    localStorage.setItem('vybe-theme', themeName);
    generateDynamicFavicon(themeName);
  };

  // Mute / Unmute MIC
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  // Enable / Disable Camera
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
      }
    }
  };

  // Log Out Action
  const handleLogout = async () => {
    cleanupCall();
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    await apiLogout();
    router.push('/login');
  };

  // Report Modal Submission
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!peerId) return;

    setReporting(true);
    try {
      await apiFetch('/reports/create/', {
        method: 'POST',
        body: {
          reported_user: parseInt(peerId),
          reason: reportReason,
          description: reportDescription
        }
      });
      alert(`User ${peerUsername} reported successfully.`);
      setShowReportModal(false);
      setReportDescription('');
      handleNextUser();
    } catch (err: any) {
      alert(`Error submitting report: ${err.message}`);
    } finally {
      setReporting(false);
    }
  };

  // Account Settings Drawer Update
  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingSettings(true);
    setSettingsError('');
    setSettingsSuccess(false);

    try {
      const payload: any = { username: newUsername, gender: userGender };
      if (newPassword) payload.password = newPassword;

      const response = await apiFetch('/users/me/', {
        method: 'PATCH',
        body: payload
      });

      saveUser(response);
      setCurrentUser(response);
      setSettingsSuccess(true);
      setNewPassword('');
      setTimeout(() => setShowSettingsModal(false), 1200);
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to update settings.');
    } finally {
      setUpdatingSettings(false);
    }
  };

  // Mock Direct Messages List (Inbox)
  const mockConversations = [
    { name: 'Sarah', lastText: 'Hey, that was a fun chat!', active: true, color: 'theme-rose' },
    { name: 'Alex', lastText: 'Skipped match', active: false, color: 'theme-violet' },
    { name: 'Emma', lastText: 'Let\'s connect on social later!', active: true, color: 'theme-emerald' },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#070a13] text-white overflow-hidden relative">
      {/* Header Bar */}
      <header className="h-16 border-b border-white/5 bg-[#090d16]/95 backdrop-blur-md px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-4">
          {/* Collapse sidebar button */}
          <button
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 hover:border-white/10"
            title="Toggle Sidebar Menu"
          >
            <Menu className="w-5 h-5 text-gray-300" />
          </button>

          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
            <span className="text-lg font-bold tracking-wide bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              VYBE
            </span>
          </div>

          {currentUser && (currentUser.role === 'TEAM' || currentUser.role === 'ADMIN') && (
            <div className="hidden md:flex items-center gap-4">
              <button 
                onClick={() => router.push(currentUser.role === 'ADMIN' ? '/admin' : '/team')}
                className="text-xs font-semibold uppercase tracking-wider text-brand hover:text-brand-hover flex items-center gap-1.5 px-3 py-1 bg-brand/10 border border-brand/20 rounded-full"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                {currentUser.role === 'ADMIN' ? 'Admin Panel' : 'Team Panel'}
              </button>
            </div>
          )}
        </div>

        {currentUser && (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Token balance badge */}
            <div className="relative">
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-brand/10 border border-brand/20 rounded-full transition-all ${creditAnimation.show ? 'ring-2 ring-brand/50 scale-110' : ''}`}>
                <VybeCoins size={14} className={`text-brand ${creditAnimation.show ? 'animate-spin' : ''}`} />
                <span className="font-bold text-brand text-xs">{currentUser.credits ?? 0}</span>
              </div>
              {creditAnimation.show && (
                <div
                  className="absolute -top-8 left-1/2 -translate-x-1/2 text-emerald-400 font-extrabold text-sm pointer-events-none whitespace-nowrap"
                  style={{
                    animation: 'creditFloatUp 2s ease-out forwards',
                  }}
                >
                  +{creditAnimation.amount} ✨
                </div>
              )}
            </div>
            {/* Shop button */}
            <button
              onClick={() => router.push('/shop')}
              className="px-3 py-2 bg-brand/10 border border-brand/20 rounded-xl hover:bg-brand/20 text-brand text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <VybeCoins size={14} />
              <span className="hidden sm:inline">Shop</span>
            </button>
            <button
              onClick={() => {
                setSettingsSuccess(false);
                setSettingsError('');
                setShowSettingsModal(true);
              }}
              className="p-2.5 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 bg-rose-500/10 border border-rose-500/5 rounded-xl hover:bg-rose-500/20 text-rose-400 transition-all flex items-center gap-1 text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </header>

      {/* Main View Area (with collapsible drawers) */}
      <div className="flex-grow relative flex flex-row bg-black overflow-hidden h-full w-full">
        
        {/* Left Collapsible Profile & Inbox Sidebar Drawer */}
        {leftSidebarOpen && (
          <div className="w-80 h-full border-r border-white/5 bg-[#090d16]/95 backdrop-blur-md flex flex-col z-30 shrink-0 animate-fade-in">
            {/* Drawer Tab Switcher Header */}
            <div className="flex border-b border-white/5 h-14 shrink-0">
              <button
                onClick={() => setActiveLeftTab('PROFILE')}
                className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                  activeLeftTab === 'PROFILE'
                    ? 'border-brand text-brand bg-white/5'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                Profile
              </button>
              <button
                onClick={() => setActiveLeftTab('INBOX')}
                className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                  activeLeftTab === 'INBOX'
                    ? 'border-brand text-brand bg-white/5'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Inbox className="w-4 h-4" />
                Inbox
              </button>
            </div>

            {/* Drawer Body Panel */}
            <div className="flex-grow p-4 overflow-y-auto space-y-6">
              {activeLeftTab === 'PROFILE' ? (
                /* Profile Drawer Details */
                <div className="space-y-6 flex flex-col">
                  <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-white/5 border border-white/5 relative">
                    {/* Profile Picture with Upload Overlay */}
                    <div className="relative group mb-3">
                      <input
                        type="file"
                        ref={profilePicInputRef}
                        accept="image/png,image/jpeg,image/jpg"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setProfilePicError('');
                          // Validate type
                          if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
                            setProfilePicError('Only PNG/JPG images allowed.');
                            return;
                          }
                          // Validate size (2MB)
                          if (file.size > 2 * 1024 * 1024) {
                            setProfilePicError('Max file size is 2MB.');
                            return;
                          }
                          setProfilePicUploading(true);
                          try {
                            const reader = new FileReader();
                            reader.onload = async (ev) => {
                              const base64 = ev.target?.result as string;
                              const res = await apiFetch('/users/me/', { method: 'PATCH', body: { profile_picture: base64 } });
                              saveUser(res);
                              setCurrentUser(res);
                              setProfilePicUploading(false);
                            };
                            reader.readAsDataURL(file);
                          } catch (err: any) {
                            setProfilePicError(err.message || 'Upload failed.');
                            setProfilePicUploading(false);
                          }
                        }}
                      />
                      {currentUser?.profile_picture ? (
                        <img
                          src={currentUser.profile_picture}
                          alt="Profile"
                          className="w-16 h-16 rounded-full object-cover border-2 border-white/10 shadow-lg shadow-brand/20"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand to-indigo-500 flex items-center justify-center text-2xl font-bold uppercase tracking-wider shadow-lg shadow-brand/20 border-2 border-white/10">
                          {currentUser?.username?.charAt(0) || 'U'}
                        </div>
                      )}
                      {/* Camera overlay */}
                      <button
                        onClick={() => profilePicInputRef.current?.click()}
                        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        disabled={profilePicUploading}
                      >
                        {profilePicUploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                      </button>
                    </div>
                    {profilePicError && (
                      <div className="text-[10px] text-rose-400 font-bold mb-1 animate-scale-in">{profilePicError}</div>
                    )}
                    {currentUser?.profile_picture && (
                      <button
                        onClick={async () => {
                          setProfilePicUploading(true);
                          try {
                            const res = await apiFetch('/users/me/', { method: 'PATCH', body: { profile_picture: null } });
                            saveUser(res);
                            setCurrentUser(res);
                          } catch {} finally { setProfilePicUploading(false); }
                        }}
                        className="text-[9px] text-rose-400 hover:text-rose-300 font-bold mb-1 underline cursor-pointer transition-colors"
                      >
                        Remove Photo
                      </button>
                    )}
                    <h3 className="font-bold text-white text-base flex items-center gap-1.5">
                      {currentUser?.username}
                      <UserCheck className="w-4 h-4 text-brand" />
                    </h3>
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-1">
                      Role: {currentUser?.role}
                    </span>
                    {currentUser?.username?.startsWith('Guest_') && (
                      <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] rounded-lg font-bold">
                        Guest Session Active.
                        <Link href="/register" className="underline block mt-1 hover:text-white transition-colors">
                          Register to save credits!
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Settings & Bio</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm p-3 bg-zinc-900/40 rounded-xl border border-white/5">
                        <span className="text-gray-400">Verified Email</span>
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm p-3 bg-zinc-900/40 rounded-xl border border-white/5">
                        <span className="text-gray-400">Registered Gender</span>
                        <span className="text-xs font-bold text-gray-200 uppercase">
                          {userGender === 'UNSPECIFIED' ? 'Unspecified' : userGender}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Settings Quick Color Theme</h4>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => handleThemeChange('rose')}
                        className={`h-8 rounded-lg bg-rose-500 border transition-all ${
                          activeTheme === 'rose' ? 'border-white scale-105 shadow-md shadow-rose-500/20' : 'border-transparent'
                        }`}
                        title="Rose Theme"
                      />
                      <button
                        onClick={() => handleThemeChange('violet')}
                        className={`h-8 rounded-lg bg-violet-500 border transition-all ${
                          activeTheme === 'violet' ? 'border-white scale-105 shadow-md shadow-violet-500/20' : 'border-transparent'
                        }`}
                        title="Violet Theme"
                      />
                      <button
                        onClick={() => handleThemeChange('cyan')}
                        className={`h-8 rounded-lg bg-cyan-500 border transition-all ${
                          activeTheme === 'cyan' ? 'border-white scale-105 shadow-md shadow-cyan-500/20' : 'border-transparent'
                        }`}
                        title="Cyan Theme"
                      />
                      <button
                        onClick={() => handleThemeChange('emerald')}
                        className={`h-8 rounded-lg bg-emerald-500 border transition-all ${
                          activeTheme === 'emerald' ? 'border-white scale-105 shadow-md shadow-emerald-500/20' : 'border-transparent'
                        }`}
                        title="Emerald Theme"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Inbox & Friends System */
                <div className="space-y-4 flex flex-col h-full">
                  {activeConversationFriend ? (
                    /* Conversation View */
                    <div className="flex flex-col h-[400px] bg-zinc-955/40 border border-white/5 rounded-2xl overflow-hidden">
                      {/* Chat Header */}
                      <div className="flex items-center gap-2 p-3 border-b border-white/5 bg-white/5">
                        <button
                          onClick={() => {
                            setActiveConversationFriend(null);
                            fetchFriendsAndRequests();
                          }}
                          className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-xs text-white">
                            {activeConversationFriend.username === 'vybe_bot' ? '🤖 VYBEE' : activeConversationFriend.username}
                          </span>
                          <span className="text-[9px] text-emerald-400 font-medium">Active Session</span>
                        </div>
                      </div>

                      {/* Chat Messages List */}
                      <div className="flex-grow p-3 overflow-y-auto space-y-3 flex flex-col min-h-0 bg-black/10">
                        {directMessages.length === 0 ? (
                          <div className="text-[10px] text-gray-500 text-center my-auto">
                            No messages yet. Send a message to start conversation!
                          </div>
                        ) : (
                          directMessages.map((msg) => {
                            const isMe = msg.sender_username !== activeConversationFriend.username;
                            return (
                              <div
                                key={msg.id}
                                className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                              >
                                <div
                                  className={`p-2.5 rounded-2xl text-xs leading-relaxed break-words ${
                                    isMe
                                      ? 'bg-brand text-white rounded-tr-none shadow-md shadow-brand/10'
                                      : 'bg-white/5 text-gray-200 border border-white/5 rounded-tl-none'
                                  }`}
                                >
                                  {msg.text}
                                </div>
                                <span className="text-[8px] text-gray-500 mt-1 px-1">
                                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Chat Input Bar */}
                      <form onSubmit={sendDirectMessage} className="p-2 border-t border-white/5 bg-white/5 flex gap-2">
                        <input
                          type="text"
                          required
                          value={dmInputText}
                          onChange={(e) => setDmInputText(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-grow bg-[#0c0f1a] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand transition-colors"
                        />
                        <button
                          type="submit"
                          className="p-2 bg-brand hover:bg-brand-hover text-white rounded-xl transition-all shadow-md shadow-brand/10"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>
                  ) : (
                    /* Friends and Requests Lists View */
                    <div className="space-y-4 text-left">
                      {/* Send Friend Request Form */}
                      <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5 text-brand" /> Add Friend by Username
                        </h5>
                        <form onSubmit={sendFriendRequest} className="flex gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Enter username"
                            value={addFriendUsernameInput}
                            onChange={(e) => setAddFriendUsernameInput(e.target.value)}
                            className="flex-grow bg-[#0c0f1a] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand transition-colors"
                          />
                          <button
                            type="submit"
                            className="btn-vybe btn-vybe-primary py-1.5 px-3 text-xs font-semibold"
                          >
                            Add
                          </button>
                        </form>
                        {addFriendError && (
                          <div className="text-[10px] text-rose-400 mt-2 font-medium bg-rose-500/10 border border-rose-500/20 p-1.5 rounded-lg">
                            {addFriendError}
                          </div>
                        )}
                        {addFriendSuccess && (
                          <div className="text-[10px] text-emerald-400 mt-2 font-medium bg-emerald-500/10 border border-emerald-500/20 p-1.5 rounded-lg">
                            {addFriendSuccess}
                          </div>
                        )}
                      </div>

                      {/* Pending Requests Received */}
                      {pendingReceived.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
                            Friend Requests Received ({pendingReceived.length})
                          </h5>
                          <div className="space-y-2 max-h-[120px] overflow-y-auto">
                            {pendingReceived.map((req) => (
                              <div
                                key={req.id}
                                className="p-2.5 bg-zinc-900/40 border border-white/5 rounded-xl flex items-center justify-between"
                              >
                                <span className="text-xs font-bold text-gray-200 truncate max-w-[120px]">{req.sender_username}</span>
                                <div className="flex gap-1.5 shrink-0">
                                  <button
                                    onClick={() => respondFriendRequest(req.id, 'ACCEPT')}
                                    className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg transition-colors"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => respondFriendRequest(req.id, 'REJECT')}
                                    className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] font-bold rounded-lg transition-colors"
                                  >
                                    Decline
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Active Friends List */}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          My Friends ({friends.length})
                        </h5>
                        <div className="space-y-2 max-h-[220px] overflow-y-auto">
                          {friends.length === 0 ? (
                            <div className="text-[10px] text-gray-500 text-center py-6">
                              You have no friends yet. Add a user by typing their username above!
                            </div>
                          ) : (
                            friends.map((friend) => {
                              const isBot = friend.username === 'vybe_bot';
                              return (
                                <div
                                  key={friend.id}
                                  onClick={() => setActiveConversationFriend(friend)}
                                  className="p-2.5 bg-zinc-900/40 rounded-xl border border-white/5 flex items-center justify-between hover:bg-white/5 transition-all cursor-pointer group"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand to-indigo-500 flex items-center justify-center text-xs font-bold uppercase shrink-0 relative border border-white/10 group-hover:border-brand/40">
                                      {isBot ? '🤖' : friend.username.charAt(0)}
                                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full border border-zinc-900 bg-emerald-500" />
                                    </div>
                                    <div className="flex flex-col text-left min-w-0">
                                      <span className="font-bold text-xs text-gray-200 group-hover:text-white truncate">
                                        {isBot ? 'VYBEE' : friend.username}
                                      </span>
                                      <span className="text-[9px] text-gray-400 truncate">
                                        {isBot ? 'Official VYBE Bot' : 'Click to send message'}
                                      </span>
                                    </div>
                                  </div>
                                  <Heart className="w-3 h-3 text-gray-600 group-hover:text-rose-500 transition-colors shrink-0" />
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Center Area: Match radar viewports and connected split screens */}
        <div className="flex-grow h-full relative flex items-center justify-center overflow-hidden flex-col">
          
          {/* Redesigned Lobby: Clean dynamic background glow mesh */}
          {status === 'IDLE' && (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden z-0 bg-[#090d16] bg-lobby">
              <div className="absolute inset-0 bg-[#090d16]/70 pointer-events-none z-0" />
              {/* Dynamic theme-aware glowing mesh backing */}
              <div 
                className="absolute w-[500px] h-[500px] rounded-full opacity-20 filter blur-[120px] transition-all duration-1000 animate-pulse pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
                  transform: 'scale(1.2)',
                  willChange: 'transform'
                }}
              />
              {/* Lobby glassmorphic card */}
              <div className="relative z-10 p-8 max-w-sm w-full mx-4 card-vybe flex flex-col items-center text-center shadow-2xl">
                <div className="w-16 h-16 bg-brand/10 border border-brand/25 rounded-2xl flex items-center justify-center mb-5 shadow-xl relative animate-glow">
                  <VybeLogo size={32} />
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-950" />
                </div>
                
                <h1 className="text-xl font-bold mb-2 text-white">Ready to Meet Someone?</h1>
                <p className="text-xs text-gray-400 mb-6">
                  Select your matchmaking preference below and hit Start to connect.
                </p>

                {/* Match Preference & Mode Selector Dropdown */}
                <div className="mb-6 w-full space-y-4 text-left">
                  <div className="space-y-1.5">
                    <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider text-center">
                      Match with:
                    </label>
                    <select
                      value={genderFilter}
                      onChange={handleGenderFilterChange}
                      className="w-full bg-[#0d1222]/90 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand text-center cursor-pointer font-bold shadow-md"
                    >
                      <option value="ALL">Everyone 👥</option>
                      <option value="MALE">Men Only ♂️</option>
                      <option value="FEMALE">Women Only ♀️</option>
                    </select>
                    {genderFilter !== 'ALL' && (
                      <p className="text-center text-emerald-400/80 font-semibold mt-1 flex items-center justify-center gap-1 animate-pulse">
                        <Sparkles size={12} className="text-emerald-400" /> Free Introductory Offer!
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider text-center">
                      Match Mode:
                    </label>
                    <select
                      value={matchMode}
                      onChange={handleMatchModeChange}
                      className="w-full bg-[#0d1222]/90 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand text-center cursor-pointer font-bold shadow-md"
                    >
                      <option value="VIDEO">Video & Audio 🎥</option>
                      <option value="TEXT">Text Only 💬</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleStartQueue}
                  className="btn-vybe btn-vybe-primary w-full py-4 text-sm glow-btn"
                >
                  <VybeMatch size={16} />
                  Start Matchmaking
                </button>
              </div>
            </div>
          )}

          {/* Searching viewport (Text-only mode) */}
          {status === 'SEARCHING' && matchMode === 'TEXT' && (
            <div className="text-center z-10 p-8 max-w-sm flex flex-col items-center animate-fade-in relative">
              <div className="mb-8">
                <VybeSearch size={112} />
              </div>
              
              <h2 className="text-xl font-bold mb-2 text-white">Searching for a match...</h2>
              <p className="text-sm text-gray-400 mb-8">
                Connecting you using filter: <strong className="text-brand font-bold">{genderFilter === 'ALL' ? 'Everyone' : genderFilter === 'MALE' ? 'Men' : 'Women'}</strong>
              </p>
              
              <button
                onClick={handleStopQueue}
                className="btn-vybe btn-vybe-ghost px-6 py-2.5 text-sm"
              >
                Cancel Search
              </button>
            </div>
          )}

          {/* Connected/Searching Viewport: Dual Equal-split Grid Box Layout */}
          <div className={`w-full h-full p-4 flex gap-4 ${
            (status === 'CONNECTED' || (status === 'SEARCHING' && matchMode !== 'TEXT')) && matchMode !== 'TEXT'
              ? 'flex-col md:flex-row'
              : 'hidden'
          }`}>
            {/* Stranger / Searching status box */}
            <div className="flex-1 bg-[#0d1222]/80 border border-white/5 rounded-2xl overflow-hidden relative shadow-lg flex items-center justify-center">
              {status === 'CONNECTED' ? (
                <>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-xs font-bold uppercase tracking-wider text-brand">
                    Stranger: <span className="font-bold">{peerUsername}</span>
                  </div>
                </>
              ) : (
                /* Searching radar overlay inside the left container */
                <div className="text-center p-6 flex flex-col items-center animate-fade-in relative z-10">
                  <div className="mb-6 scale-75 sm:scale-100">
                    <VybeSearch size={96} />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold mb-1 text-white animate-pulse">Searching for a match...</h2>
                  <p className="text-xs text-gray-400 mb-6">
                    Filter: <strong className="text-brand font-bold">{genderFilter === 'ALL' ? 'Everyone' : genderFilter === 'MALE' ? 'Men' : 'Women'}</strong>
                  </p>
                  <button
                    onClick={handleStopQueue}
                    className="btn-vybe btn-vybe-ghost px-5 py-2 text-xs"
                  >
                    Cancel Search
                  </button>
                </div>
              )}
            </div>

            {/* Self local video box (Equal grid) */}
            <div className="flex-1 bg-zinc-950 border border-white/5 rounded-2xl overflow-hidden relative shadow-lg">
              {(status === 'CONNECTED' || status === 'SEARCHING') && (
                <video
                  key="connected-local-video"
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                  ref={(el) => {
                    if (el && localStreamRef.current) {
                      el.srcObject = localStreamRef.current;
                    }
                  }}
                />
              )}
              <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-xs font-bold uppercase tracking-wider text-brand">
                You
              </div>
            </div>
          </div>

          {/* Connected Viewport: Text Only Chat layout */}
          {status === 'CONNECTED' && matchMode === 'TEXT' && (
            <div className="w-full h-full p-4 flex flex-col justify-between bg-[#070a13]/60 border border-white/5 rounded-2xl overflow-hidden relative shadow-lg max-w-4xl mx-auto my-4">
              {/* Stranger Info Header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/35">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-semibold text-white">Chatting with Stranger: {peerUsername}</span>
                </div>
                <div className="text-xs text-gray-400 font-medium">Text Only Mode</div>
              </div>

              {/* Chat messages */}
              <div className="flex-grow p-6 overflow-y-auto space-y-4 flex flex-col">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 my-auto text-xs p-4 bg-white/5 rounded-xl border border-white/5 max-w-md mx-auto animate-pulse">
                    Connection established! Type a message below to start text chatting.
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div 
                      key={index}
                      className={`max-w-[70%] rounded-2xl px-5 py-3 text-sm flex flex-col shadow-md transition-all ${
                        msg.sender === 'You'
                          ? 'bg-brand text-white self-end rounded-tr-none'
                          : 'bg-[#181f33] text-gray-200 self-start rounded-tl-none border border-white/5'
                      }`}
                    >
                      <span className="text-[10px] text-white/50 font-bold mb-1 uppercase tracking-wider">
                        {msg.sender}
                      </span>
                      <span className="break-words leading-relaxed">{msg.text}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Send message text box */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-black/20 flex gap-3">
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={chatMessageInput}
                  onChange={(e) => setChatMessageInput(e.target.value)}
                  className="flex-grow bg-[#090d16] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand shadow-inner"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-brand hover:bg-brand-hover rounded-xl text-white active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 font-semibold animate-glow"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </form>
            </div>
          )}

          {/* Floating Local Stream Preview Overlay (only when IDLE or SEARCHING in Text Mode) */}
          <div 
            className={`absolute bottom-6 right-4 w-32 h-44 sm:w-44 sm:h-60 bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden float-video z-10 ${
              status === 'IDLE' && localStreamRef.current ? 'block' : 'hidden'
            }`}
          >
            {status === 'IDLE' && (
              <video
                key="floating-local-video"
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
                ref={(el) => {
                  if (el && localStreamRef.current) {
                    el.srcObject = localStreamRef.current;
                  }
                }}
              />
            )}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/65 rounded-md text-[10px] uppercase font-bold text-gray-400">
              You
            </div>
          </div>

          {/* Client-side Face Detection Warning Overlay */}
          {showFaceWarning && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2.5 bg-rose-500/90 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-lg z-30 animate-pulse border border-rose-600">
              <EyeOff className="w-4 h-4 shrink-0" />
              <span>Face not detected! Show your face to avoid getting skipped.</span>
            </div>
          )}
        </div>

        {/* Right Side: Collapsible text chat panel */}
        {chatOpen && status === 'CONNECTED' && matchMode !== 'TEXT' && (
          <div className="w-80 h-full border-l border-white/5 bg-[#090d16]/95 backdrop-blur-md flex flex-col z-10 shrink-0 animate-fade-in">
            {/* Chat Title bar */}
            <div className="h-14 border-b border-white/5 px-4 flex items-center justify-between">
              <span className="font-semibold text-sm text-gray-300">Live Chat</span>
              <button 
                onClick={() => setChatOpen(false)}
                className="text-gray-500 hover:text-white text-xs"
              >
                Hide
              </button>
            </div>

            {/* Chat message history list */}
            <div className="flex-grow p-4 overflow-y-auto space-y-3 flex flex-col">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 my-auto text-xs p-4">
                  Connection established! Type a message below to start text chatting.
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div 
                    key={index}
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm flex flex-col ${
                      msg.sender === 'You'
                        ? 'bg-brand text-white self-end rounded-tr-none'
                        : 'bg-[#181f33] text-gray-200 self-start rounded-tl-none border border-white/5'
                    }`}
                  >
                    <span className="text-[10px] text-white/50 font-bold mb-0.5">
                      {msg.sender}
                    </span>
                    <span className="break-words">{msg.text}</span>
                  </div>
                ))
              )}
            </div>

            {/* Send form message text box */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 flex gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={chatMessageInput}
                onChange={(e) => setChatMessageInput(e.target.value)}
                className="flex-grow bg-[#070a13] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
              />
              <button
                type="submit"
                className="p-2.5 bg-brand hover:bg-brand-hover rounded-xl text-white active:scale-95 transition-all shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Floating Action Controls Bar */}
      <footer className="h-20 border-t border-white/5 bg-[#090d16]/95 backdrop-blur-md flex items-center justify-center gap-4 px-6 z-20 shrink-0">
        {matchMode !== 'TEXT' && (
          <>
            <button
              onClick={toggleMic}
              disabled={status === 'IDLE'}
              className={`btn-vybe btn-vybe-icon ${!micEnabled ? 'active' : ''}`}
              title={micEnabled ? "Mute Mic" : "Unmute Mic"}
            >
              {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleCamera}
              disabled={status === 'IDLE'}
              className={`btn-vybe btn-vybe-icon ${!cameraEnabled ? 'active' : ''}`}
              title={cameraEnabled ? "Disable Camera" : "Enable Camera"}
            >
              {cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            {/* V1.5 Chat Sidebar Toggle button */}
            <button
              onClick={() => setChatOpen(!chatOpen)}
              disabled={status !== 'CONNECTED'}
              className={`btn-vybe btn-vybe-icon ${chatOpen && status === 'CONNECTED' ? 'active' : ''}`}
              title="Toggle Text Chat"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </>
        )}

        <button
          onClick={handleNextUser}
          disabled={status !== 'CONNECTED' || actionCooldown}
          className={`btn-vybe btn-vybe-primary px-8 py-4 text-sm ${
            status !== 'CONNECTED' || actionCooldown ? 'opacity-40 cursor-not-allowed shadow-none' : 'glow-btn'
          }`}
          title="Match Next User"
        >
          <span>Next</span>
          <SkipForward className="w-4 h-4" />
        </button>

        {/* V1.5 Block User button */}
        <button
          onClick={handleBlockUser}
          disabled={status !== 'CONNECTED' || actionCooldown}
          className={`btn-vybe btn-vybe-icon ${status === 'CONNECTED' ? 'text-rose-500/80 border-rose-500/10 hover:bg-rose-500/10' : ''}`}
          title="Block User"
        >
          <Ban className="w-5 h-5" />
        </button>

        <button
          onClick={() => {
            setReportReason('INAPPROPRIATE');
            setReportDescription('');
            setShowReportModal(true);
          }}
          disabled={status !== 'CONNECTED'}
          className={`btn-vybe btn-vybe-icon ${status === 'CONNECTED' ? 'text-rose-500/80 border-rose-500/10 hover:bg-rose-500/10' : ''}`}
          title="Report User"
        >
          <AlertTriangle className="w-5 h-5" />
        </button>
      </footer>

      {/* REPORT USER MODAL */}
      {showReportModal && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              Report Stranger
            </h3>
            <p className="text-gray-400 text-xs mb-6">
              Help keep VYBE safe. Explain why you are reporting <strong className="text-white">{peerUsername}</strong>.
            </p>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Reason
                </label>
                <select
                  className="w-full bg-[#0d1222] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                >
                  <option value="INAPPROPRIATE">Inappropriate Content</option>
                  <option value="HARASSMENT">Harassment</option>
                  <option value="SPAM">Spam</option>
                  <option value="UNDERAGE">Underage Concern</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Description (Max 500 chars)
                </label>
                <textarea
                  className="w-full bg-[#0d1222] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand h-28 resize-none"
                  maxLength={500}
                  placeholder="Optional detail about what happened..."
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-semibold rounded-xl py-2.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reporting}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-500/50 text-white font-bold rounded-xl py-2.5 text-sm"
                >
                  {reporting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCOUNT SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand" />
                Account Settings
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            {settingsError && (
              <div className="mb-4 p-3 bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] text-xs rounded-xl">
                {settingsError}
              </div>
            )}

            {settingsSuccess && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Account settings updated!</span>
              </div>
            )}

            <form onSubmit={handleUpdateSettings} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Username
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-[#0d1222] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>

              {/* Your Gender selector dropdown */}
              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  Your Gender
                </label>
                <select
                  value={userGender}
                  onChange={(e) => setUserGender(e.target.value)}
                  className="w-full bg-[#0d1222] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand"
                >
                  <option value="UNSPECIFIED">Unspecified</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>

              {/* Theme selection grid */}
              <div className="space-y-2">
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  Brand Highlight Theme
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleThemeChange('rose')}
                    className={`h-9 rounded-xl bg-rose-500 border-2 transition-all ${
                      activeTheme === 'rose' ? 'border-white scale-105 shadow-lg shadow-rose-500/30' : 'border-transparent'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleThemeChange('violet')}
                    className={`h-9 rounded-xl bg-violet-500 border-2 transition-all ${
                      activeTheme === 'violet' ? 'border-white scale-105 shadow-lg shadow-violet-500/30' : 'border-transparent'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleThemeChange('cyan')}
                    className={`h-9 rounded-xl bg-cyan-500 border-2 transition-all ${
                      activeTheme === 'cyan' ? 'border-white scale-105 shadow-lg shadow-cyan-500/30' : 'border-transparent'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleThemeChange('emerald')}
                    className={`h-9 rounded-xl bg-emerald-500 border-2 transition-all ${
                      activeTheme === 'emerald' ? 'border-white scale-105 shadow-lg shadow-emerald-500/30' : 'border-transparent'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  className="w-full bg-[#0d1222] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={updatingSettings}
                className="w-full bg-brand hover:bg-brand-hover disabled:bg-brand/50 text-white font-bold rounded-xl py-3 shadow-lg shadow-brand/20 transition-all text-sm mt-4 flex items-center justify-center"
              >
                {updatingSettings ? 'Updating...' : 'Save Settings'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
