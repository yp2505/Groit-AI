import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Hash, 
  Search, 
  Send, 
  Bell, 
  Users, 
  Info, 
  AtSign, 
  Video, 
  MoreVertical,
  ChevronDown,
  Activity,
  User,
  Settings
} from 'lucide-react';

const SlackDashboard = () => {
  const [activeChannel, setActiveChannel] = useState('#general');
  const [message, setMessage] = useState('');

  // Fetch history from backend
  const { data: messages = [], refetch } = useQuery({
    queryKey: ['slack_messages'],
    queryFn: async () => {
      // Use relative path through Vite proxy
      const res = await fetch('/api/slack/messages');
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    refetchInterval: 2000 // Refined polling to 2s
  });

  const { data: channels = ['#general', '#dev', '#hackathon-dev', '#alerts'] } = useQuery({
    queryKey: ['slack_channels'],
    queryFn: async () => {
      const res = await fetch('/api/slack/channels');
      if (!res.ok) throw new Error('Failed to fetch channels');
      return res.json();
    }
  });

  const filteredMessages = messages.filter((m: any) => m.channel === activeChannel);

  return (
    <div className="flex h-screen bg-[#1A1D21] text-[#D1D2D3] font-sans selection:bg-[#264E68] overflow-hidden">
      {/* Sidebar - Slack Look */}
      <div className="w-64 bg-[#19171D] border-r border-[#313233] flex flex-col shadow-xl">
        <div className="p-4 flex justify-between items-center hover:bg-[#350D36] cursor-pointer transition-all group border-b border-[#313233]/50">
          <div className="flex flex-col">
            <span className="font-black text-white flex items-center gap-1 text-sm tracking-tight">
              AGENTIC WORKSPACE <ChevronDown size={14} className="opacity-40" />
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-[11px] font-medium opacity-60">Tejas Singh</span>
            </div>
          </div>
          <div className="w-8 h-8 bg-[#3F0E40] border border-white/20 rounded flex items-center justify-center text-white">
            <User size={16} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pt-4 space-y-1">
          <div className="px-4 py-1.5 flex items-center justify-between text-[#818284] hover:text-white cursor-pointer group">
            <div className="flex items-center gap-3">
              <Activity size={16} className="opacity-60" />
              <span className="text-[15px] font-medium">All Activities</span>
            </div>
          </div>
          
          <div className="h-4" />

          <div className="px-4 py-2 flex items-center justify-between text-[#818284] font-bold text-[13px] group">
            <span className="uppercase tracking-wider">Channels</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-lg">+</span>
          </div>

          {(channels || []).map((chan: string) => (
            <div 
              key={chan}
              onClick={() => setActiveChannel(chan)}
              className={`px-4 py-1.5 flex items-center gap-2 cursor-pointer transition-all mx-2 rounded-md ${
                activeChannel === chan ? 'bg-[#1164A3] text-white' : 'hover:bg-[#27242C] text-[#D1D2D3]'
              }`}
            >
              <Hash size={16} className={activeChannel === chan ? 'text-white' : 'opacity-40'} />
              <span className="text-[15px]">{chan.replace('#', '')}</span>
            </div>
          ))}

          <div className="h-4" />
          <div className="px-4 py-2 flex items-center justify-between text-[#818284] font-bold text-[13px]">
            <span className="uppercase tracking-wider">Direct Messages</span>
          </div>
          <div className="px-4 py-1.5 flex items-center gap-3 hover:bg-[#27242C] cursor-pointer mx-2 rounded-md group">
            <div className="relative">
              <div className="w-6 h-6 rounded bg-[#4A154B] flex items-center justify-center text-[10px] font-bold text-white">A</div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#19171D]" />
            </div>
            <span className="text-[15px] group-hover:text-white">Agentic Bot</span>
            <span className="ml-auto text-[10px] bg-white/10 px-1 rounded opacity-60">YOU</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col bg-[#1A1D21] relative">
        {/* Connection Status Banner */}
        <div className="h-1 bg-gradient-to-r from-green-500/0 via-green-500/40 to-green-500/0" />

        {/* Header */}
        <div className="h-[64px] border-b border-[#313233] flex items-center justify-between px-6 bg-[#1A1D21]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="hover:bg-[#27242C] p-1.5 rounded-md cursor-pointer transition-colors">
              <span className="font-black text-white text-xl tracking-tight flex items-center gap-2">
                <Hash size={20} className="text-[#818284]" /> {activeChannel.replace('#', '')}
                <ChevronDown size={14} className="opacity-40" />
              </span>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex -space-x-1.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-6 h-6 rounded border-2 border-[#1A1D21] bg-[#4A154B] flex items-center justify-center text-[8px] font-bold text-white">U{i}</div>
              ))}
            </div>
            <div className="h-6 w-[1px] bg-[#313233]" />
            <div className="flex items-center gap-4 text-[#818284]">
              <Video size={20} className="hover:text-white cursor-pointer transition-colors" />
              <Search size={20} className="hover:text-white cursor-pointer transition-colors" />
              <Info size={20} className="hover:text-white cursor-pointer transition-colors" />
              <Settings size={20} className="hover:text-white cursor-pointer transition-colors" />
            </div>
          </div>
        </div>

        {/* Messages Layout */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth custom-scrollbar">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 max-w-md mx-auto text-center">
              <div className="w-20 h-20 bg-[#27242C] rounded-full flex items-center justify-center text-[#1164A3]">
                <Hash size={40} />
              </div>
              <h3 className="text-2xl font-bold text-white">This is the start of the {activeChannel} channel</h3>
              <p className="text-[#818284]">Workflows sent by Groit AI will appear here in real-time. Try asking "Notify Slack about Jira status" to see it in action.</p>
            </div>
          ) : (
            filteredMessages.map((msg: any, idx: number) => {
               const prevMsg = filteredMessages[idx-1];
               const isConsecutive = prevMsg && prevMsg.sender === msg.sender && (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 300000);
               
               return (
                <div key={msg.id} className={`flex gap-4 group transition-all ${isConsecutive ? 'mt-[-28px]' : 'mt-0'}`}>
                  {!isConsecutive ? (
                    <div className="w-10 h-10 rounded bg-[#4A154B] flex items-center justify-center text-white shrink-0 font-bold shadow-lg shadow-black/20 text-lg">
                      {msg.sender?.[0] || 'A'}
                    </div>
                  ) : (
                    <div className="w-10 shrink-0 text-[10px] opacity-0 group-hover:opacity-40 flex justify-center items-center h-5">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </div>
                  )}
                  <div className="flex-1">
                    {!isConsecutive && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-white hover:underline cursor-pointer leading-none">{msg.sender}</span>
                        <span className="text-[11px] font-medium opacity-40 ml-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.sender === 'Groit AI' && (
                          <span className="px-1.5 py-0.5 bg-white/10 text-[9px] font-black rounded uppercase tracking-tighter text-white/80">APP</span>
                        )}
                      </div>
                    )}
                    <div className="text-[#D1D2D3] text-[15px] leading-relaxed whitespace-pre-wrap select-text">
                      {msg.text}
                    </div>
                  </div>
                </div>
               );
            })
          )}
        </div>

        {/* Message Input - Premium Floating Look */}
        <div className="px-6 pb-6">
          <div className="bg-[#222529] border border-[#565856]/40 rounded-xl shadow-2xl overflow-hidden focus-within:border-[#1164A3] transition-all">
            <div className="bg-[#1A1D21]/30 p-2.5 px-4 text-sm opacity-60 border-b border-[#313233]/40 flex gap-5 items-center">
              <span className="font-bold hover:text-white cursor-pointer">B</span>
              <span className="italic hover:text-white cursor-pointer">I</span>
              <span className="line-through hover:text-white cursor-pointer">S</span>
              <div className="w-[1px] h-4 bg-[#313233]" />
              <span className="font-mono hover:text-white cursor-pointer">/&gt;</span>
              <span className="hover:text-white cursor-pointer">Link</span>
              <div className="ml-auto flex gap-4">
                <AtSign size={16} />
                <Bell size={16} />
              </div>
            </div>
            <div className="relative">
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Message ${activeChannel}`}
                className="w-full bg-transparent p-4 min-h-[120px] outline-none placeholder:opacity-40 text-[15px] resize-none"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button className="p-2 px-5 bg-[#007A5A] text-white rounded-lg font-black hover:bg-[#148567] transition-all flex items-center gap-2 shadow-lg shadow-[#007A5A]/30">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-center mt-3 scale-75 opacity-20 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
               <span className="text-[10px] uppercase font-black tracking-widest text-[#D1D2D3]">Live Gateway Connected</span>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #313233; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #48494B; }
      `}</style>
    </div>
  );
};

export default SlackDashboard;
