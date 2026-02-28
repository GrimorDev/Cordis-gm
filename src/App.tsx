import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Hash, Volume2, Video, Settings, Plus, Search, Bell, Users, 
  Mic, Headphones, Smile, Paperclip, Send, 
  ChevronDown, MessageSquare, Zap, Activity, MoreHorizontal,
  Phone, ScreenShare, LayoutGrid, Menu, X, Edit3, MessageCircle,
  Shield, PlusCircle, Trash2, Settings2, UserPlus, Check, X as XIcon
} from 'lucide-react';

export default function App() {
  const [activeServer, setActiveServer] = useState('cordis');
  const [activeChannel, setActiveChannel] = useState('general');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<'servers' | 'dms' | 'friends'>('servers');
  const [activeCall, setActiveCall] = useState<{type: 'voice' | 'video', user: string} | null>(null);

  // Profile System State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [userProfile, setUserProfile] = useState({
    username: 'Klaudek',
    avatar: 'https://picsum.photos/seed/currentuser/40/40',
    status: 'Online',
    customStatus: 'Building Cordis 🚀',
    bio: 'Senior Fullstack Engineer & Designer.',
    role: 'Owner',
    banner: 'from-indigo-500 via-purple-500 to-pink-500',
    bannerImage: '' // Added bannerImage property
  });
  const [editProfile, setEditProfile] = useState({ ...userProfile });

  const handleSaveProfile = () => {
    setUserProfile(editProfile);
    setIsProfileModalOpen(false);
    if (selectedUser?.username === userProfile.username) {
      setSelectedUser(editProfile);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Online': return 'bg-emerald-500';
      case 'Idle': return 'bg-amber-500';
      case 'Do Not Disturb': return 'bg-rose-500';
      default: return 'bg-zinc-500';
    }
  };

  const usersDb: Record<string, any> = {
    'Alex': { username: 'Alex', role: 'Admin', avatar: 'https://picsum.photos/seed/alex/40/40', status: 'Online', customStatus: 'Shipping features 🚢', bio: 'Lead Engineer at Cordis.', banner: 'from-blue-500 to-cyan-500' },
    'Sarah': { username: 'Sarah', role: 'Engineer', avatar: 'https://picsum.photos/seed/sarah/40/40', status: 'Idle', customStatus: 'In a meeting', bio: 'Frontend Developer. React enthusiast.', banner: 'from-emerald-500 to-teal-500' },
    'Mike': { username: 'Mike', role: 'Designer', avatar: 'https://picsum.photos/seed/mike/40/40', status: 'Do Not Disturb', customStatus: 'Deep work', bio: 'UI/UX Designer creating pixel-perfect interfaces.', banner: 'from-rose-500 to-orange-500' }
  };

  const openUserProfile = (username: string) => {
    if (username === userProfile.username) {
      setSelectedUser(userProfile);
      return;
    }
    const user = usersDb[username] || { username, avatar: `https://picsum.photos/seed/${username}/40/40`, status: 'Online', role: 'Member', banner: 'from-zinc-600 to-zinc-800' };
    setSelectedUser(user);
  };

  const [servers, setServers] = useState([
    { id: 'cordis', name: 'Cordis HQ', icon: <Zap size={16} />, color: 'text-indigo-400', avatar: 'https://picsum.photos/seed/cordis/100/100' },
    { id: 'gaming', name: 'Gaming Lounge', icon: <LayoutGrid size={16} />, color: 'text-emerald-400', avatar: 'https://picsum.photos/seed/gaming/100/100' },
    { id: 'dev', name: 'Engineering', icon: <Activity size={16} />, color: 'text-rose-400', avatar: 'https://picsum.photos/seed/dev/100/100' },
  ]);

  const [serverData, setServerData] = useState<Record<string, any>>({
    'cordis': {
      roles: ['Owner', 'Admin', 'Engineer', 'Designer', 'Member'],
      categories: [
        {
          id: 'cat-spaces',
          name: 'Spaces',
          channels: [
            { id: 'general', name: 'general', type: 'text', unread: 0, allowedRoles: ['Member'] },
            { id: 'announcements', name: 'announcements', type: 'text', unread: 3, allowedRoles: ['Member'] },
            { id: 'design-system', name: 'design-system', type: 'text', unread: 0, allowedRoles: ['Designer', 'Admin'] },
            { id: 'engineering', name: 'engineering', type: 'text', unread: 0, allowedRoles: ['Engineer', 'Admin'] },
          ]
        },
        {
          id: 'cat-voice',
          name: 'Voice Rooms',
          channels: [
            { id: 'standup', name: 'Daily Standup', type: 'voice', participants: 4, allowedRoles: ['Member'] },
            { id: 'lounge', name: 'Lounge', type: 'voice', participants: 0, allowedRoles: ['Member'] },
          ]
        }
      ]
    }
  });

  // Modal States
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [createServerMode, setCreateServerMode] = useState<'create' | 'join'>('create');
  const [createServerName, setCreateServerName] = useState('');
  const [createServerAvatar, setCreateServerAvatar] = useState<string | null>(null);
  const [joinServerKey, setJoinServerKey] = useState('');

  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [serverSettingsTab, setServerSettingsTab] = useState<'overview' | 'roles' | 'categories' | 'invites'>('overview');
  const [inviteDuration, setInviteDuration] = useState('1d');
  const [generatedInvite, setGeneratedInvite] = useState<string | null>(null);
  const [serverSettingsAvatar, setServerSettingsAvatar] = useState<string | null>(null);

  const [channelModalConfig, setChannelModalConfig] = useState<{isOpen: boolean, mode: 'create'|'edit', categoryId: string, channel: any}>({ isOpen: false, mode: 'create', categoryId: '', channel: null });
  const [friends, setFriends] = useState([
    { id: '1', username: 'Alex', status: 'Online', avatar: 'https://picsum.photos/seed/alex/40/40' },
    { id: '2', username: 'Sarah', status: 'Idle', avatar: 'https://picsum.photos/seed/sarah/40/40' },
  ]);

  const [friendRequests, setFriendRequests] = useState([
    { id: '3', username: 'Mike', avatar: 'https://picsum.photos/seed/mike/40/40', type: 'incoming' }
  ]);

  const [dms, setDms] = useState([
    { id: 'dm-alex', user: 'Alex', avatar: 'https://picsum.photos/seed/alex/40/40', unread: 2, status: 'Online' },
    { id: 'dm-sarah', user: 'Sarah', avatar: 'https://picsum.photos/seed/sarah/40/40', unread: 0, status: 'Idle' },
  ]);

  const startCall = (user: string, type: 'voice' | 'video') => {
    setActiveCall({ user, type });
    setSelectedUser(null);
  };

  const endCall = () => {
    setActiveCall(null);
  };

  const messages = [
    { id: 1, user: 'Alex', role: 'Admin', avatar: 'https://picsum.photos/seed/alex/40/40', time: '10:23 AM', content: 'Welcome to the new Cordis workspace. We completely redesigned the architecture.' },
    { id: 2, user: 'Sarah', role: 'Engineer', avatar: 'https://picsum.photos/seed/sarah/40/40', time: '10:25 AM', content: 'The horizontal navigation feels so much better. Floating panels give it a very premium IDE vibe.' },
    { id: 3, user: 'Mike', role: 'Designer', avatar: 'https://picsum.photos/seed/mike/40/40', time: '10:28 AM', content: 'I love the pure black background with the subtle borders. Very clean.' },
    { id: 4, user: 'Alex', role: 'Admin', avatar: 'https://picsum.photos/seed/alex/40/40', time: '10:30 AM', content: 'Wait until you see the WebRTC integration in the right panel. It docks perfectly when you join a voice room.' },
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black text-zinc-300 font-sans overflow-hidden selection:bg-indigo-500/30 relative">
      
      {/* TOP NAVIGATION BAR */}
      <nav className="h-14 md:h-16 border-b border-white/10 flex items-center justify-between px-4 md:px-6 bg-black shrink-0 z-30 relative">
        <div className="flex items-center gap-4 md:gap-8">
          {/* Mobile Menu Toggle */}
          <button 
            onClick={toggleMobileMenu}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Horizontal Server/Workspace List (Hidden on Mobile) */}
          <div className="hidden md:flex items-center gap-2 bg-zinc-900/50 p-1 rounded-2xl border border-white/5">
            <button 
              onClick={() => { setActiveView('friends'); setActiveServer(''); setActiveChannel(''); }}
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
                activeView === 'friends' ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users size={18} />
            </button>
            <button 
              onClick={() => { setActiveView('dms'); setActiveServer(''); setActiveChannel('dm-alex'); }}
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
                activeView === 'dms' ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageCircle size={18} />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            {servers.map(server => (
              <button 
                key={server.id}
                onClick={() => { setActiveServer(server.id); setActiveView('servers'); }}
                className={`flex items-center justify-center lg:justify-start lg:gap-2 w-10 h-10 lg:w-auto lg:h-auto lg:px-3 lg:py-1.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden ${
                  activeServer === server.id && activeView === 'servers'
                    ? 'bg-zinc-800 text-white shadow-sm border border-white/10' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                {server.avatar ? (
                  <img src={server.avatar} alt={server.name} className="w-full h-full lg:w-6 lg:h-6 lg:rounded-md object-cover shrink-0" />
                ) : (
                  <span className={activeServer === server.id ? server.color : ''}>{server.icon}</span>
                )}
                <span className="hidden lg:inline-block">{server.name}</span>
              </button>
            ))}
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={() => setIsCreateServerOpen(true)} className="w-8 h-8 lg:w-9 lg:h-9 flex items-center justify-center rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-colors shrink-0">
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Center Logo (Absolute positioning to ensure it's exactly in the center) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-bold text-lg md:text-xl tracking-tight">
          Cordis
        </div>

        {/* Right Top Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative group hidden sm:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="bg-zinc-900/80 border border-white/10 rounded-full pl-9 pr-4 py-1.5 md:py-2 text-sm text-zinc-200 w-40 lg:w-64 focus:w-48 lg:focus:w-80 transition-all duration-300 outline-none focus:border-indigo-500/50 focus:bg-zinc-900"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex gap-1">
              <kbd className="bg-zinc-800 border border-white/10 rounded px-1.5 text-[10px] font-mono text-zinc-500">⌘</kbd>
              <kbd className="bg-zinc-800 border border-white/10 rounded px-1.5 text-[10px] font-mono text-zinc-500">K</kbd>
            </div>
          </div>
          
          <button className="relative w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full border border-white/10 hover:bg-white/5 transition-colors text-zinc-400 hover:text-white shrink-0">
            <Bell size={18} />
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-black"></span>
          </button>

          <button 
            onClick={() => openUserProfile(userProfile.username)}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-white/10 overflow-hidden hover:border-indigo-500/50 transition-colors shrink-0 cursor-pointer"
          >
            <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
          </button>
        </div>
      </nav>

      {/* MOBILE MENU OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-20 md:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex gap-2 md:gap-4 p-2 md:p-4 overflow-hidden bg-black relative">
        
        {/* LEFT PANEL: Channels & Navigation */}
        <aside className={`
          absolute md:relative z-30 md:z-0
          w-72 md:w-64 shrink-0 flex flex-col bg-zinc-900 border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl
          transition-transform duration-300 ease-in-out h-[calc(100%-1rem)] md:h-auto
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-[120%] md:translate-x-0'}
        `}>
          {/* Mobile Only: Servers List inside the drawer */}
          <div className="md:hidden p-4 border-b border-white/5 overflow-x-auto flex gap-2 custom-scrollbar">
            <button 
              onClick={() => { setActiveView('friends'); setActiveServer(''); setActiveChannel(''); setIsMobileMenuOpen(false); }}
              className={`flex items-center justify-center w-12 h-12 shrink-0 rounded-2xl transition-all duration-200 ${
                activeView === 'friends' ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-500 hover:text-white hover:bg-white/5 bg-zinc-900/50 border border-white/5'
              }`}
            >
              <Users size={20} />
            </button>
            <button 
              onClick={() => { setActiveView('dms'); setActiveServer(''); setActiveChannel('dm-alex'); setIsMobileMenuOpen(false); }}
              className={`flex items-center justify-center w-12 h-12 shrink-0 rounded-2xl transition-all duration-200 ${
                activeView === 'dms' ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-500 hover:text-white hover:bg-white/5 bg-zinc-900/50 border border-white/5'
              }`}
            >
              <MessageCircle size={20} />
            </button>
            <div className="w-px h-8 bg-white/10 mx-1 self-center"></div>
            {servers.map(server => (
              <button 
                key={server.id}
                onClick={() => {
                  setActiveServer(server.id);
                  setActiveView('servers');
                }}
                className={`flex items-center justify-center w-12 h-12 shrink-0 rounded-2xl transition-all duration-200 overflow-hidden ${
                  activeServer === server.id && activeView === 'servers'
                    ? 'bg-zinc-800 text-white shadow-sm border border-white/10' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent bg-zinc-900/50'
                }`}
              >
                {server.avatar ? (
                  <img src={server.avatar} alt={server.name} className="w-full h-full object-cover" />
                ) : (
                  <span className={activeServer === server.id ? server.color : ''}>{server.icon}</span>
                )}
              </button>
            ))}
            <button onClick={() => setIsCreateServerOpen(true)} className="w-12 h-12 shrink-0 flex items-center justify-center rounded-2xl text-zinc-500 hover:text-white hover:bg-white/5 border border-white/5 bg-zinc-900/50 transition-colors">
              <Plus size={20} />
            </button>
          </div>

          {activeView === 'servers' && (
            <>
              {/* Workspace Header */}
              <div 
                className="p-4 md:p-5 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setIsServerSettingsOpen(true)}
              >
                <h2 className="text-base md:text-lg font-bold text-white flex items-center justify-between group">
                  {servers.find(s => s.id === activeServer)?.name || 'Server'}
                  <Settings2 size={16} className="text-zinc-500 group-hover:text-white transition-colors" />
                </h2>
                <p className="text-xs text-zinc-500 mt-1">Click for server settings</p>
              </div>

              <div className="flex-1 overflow-y-auto p-2 md:p-3 custom-scrollbar">
                {serverData[activeServer]?.categories?.map((category: any) => (
                  <div key={category.id} className="mb-6">
                    <div className="flex items-center justify-between px-2 mb-2 group/cat">
                      <span className="text-[10px] md:text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{category.name}</span>
                      <Plus 
                        size={14} 
                        className="text-zinc-500 hover:text-white cursor-pointer opacity-0 group-hover/cat:opacity-100 transition-opacity" 
                        onClick={() => setChannelModalConfig({ isOpen: true, mode: 'create', categoryId: category.id, channel: null })}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      {category.channels.map((channel: any) => (
                        <button 
                          key={channel.id}
                          onClick={() => {
                            if (channel.type === 'text') {
                              setActiveChannel(channel.id);
                              if (window.innerWidth < 768) setIsMobileMenuOpen(false);
                            }
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 group/ch ${
                            activeChannel === channel.id && channel.type === 'text'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                              : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate w-full">
                            {channel.type === 'text' ? (
                              <Hash size={16} className={`shrink-0 ${activeChannel === channel.id ? 'text-indigo-400' : 'text-zinc-600 group-hover/ch:text-zinc-400'}`} />
                            ) : (
                              <Volume2 size={16} className="shrink-0 text-zinc-600 group-hover/ch:text-zinc-400" />
                            )}
                            <span className="text-sm font-medium truncate">{channel.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            {channel.type === 'text' && channel.unread > 0 && (
                              <span className="bg-white text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {channel.unread}
                              </span>
                            )}
                            {channel.type === 'voice' && channel.participants > 0 && (
                              <div className="flex -space-x-2 mr-1">
                                {[...Array(channel.participants)].map((_, i) => (
                                  <img key={i} src={`https://picsum.photos/seed/${channel.id}${i}/20/20`} className="w-5 h-5 rounded-full border border-zinc-900" alt="user" />
                                ))}
                              </div>
                            )}
                            <Settings 
                              size={14} 
                              className="text-zinc-500 hover:text-white opacity-0 group-hover/ch:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                setChannelModalConfig({ isOpen: true, mode: 'edit', categoryId: category.id, channel });
                              }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeView === 'dms' && (
            <>
              <div className="p-4 md:p-5 border-b border-white/5">
                <h2 className="text-base md:text-lg font-bold text-white">Direct Messages</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-2 md:p-3 custom-scrollbar">
                <div className="flex flex-col gap-1">
                  {dms.map(dm => (
                    <button 
                      key={dm.id}
                      onClick={() => {
                        setActiveChannel(dm.id);
                        if (window.innerWidth < 768) setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 group ${
                        activeChannel === dm.id 
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                          : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="relative shrink-0">
                          <img src={dm.avatar} alt={dm.user} className="w-8 h-8 rounded-full object-cover" />
                          <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${getStatusColor(dm.status)} border-2 border-zinc-900 rounded-full`}></div>
                        </div>
                        <span className="text-sm font-medium truncate">{dm.user}</span>
                      </div>
                      {dm.unread > 0 && (
                        <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-2">
                          {dm.unread}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeView === 'friends' && (
            <div className="p-4 md:p-5 border-b border-white/5">
              <h2 className="text-base md:text-lg font-bold text-white">Friends</h2>
            </div>
          )}

          {/* User Mini Profile */}
          <div className="p-2 md:p-3 bg-zinc-900/30 border-t border-white/5">
            <div className="flex items-center justify-between bg-zinc-900/80 border border-white/5 p-2 rounded-2xl">
              <div 
                className="flex items-center gap-2.5 overflow-hidden cursor-pointer group"
                onClick={() => openUserProfile(userProfile.username)}
              >
                <div className="relative shrink-0">
                  <img src={userProfile.avatar} alt="User" className="w-8 h-8 rounded-full object-cover group-hover:opacity-80 transition-opacity" />
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${getStatusColor(userProfile.status)} border-2 border-zinc-900 rounded-full`}></div>
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-bold text-white leading-none truncate group-hover:text-indigo-400 transition-colors">{userProfile.username}</span>
                  <span className="text-[10px] text-zinc-400 mt-1 font-medium truncate">{userProfile.customStatus || userProfile.status}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                  <Mic size={14} />
                </button>
                <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                  <Settings size={14} />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER PANEL: Chat Area */}
        <section className="flex-1 flex flex-col bg-zinc-900 border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl relative min-w-0">
          
          {activeView === 'friends' ? (
            <div className="flex-1 flex flex-col">
              <div className="h-14 md:h-16 border-b border-white/5 flex items-center px-4 md:px-6 shrink-0 bg-zinc-900/80 backdrop-blur-md z-10">
                <Users size={20} className="text-zinc-400 mr-3" />
                <h1 className="text-lg font-bold text-white">Friends</h1>
              </div>
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl mx-auto">
                  {/* Add Friend */}
                  <div className="mb-8">
                    <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Add Friend</h2>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Enter username..." className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50" />
                      <button className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2">
                        <UserPlus size={18} /> Add
                      </button>
                    </div>
                  </div>

                  {/* Pending Requests */}
                  {friendRequests.length > 0 && (
                    <div className="mb-8">
                      <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Pending Requests — {friendRequests.length}</h2>
                      <div className="flex flex-col gap-2">
                        {friendRequests.map(req => (
                          <div key={req.id} className="flex items-center justify-between bg-zinc-900/30 border border-white/5 p-3 rounded-xl">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => openUserProfile(req.username)}>
                              <img src={req.avatar} alt={req.username} className="w-10 h-10 rounded-full object-cover" />
                              <span className="font-bold text-white">{req.username}</span>
                            </div>
                            <div className="flex gap-2">
                              <button className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors"><Check size={18} /></button>
                              <button className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors"><XIcon size={18} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Friends List */}
                  <div>
                    <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-3">All Friends — {friends.length}</h2>
                    <div className="flex flex-col gap-2">
                      {friends.map(friend => (
                        <div key={friend.id} className="flex items-center justify-between bg-zinc-900/30 border border-white/5 p-3 rounded-xl hover:bg-zinc-900/50 transition-colors group">
                          <div className="flex items-center gap-3 cursor-pointer" onClick={() => openUserProfile(friend.username)}>
                            <div className="relative">
                              <img src={friend.avatar} alt={friend.username} className="w-10 h-10 rounded-full object-cover" />
                              <div className={`absolute bottom-0 right-0 w-3 h-3 ${getStatusColor(friend.status)} border-2 border-zinc-900 rounded-full`}></div>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-white">{friend.username}</span>
                              <span className="text-xs text-zinc-500">{friend.status}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => { setActiveView('dms'); setActiveChannel(`dm-${friend.username.toLowerCase()}`); }}
                              className="w-9 h-9 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors"
                            >
                              <MessageCircle size={18} />
                            </button>
                            <button className="w-9 h-9 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors"><MoreHorizontal size={18} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <header className="h-14 md:h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-zinc-900/80 backdrop-blur-md z-10 shrink-0">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  {activeView === 'dms' ? (
                    <div className="flex items-center gap-3">
                      <img src={`https://picsum.photos/seed/${activeChannel}/32/32`} className="w-8 h-8 rounded-full" alt="DM" />
                      <h3 className="font-bold text-white text-base md:text-lg leading-tight truncate capitalize">{activeChannel.replace('dm-', '')}</h3>
                    </div>
                  ) : (
                    <>
                      <div className="hidden sm:flex w-8 h-8 md:w-10 md:h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 items-center justify-center shrink-0">
                        <Hash size={18} className="text-indigo-400" />
                      </div>
                      <div className="truncate">
                        <h3 className="font-bold text-white text-base md:text-lg leading-tight truncate">
                          <span className="sm:hidden text-zinc-500 mr-1">#</span>
                          {serverData[activeServer]?.categories.flatMap((c: any) => c.channels).find((c: any) => c.id === activeChannel)?.name || activeChannel}
                        </h3>
                        <span className="hidden sm:block text-xs text-zinc-500 truncate">General discussion and updates</span>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-1 md:gap-2 shrink-0 ml-2">
                  {activeView === 'dms' && (
                    <div className="flex gap-2 mr-2 border-r border-white/10 pr-4">
                      <button onClick={() => startCall(activeChannel.replace('dm-', ''), 'voice')} className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"><Phone size={16} /></button>
                      <button onClick={() => startCall(activeChannel.replace('dm-', ''), 'video')} className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"><Video size={16} /></button>
                    </div>
                  )}
                  <div className="hidden lg:flex -space-x-2 mr-2 md:mr-4">
                    <img src="https://picsum.photos/seed/alex/28/28" className="w-7 h-7 rounded-full border-2 border-zinc-900" alt="user" />
                    <img src="https://picsum.photos/seed/sarah/28/28" className="w-7 h-7 rounded-full border-2 border-zinc-900" alt="user" />
                    <img src="https://picsum.photos/seed/mike/28/28" className="w-7 h-7 rounded-full border-2 border-zinc-900" alt="user" />
                    <div className="w-7 h-7 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-white">+12</div>
                  </div>
                  {activeView !== 'dms' && (
                    <button className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white transition-colors">
                      <Phone size={16} />
                    </button>
                  )}
                  <button className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white transition-colors">
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </header>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar flex flex-col pb-20 md:pb-24">
            <div className="mt-auto flex flex-col gap-4 md:gap-6">
              
              <div className="text-center my-6 md:my-8">
                {activeView === 'dms' ? (
                  <>
                    <img src={`https://picsum.photos/seed/${activeChannel}/80/80`} className="w-16 h-16 md:w-20 md:h-20 rounded-full mx-auto mb-4 border-4 border-zinc-900" alt="DM" />
                    <h1 className="text-xl md:text-2xl font-bold text-white mb-1 md:mb-2 capitalize">{activeChannel.replace('dm-', '')}</h1>
                    <p className="text-xs md:text-sm text-zinc-500">This is the beginning of your direct message history.</p>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white/5 border border-white/10 mb-3 md:mb-4">
                      <Hash size={24} className="md:w-8 md:h-8 text-zinc-400" />
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold text-white mb-1 md:mb-2">Welcome to {serverData[activeServer]?.categories.flatMap((c: any) => c.channels).find((c: any) => c.id === activeChannel)?.name || activeChannel}</h1>
                    <p className="text-xs md:text-sm text-zinc-500">This is the beginning of this space.</p>
                  </>
                )}
              </div>

              <div className="flex items-center gap-4 my-2 md:my-4">
                <div className="h-px bg-white/5 flex-1"></div>
                <span className="text-[10px] md:text-xs font-semibold text-zinc-600 uppercase tracking-widest">Today</span>
                <div className="h-px bg-white/5 flex-1"></div>
              </div>

              {messages.map((msg, idx) => (
                <motion.div 
                  key={msg.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1, duration: 0.3 }}
                  className="flex gap-3 md:gap-4 group"
                >
                  <img 
                    src={msg.avatar} 
                    alt={msg.user} 
                    onClick={() => openUserProfile(msg.user)}
                    className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                      <span 
                        onClick={() => openUserProfile(msg.user)}
                        className="font-bold text-zinc-100 text-sm md:text-base cursor-pointer hover:underline hover:text-indigo-400 transition-colors"
                      >
                        {msg.user}
                      </span>
                      <span className="text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 uppercase tracking-wider">{msg.role}</span>
                      <span className="text-[10px] md:text-xs text-zinc-600 ml-1">{msg.time}</span>
                    </div>
                    <p className="text-zinc-300 text-sm md:text-[15px] leading-relaxed break-words">{msg.content}</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center gap-1 self-start bg-zinc-900 border border-white/10 rounded-lg p-1 shrink-0">
                    <button className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md"><Smile size={14} /></button>
                    <button className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md"><MoreHorizontal size={14} /></button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Floating Pill Input */}
          <div className="absolute bottom-2 md:bottom-6 left-2 md:left-6 right-2 md:right-6">
            <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl md:rounded-2xl p-1.5 md:p-2 flex items-end gap-1 md:gap-2 shadow-2xl shadow-black/50">
              <button className="w-8 h-8 md:w-10 md:h-10 shrink-0 flex items-center justify-center rounded-lg md:rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                <Plus size={18} className="md:w-5 md:h-5" />
              </button>
              <textarea 
                rows={1}
                placeholder={activeView === 'dms' ? `Message @${activeChannel.replace('dm-', '')}` : `Message in ${serverData[activeServer]?.categories.flatMap((c: any) => c.channels).find((c: any) => c.id === activeChannel)?.name || activeChannel}...`}
                className="flex-1 bg-transparent text-sm md:text-base text-zinc-200 placeholder-zinc-600 resize-none outline-none py-1.5 md:py-2.5 max-h-24 md:max-h-32 custom-scrollbar"
              />
              <div className="flex items-center gap-1 shrink-0">
                <button className="hidden sm:flex w-8 h-8 md:w-10 md:h-10 items-center justify-center rounded-lg md:rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-colors">
                  <Smile size={18} className="md:w-5 md:h-5" />
                </button>
                <button className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg md:rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white transition-colors shadow-lg shadow-indigo-500/20">
                  <Send size={16} className="md:w-[18px] md:h-[18px] ml-0.5" />
                </button>
              </div>
            </div>
          </div>
            </>
          )}
        </section>

        {/* RIGHT PANEL: Context & Active Sessions (Hidden on Mobile/Tablet, visible on Laptop/Desktop) */}
        <aside className="hidden lg:flex flex-col gap-4 w-64 xl:w-80 shrink-0">
          
          {/* Active Voice Session Card */}
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-4 xl:p-5 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs xl:text-sm font-bold text-white truncate">Live: Daily Standup</span>
              </div>
              <span className="text-[10px] xl:text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md shrink-0">04:23</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="aspect-video bg-zinc-900 rounded-xl border border-white/5 relative overflow-hidden group">
                <img src="https://picsum.photos/seed/vid1/200/150" className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" alt="cam" />
                <div className="absolute bottom-1.5 left-1.5 xl:bottom-2 xl:left-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 xl:px-2 xl:py-1 rounded-md text-[9px] xl:text-[10px] font-bold text-white flex items-center gap-1">
                  <Mic size={10} className="text-emerald-400" /> <span className="truncate">Alex</span>
                </div>
              </div>
              <div className="aspect-video bg-zinc-900 rounded-xl border border-white/5 relative overflow-hidden group">
                <div className="absolute inset-0 flex items-center justify-center">
                  <img src="https://picsum.photos/seed/sarah/40/40" className="w-8 h-8 xl:w-10 xl:h-10 rounded-full" alt="user" />
                </div>
                <div className="absolute bottom-1.5 left-1.5 xl:bottom-2 xl:left-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 xl:px-2 xl:py-1 rounded-md text-[9px] xl:text-[10px] font-bold text-white flex items-center gap-1">
                  <Mic size={10} className="text-emerald-400" /> <span className="truncate">Sarah</span>
                </div>
              </div>
              <div className="aspect-video bg-zinc-900 rounded-xl border border-white/5 relative overflow-hidden group">
                <div className="absolute inset-0 flex items-center justify-center">
                  <img src="https://picsum.photos/seed/mike/40/40" className="w-8 h-8 xl:w-10 xl:h-10 rounded-full" alt="user" />
                </div>
                <div className="absolute bottom-1.5 left-1.5 xl:bottom-2 xl:left-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 xl:px-2 xl:py-1 rounded-md text-[9px] xl:text-[10px] font-bold text-white flex items-center gap-1">
                  <Mic size={10} className="text-rose-400" /> <span className="truncate">Mike</span>
                </div>
              </div>
              <div className="aspect-video bg-zinc-900 rounded-xl border border-white/5 flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors">
                <span className="text-[10px] xl:text-xs font-bold text-zinc-500">+1 More</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs xl:text-sm font-bold py-2 xl:py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                <Headphones size={16} /> Join
              </button>
              <button className="w-8 h-8 xl:w-10 xl:h-10 shrink-0 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors flex items-center justify-center">
                <ScreenShare size={16} />
              </button>
            </div>
          </div>

          {/* Activity / Context */}
          <div className="flex-1 bg-zinc-900 border border-white/10 rounded-3xl p-4 xl:p-5 shadow-2xl overflow-y-auto custom-scrollbar">
            <h3 className="text-[10px] xl:text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Activity</h3>
            
            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Video size={14} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs xl:text-sm text-zinc-300"><span className="font-bold text-white">Alex</span> started a screen share in <span className="font-bold text-white">Daily Standup</span></p>
                  <span className="text-[10px] xl:text-xs text-zinc-600">10 mins ago</span>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Hash size={14} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs xl:text-sm text-zinc-300"><span className="font-bold text-white">Sarah</span> created a new space <span className="font-bold text-white">#design-system</span></p>
                  <span className="text-[10px] xl:text-xs text-zinc-600">2 hours ago</span>
                </div>
              </div>
            </div>
          </div>

        </aside>

      </main>

      {/* ACTIVE CALL OVERLAY */}
      <AnimatePresence>
        {activeCall && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col"
          >
            <div className="p-4 flex justify-between items-center border-b border-white/10 bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-white font-bold">{activeCall.type === 'video' ? 'Video Call' : 'Voice Call'} with {activeCall.user}</span>
              </div>
              <button onClick={endCall} className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2 rounded-xl font-bold transition-colors flex items-center gap-2">
                <Phone size={18} className="rotate-[135deg]" /> End Call
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative">
              {activeCall.type === 'video' ? (
                <div className="w-full h-full max-w-6xl aspect-video bg-zinc-900 rounded-3xl border border-white/10 flex items-center justify-center relative overflow-hidden shadow-2xl">
                  <img src={usersDb[activeCall.user]?.avatar || `https://picsum.photos/seed/${activeCall.user}/800/600`} alt="Video feed" className="w-full h-full object-cover opacity-50 blur-sm" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Video size={64} className="text-white/20 mb-4" />
                    <p className="text-white/50 font-medium text-lg">Waiting for video feed...</p>
                  </div>
                  {/* Self View */}
                  <div className="absolute bottom-4 right-4 w-32 md:w-48 aspect-video bg-black rounded-xl border border-white/20 overflow-hidden shadow-2xl">
                    <img src={userProfile.avatar} alt="Self" className="w-full h-full object-cover" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-8">
                  <div className="relative">
                    <img src={usersDb[activeCall.user]?.avatar || `https://picsum.photos/seed/${activeCall.user}/120/120`} alt={activeCall.user} className="w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-indigo-500 object-cover shadow-[0_0_50px_rgba(57,186,230,0.3)]" />
                    <div className="absolute -bottom-2 -right-2 w-12 h-12 md:w-16 md:h-16 bg-zinc-900 rounded-full flex items-center justify-center border-4 border-black">
                      <Mic size={24} className="text-emerald-400" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{activeCall.user}</h2>
                    <p className="text-zinc-400 font-mono text-lg">00:14</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 flex justify-center gap-4 bg-gradient-to-t from-black to-transparent">
              <button className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white transition-colors shadow-xl"><Mic size={24} /></button>
              <button className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white transition-colors shadow-xl"><Video size={24} /></button>
              <button className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white transition-colors shadow-xl"><ScreenShare size={24} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODALS */}
      <AnimatePresence>
        {/* USER PROFILE CARD MODAL */}
        {selectedUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              {/* Banner */}
              <div 
                className={`h-24 w-full bg-gradient-to-r ${selectedUser.banner || 'from-zinc-700 to-zinc-900'} bg-cover bg-center`}
                style={selectedUser.bannerImage ? { backgroundImage: `url(${selectedUser.bannerImage})` } : {}}
              ></div>
              
              {/* Close Button */}
              <button 
                onClick={() => setSelectedUser(null)} 
                className="absolute top-4 right-4 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-colors"
              >
                <X size={16} />
              </button>

              <div className="px-6 pb-6 relative">
                {/* Avatar */}
                <div className="flex justify-between items-end -mt-10 mb-4">
                  <div className="relative">
                    <img src={selectedUser.avatar} alt={selectedUser.username} className="w-20 h-20 rounded-2xl border-4 border-zinc-900 object-cover bg-zinc-900" />
                    <div className={`absolute bottom-0 right-0 w-4 h-4 border-4 border-zinc-900 rounded-full ${getStatusColor(selectedUser.status)}`}></div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {selectedUser.username === userProfile.username ? (
                      <button 
                        onClick={() => {
                          setSelectedUser(null);
                          setEditProfile({ ...userProfile });
                          setIsProfileModalOpen(true);
                        }}
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                      >
                        <Edit3 size={14} /> Edit
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => {
                            setActiveView('dms');
                            setActiveChannel(`dm-${selectedUser.username.toLowerCase()}`);
                            setSelectedUser(null);
                          }}
                          className="w-9 h-9 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-colors"
                        >
                          <MessageCircle size={16} />
                        </button>
                        <button 
                          onClick={() => startCall(selectedUser.username, 'voice')}
                          className="w-9 h-9 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-indigo-500/20"
                        >
                          <Phone size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* User Info */}
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-white leading-none mb-1">{selectedUser.username}</h2>
                  <p className="text-sm text-zinc-400">{selectedUser.customStatus || selectedUser.status}</p>
                </div>

                <div className="w-full h-px bg-white/5 mb-4"></div>

                {/* Bio */}
                <div className="mb-4">
                  <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">About Me</h3>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {selectedUser.bio || "This user hasn't written a bio yet."}
                  </p>
                </div>

                {/* Roles */}
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Roles</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-lg text-xs font-bold">
                      {selectedUser.role}
                    </span>
                    {selectedUser.username === 'Klaudek' && (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-xs font-bold">
                        Early Supporter
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* EDIT PROFILE MODAL */}
        {isProfileModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-zinc-900/30">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit3 size={20} className="text-indigo-400" />
                Edit Profile
              </h2>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {/* Banner Image */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Banner Image URL</label>
                <div className="relative h-20 w-full rounded-xl overflow-hidden border border-white/10 mb-2 bg-zinc-900/50">
                  {editProfile.bannerImage ? (
                    <img src={editProfile.bannerImage} alt="Banner Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-r ${editProfile.banner || 'from-zinc-700 to-zinc-900'}`}></div>
                  )}
                </div>
                <input 
                  type="text" 
                  value={editProfile.bannerImage || ''} 
                  onChange={e => setEditProfile({...editProfile, bannerImage: e.target.value})} 
                  placeholder="https://example.com/banner.jpg"
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors" 
                />
              </div>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <img src={editProfile.avatar} alt="Preview" className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Avatar URL</label>
                  <input 
                    type="text" 
                    value={editProfile.avatar} 
                    onChange={e => setEditProfile({...editProfile, avatar: e.target.value})} 
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors" 
                  />
                </div>
              </div>
              
              {/* Username */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Username</label>
                <input 
                  type="text" 
                  value={editProfile.username} 
                  onChange={e => setEditProfile({...editProfile, username: e.target.value})} 
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors" 
                />
              </div>

              {/* Online Status */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Online Status</label>
                <div className="flex gap-2">
                  {['Online', 'Idle', 'Do Not Disturb'].map(status => (
                    <button
                      key={status}
                      onClick={() => setEditProfile({...editProfile, status})}
                      className={`flex-1 py-2 px-3 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        editProfile.status === status 
                          ? 'bg-zinc-800 border-white/20 text-white shadow-sm' 
                          : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`}></div>
                      {status === 'Do Not Disturb' ? 'DND' : status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Message */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Custom Status</label>
                <input 
                  type="text" 
                  value={editProfile.customStatus} 
                  onChange={e => setEditProfile({...editProfile, customStatus: e.target.value})} 
                  placeholder="What's on your mind?"
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors" 
                />
              </div>
              
              {/* Bio */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">About Me</label>
                <textarea 
                  value={editProfile.bio} 
                  onChange={e => setEditProfile({...editProfile, bio: e.target.value})} 
                  placeholder="Tell us about yourself..."
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors resize-none h-24 custom-scrollbar" 
                />
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-5 border-t border-white/5 flex justify-end gap-3 bg-zinc-900/30">
              <button 
                onClick={() => setIsProfileModalOpen(false)} 
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProfile} 
                className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/20"
              >
                Save Changes
              </button>
            </div>
            </motion.div>
          </motion.div>
        )}
        {/* CREATE SERVER MODAL */}
        {isCreateServerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-zinc-900/30">
                <h2 className="text-xl font-bold text-white">Add a Server</h2>
                <button onClick={() => setIsCreateServerOpen(false)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
              </div>
              
              <div className="flex border-b border-white/5">
                <button 
                  onClick={() => setCreateServerMode('create')}
                  className={`flex-1 py-3 text-sm font-bold transition-colors ${createServerMode === 'create' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Create My Own
                </button>
                <button 
                  onClick={() => setCreateServerMode('join')}
                  className={`flex-1 py-3 text-sm font-bold transition-colors ${createServerMode === 'join' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Join a Server
                </button>
              </div>

              <div className="p-6">
                {createServerMode === 'create' ? (
                  <>
                    <div className="flex justify-center mb-6">
                      <div className="relative group cursor-pointer">
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          onChange={(e) => handleImageUpload(e, setCreateServerAvatar)}
                        />
                        <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center bg-zinc-900/50 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/10 transition-all overflow-hidden">
                          {createServerAvatar ? (
                            <img src={createServerAvatar} alt="Server Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <Plus size={24} className="text-zinc-500 group-hover:text-indigo-400 mb-2" />
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Upload</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Server Name</label>
                    <input 
                      type="text" 
                      value={createServerName}
                      onChange={(e) => setCreateServerName(e.target.value)}
                      placeholder="My Awesome Server" 
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 mb-6" 
                    />
                    <button onClick={() => setIsCreateServerOpen(false)} className="w-full py-2 rounded-xl text-sm font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/20">Create</button>
                  </>
                ) : (
                  <>
                    <div className="text-center mb-6">
                      <h3 className="text-white font-bold mb-2">Have an invite already?</h3>
                      <p className="text-sm text-zinc-400">Enter the invite code below to join an existing server.</p>
                    </div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Invite Link or Code</label>
                    <input 
                      type="text" 
                      value={joinServerKey}
                      onChange={(e) => setJoinServerKey(e.target.value)}
                      placeholder="e.g. hQz7xY" 
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 mb-6" 
                    />
                    <button onClick={() => setIsCreateServerOpen(false)} className="w-full py-2 rounded-xl text-sm font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/20">Join Server</button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* SERVER SETTINGS MODAL */}
        {isServerSettingsOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[600px] max-h-[80vh]">
              {/* Sidebar */}
              <div className="w-full md:w-48 bg-zinc-900/30 border-b md:border-b-0 md:border-r border-white/5 p-4 flex flex-row md:flex-col gap-1 overflow-x-auto custom-scrollbar shrink-0">
                <h3 className="hidden md:block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-2">Settings</h3>
                <button onClick={() => setServerSettingsTab('overview')} className={`text-left px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${serverSettingsTab === 'overview' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>Overview</button>
                <button onClick={() => setServerSettingsTab('roles')} className={`text-left px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${serverSettingsTab === 'roles' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>Roles</button>
                <button onClick={() => setServerSettingsTab('categories')} className={`text-left px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${serverSettingsTab === 'categories' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>Categories</button>
                <button onClick={() => setServerSettingsTab('invites')} className={`text-left px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${serverSettingsTab === 'invites' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>Invites</button>
              </div>
              {/* Content */}
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar relative">
                <button onClick={() => setIsServerSettingsOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20} /></button>
                
                {serverSettingsTab === 'overview' && (
                  <>
                    <h2 className="text-xl font-bold text-white mb-6">Server Overview</h2>
                    
                    <div className="flex justify-center mb-6">
                      <div className="relative group cursor-pointer">
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          onChange={(e) => handleImageUpload(e, setServerSettingsAvatar)}
                        />
                        <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center bg-zinc-900/50 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/10 transition-all overflow-hidden">
                          {serverSettingsAvatar || servers.find(s => s.id === activeServer)?.avatar ? (
                            <img src={serverSettingsAvatar || servers.find(s => s.id === activeServer)?.avatar} alt="Server Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <Plus size={24} className="text-zinc-500 group-hover:text-indigo-400 mb-2" />
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Upload</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Server Name</label>
                    <input type="text" defaultValue={servers.find(s => s.id === activeServer)?.name} className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 mb-6" />

                    <button className="w-full py-2 rounded-xl text-sm font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/20">Save Changes</button>
                  </>
                )}

                {serverSettingsTab === 'categories' && (
                  <>
                    <h2 className="text-xl font-bold text-white mb-6">Categories</h2>
                    <div className="flex flex-col gap-2 mb-4">
                      {serverData[activeServer]?.categories?.map((cat: any) => (
                        <div key={cat.id} className="flex items-center justify-between bg-zinc-900/50 border border-white/5 p-3 rounded-xl">
                          <span className="text-sm text-white font-medium">{cat.name}</span>
                          <button className="text-zinc-500 hover:text-rose-400"><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                    <button className="flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300"><PlusCircle size={16} /> Create Category</button>
                  </>
                )}

                {serverSettingsTab === 'roles' && (
                  <>
                    <h2 className="text-xl font-bold text-white mb-6">Roles</h2>
                    <div className="flex flex-col gap-2 mb-4">
                      {serverData[activeServer]?.roles?.map((role: string) => (
                        <div key={role} className="flex items-center justify-between bg-zinc-900/50 border border-white/5 p-3 rounded-xl">
                          <span className="text-sm text-white font-medium">{role}</span>
                          <button className="text-zinc-500 hover:text-rose-400"><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                    <button className="flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300"><PlusCircle size={16} /> Create Role</button>
                  </>
                )}

                {serverSettingsTab === 'invites' && (
                  <>
                    <h2 className="text-xl font-bold text-white mb-6">Invites</h2>
                    <p className="text-sm text-zinc-400 mb-6">Generate an invite code to let others join your server.</p>
                    
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Expire After</label>
                    <select 
                      value={inviteDuration}
                      onChange={(e) => setInviteDuration(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 mb-6 appearance-none"
                    >
                      <option value="30m">30 Minutes</option>
                      <option value="1h">1 Hour</option>
                      <option value="1d">1 Day</option>
                      <option value="never">Never</option>
                    </select>

                    <button 
                      onClick={() => setGeneratedInvite(Math.random().toString(36).substring(2, 8).toUpperCase())}
                      className="w-full py-2 rounded-xl text-sm font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/20 mb-6"
                    >
                      Generate New Link
                    </button>

                    {generatedInvite && (
                      <div className="bg-zinc-900/80 border border-indigo-500/30 rounded-xl p-4">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5 block">Your Invite Code</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            readOnly 
                            value={generatedInvite} 
                            className="flex-1 bg-transparent text-white font-mono text-lg outline-none"
                          />
                          <button 
                            onClick={() => navigator.clipboard.writeText(generatedInvite)}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium text-white transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* CHANNEL MODAL (CREATE/EDIT) */}
        {channelModalConfig.isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-zinc-900/30">
                <h2 className="text-xl font-bold text-white">{channelModalConfig.mode === 'create' ? 'Create Channel' : 'Edit Channel'}</h2>
                <button onClick={() => setChannelModalConfig({ ...channelModalConfig, isOpen: false })} className="text-zinc-500 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-6 flex flex-col gap-5">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Channel Type</label>
                  <div className="flex gap-2">
                    <button className="flex-1 py-2 px-3 rounded-xl border border-white/20 bg-zinc-800 text-white text-sm font-medium flex items-center justify-center gap-2"><Hash size={16} /> Text</button>
                    <button className="flex-1 py-2 px-3 rounded-xl border border-white/5 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800/50 text-sm font-medium flex items-center justify-center gap-2"><Volume2 size={16} /> Voice</button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Channel Name</label>
                  <input type="text" defaultValue={channelModalConfig.channel?.name || ''} placeholder="new-channel" className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Allowed Roles</label>
                  <div className="flex flex-wrap gap-2">
                    {serverData[activeServer]?.roles?.map((role: string) => (
                      <button key={role} className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-lg text-xs font-bold">{role}</button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setChannelModalConfig({ ...channelModalConfig, isOpen: false })} className="w-full py-2 mt-2 rounded-xl text-sm font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/20">
                  {channelModalConfig.mode === 'create' ? 'Create Channel' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
