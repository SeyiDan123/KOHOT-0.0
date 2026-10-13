import React, { useState, useEffect } from 'react';
import { 
  Inbox, 
  Mail, 
  MailOpen, 
  CheckCircle, 
  Clock, 
  ExternalLink, 
  Search, 
  Filter, 
  RotateCcw, 
  X,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { 
  SupportMessageItem, 
  fetchHostSupportMessages, 
  updateSupportMessageStatus 
} from '../../utils/apiClient';

interface MasterSupportInboxSectionProps {
  isLightMode?: boolean;
}

export const MasterSupportInboxSection: React.FC<MasterSupportInboxSectionProps> = ({
  isLightMode = false,
}) => {
  const [messages, setMessages] = useState<SupportMessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'read' | 'closed'>('all');
  const [selectedMessage, setSelectedMessage] = useState<SupportMessageItem | null>(null);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const res = await fetchHostSupportMessages();
      if (res.success) {
        setMessages(res.messages);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const handleOpenMessage = async (msg: SupportMessageItem) => {
    setSelectedMessage(msg);
    if (msg.status === 'new') {
      await updateSupportMessageStatus(msg.id, 'read');
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: 'read' } : m))
      );
    }
  };

  const handleMarkClosed = async (id: string) => {
    await updateSupportMessageStatus(id, 'closed');
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'closed' } : m))
    );
    if (selectedMessage?.id === id) {
      setSelectedMessage((prev) => (prev ? { ...prev, status: 'closed' } : null));
    }
  };

  const handleReplyMailto = (msg: SupportMessageItem) => {
    const subject = encodeURIComponent(`KoHot Support: Inquiry from ${msg.sender_name}`);
    const mailtoUrl = `mailto:${encodeURIComponent(msg.sender_email)}?subject=${subject}`;
    window.location.href = mailtoUrl;
  };

  const filteredMessages = messages.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        m.sender_name.toLowerCase().includes(q) ||
        m.sender_email.toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q) ||
        (m.set_id && m.set_id.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const newCount = messages.filter((m) => m.status === 'new').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header Card */}
      <div className={`p-6 sm:p-8 rounded-3xl border transition-colors ${
        isLightMode ? 'bg-white border-zinc-200 shadow-md text-zinc-900' : 'bg-[#14151a] border-white/10 text-white'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#d4af37] flex items-center justify-center">
                <Inbox className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-syne font-bold text-xl sm:text-2xl tracking-tight">
                    Support Inbox
                  </h2>
                  {newCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono-tech font-bold bg-amber-500 text-black shadow-xs">
                      {newCount} New
                    </span>
                  )}
                </div>
                <p className={`font-body text-xs sm:text-sm mt-0.5 ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  Incoming inquiries from the public website footer and verified album admin dashboards.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              type="button"
              onClick={loadMessages}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono-tech border flex items-center gap-1.5 transition-all cursor-pointer ${
                isLightMode ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-800' : 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300'
              }`}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="pt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, or message keyword..."
              className={`w-full pl-10 pr-9 py-2 rounded-xl text-xs font-body border focus:outline-none focus:border-[#d4af37] transition-colors ${
                isLightMode ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-500' : 'bg-[#0a0b0e] border-white/10 text-white placeholder:text-zinc-500'
              }`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={`px-3 py-2 rounded-xl text-xs font-mono-tech border focus:outline-none focus:border-[#d4af37] cursor-pointer ${
                isLightMode ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-[#0a0b0e] border-white/10 text-white'
              }`}
            >
              <option value="all">All Statuses ({messages.length})</option>
              <option value="new">New ({newCount})</option>
              <option value="read">Read ({messages.filter((m) => m.status === 'read').length})</option>
              <option value="closed">Closed ({messages.filter((m) => m.status === 'closed').length})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-3">
        {filteredMessages.length === 0 ? (
          <div className={`p-12 text-center rounded-3xl border ${
            isLightMode ? 'bg-white border-zinc-200 text-zinc-600' : 'bg-[#14151a] border-white/10 text-zinc-400'
          }`}>
            <MessageSquare className="w-10 h-10 mx-auto text-zinc-500 mb-2 opacity-60" />
            <p className="font-syne font-bold text-sm text-white">No Support Messages Found</p>
            <p className="font-body text-xs mt-1">
              {messages.length === 0
                ? 'Your inbox is clear. Messages submitted by visitors or admins will appear here.'
                : 'No messages match your search filter.'}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => handleOpenMessage(msg)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                msg.status === 'new'
                  ? isLightMode
                    ? 'bg-amber-500/10 border-amber-500/30 text-zinc-900 shadow-sm'
                    : 'bg-[#18181f] border-amber-400/30 text-white shadow-lg'
                  : isLightMode
                  ? 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-300'
                  : 'bg-[#111216] border-white/5 text-zinc-300 hover:border-white/15'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  msg.status === 'new'
                    ? 'bg-amber-500 text-black font-bold'
                    : msg.status === 'read'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {msg.status === 'new' ? (
                    <Mail className="w-4 h-4" />
                  ) : msg.status === 'read' ? (
                    <MailOpen className="w-4 h-4" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-syne font-bold text-sm text-white">
                      {msg.sender_name}
                    </span>
                    <span className="font-mono-tech text-xs text-zinc-400">
                      &lt;{msg.sender_email}&gt;
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-tech uppercase font-bold ${
                      msg.status === 'new'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : msg.status === 'read'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {msg.status}
                    </span>
                    {msg.set_id && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-tech bg-white/5 text-zinc-300 border border-white/10">
                        Album: {msg.set_id}
                      </span>
                    )}
                  </div>

                  <p className={`font-body text-xs mt-1.5 line-clamp-2 leading-relaxed ${
                    msg.status === 'new' ? 'text-zinc-200 font-medium' : 'text-zinc-400'
                  }`}>
                    {msg.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                <span className="font-mono-tech text-[10px] text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(msg.created_at).toLocaleString()}</span>
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReplyMailto(msg);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  title="Open Host email client to reply directly"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Reply</span>
                </button>

                {msg.status !== 'closed' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkClosed(msg.id);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono-tech text-xs transition-colors cursor-pointer"
                  >
                    Mark Closed
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message Reader Modal */}
      {selectedMessage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
          onClick={() => setSelectedMessage(null)}
        >
          <div
            className={`relative w-full max-w-xl rounded-3xl border p-6 sm:p-8 shadow-2xl flex flex-col space-y-5 text-white ${
              isLightMode ? 'bg-[#18181b] border-white/20' : 'bg-[#14151a] border-white/15'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedMessage(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-tech uppercase font-bold inline-block mb-1 ${
                selectedMessage.status === 'new'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : selectedMessage.status === 'read'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-zinc-800 text-zinc-400'
              }`}>
                {selectedMessage.status}
              </span>
              <h3 className="font-syne font-bold text-xl text-white">
                Message from {selectedMessage.sender_name}
              </h3>
              <p className="font-mono-tech text-xs text-zinc-400">
                {selectedMessage.sender_email} • {new Date(selectedMessage.created_at).toLocaleString()}
              </p>
              {selectedMessage.set_id && (
                <p className="font-mono-tech text-xs text-[#d4af37]">
                  Associated Class Album: {selectedMessage.set_id}
                </p>
              )}
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#0b0c10] border border-white/10 text-zinc-200 text-sm font-body leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
              {selectedMessage.message}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                {selectedMessage.status !== 'closed' && (
                  <button
                    type="button"
                    onClick={() => handleMarkClosed(selectedMessage.id)}
                    className="px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-mono-tech text-xs transition-colors cursor-pointer"
                  >
                    Mark as Closed
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 font-mono-tech text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleReplyMailto(selectedMessage)}
                  className="px-5 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e6c158] text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Reply via Email Client</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
