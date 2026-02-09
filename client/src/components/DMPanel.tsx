import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/hooks/use-auth';
import { useChatSSE } from '@/hooks/use-chat-sse';
import { apiRequest } from '@/lib/queryClient';
import { loginWithGoogle } from '@/lib/auth-utils';
import { useToast } from '@/hooks/use-toast';
import { 
  MessageCircle, 
  X, 
  Send, 
  ArrowLeft,
  Search,
  Plus,
  Image as ImageIcon,
  Loader2,
  Gift,
  Gem,
  Package,
  CheckCircle,
  Crown
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getShopItem } from '@shared/shop';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const OPERATOR_ID = "OPERATOR"; // Special ID for operator messages

interface User {
  id: string;
  email?: string;
  nickname?: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  imageUrl?: string | null;
  giftId?: string | null;
  giftClaimed?: boolean;
  giftClaimedAt?: string | null;
  giftType?: string | null;
  giftItemId?: string | null;
  giftGemAmount?: number;
  isRead: boolean;
  createdAt: string;
}

interface GiftInfo {
  id: string;
  userId: string;
  giftType: string;
  itemId?: string | null;
  gemAmount?: number | null;
  claimedAt?: string | null;
}

interface Conversation {
  id: string;
  participantAId: string;
  participantBId: string;
  lastMessageAt: string;
  createdAt: string;
}

interface ConversationWithDetails {
  conversation: Conversation;
  otherUser: User | null;
  lastMessage: Message | null;
  unreadCount: number;
}

interface DMPanelProps {
  expanded: boolean;
}

export function DMPanel({ expanded }: DMPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { dmOpen, setDmOpen } = useSidebar();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [claimedGifts, setClaimedGifts] = useState<Set<string>>(new Set());
  const [claimingGiftId, setClaimingGiftId] = useState<string | null>(null);
  
  // Check if this is an operator conversation
  const isOperatorConversation = selectedConversation?.conversation?.participantAId === OPERATOR_ID || 
    selectedConversation?.conversation?.participantBId === OPERATOR_ID;

  const handleNewMessage = useCallback((conversationId: string, message: Message) => {
    queryClient.setQueryData<{ messages: Message[] }>(
      ['/api/conversations', conversationId, 'messages'],
      (old) => {
        if (!old) return { messages: [message] };
        const exists = old.messages.some(m => m.id === message.id);
        if (exists) return old;
        return { messages: [...old.messages, message] };
      }
    );
    queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
  }, [queryClient]);

  const { subscribeToConversation } = useChatSSE({
    userId: user?.id,
    onNewMessage: handleNewMessage,
    enabled: isAuthenticated && dmOpen,
  });

  useEffect(() => {
    if (selectedConversation?.conversation.id) {
      subscribeToConversation(selectedConversation.conversation.id);
    }
  }, [selectedConversation?.conversation.id, subscribeToConversation]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        const triggerButton = document.querySelector('[data-testid="button-dm"]');
        if (triggerButton && !triggerButton.contains(event.target as Node)) {
          setDmOpen(false);
        }
      }
    };

    if (dmOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dmOpen, setDmOpen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation]);

  const { data: conversationsData, isLoading: conversationsLoading } = useQuery<{ conversations: ConversationWithDetails[] }>({
    queryKey: ['/api/conversations'],
    enabled: isAuthenticated && dmOpen,
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery<{ messages: Message[] }>({
    queryKey: ['/api/conversations', selectedConversation?.conversation.id, 'messages'],
    enabled: !!selectedConversation && dmOpen,
  });

  const { data: userSearchData } = useQuery<{ users: User[] }>({
    queryKey: ['/api/users', 'search', userSearchQuery],
    enabled: userSearchQuery.length >= 2 && showUserSearch && dmOpen,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, imageUrl }: { content: string; imageUrl?: string | null }) => {
      if (!selectedConversation) throw new Error('No conversation selected');
      return apiRequest('POST', `/api/conversations/${selectedConversation.conversation.id}/messages`, { content, imageUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', selectedConversation?.conversation.id, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      setMessageInput('');
    },
  });

  const claimGift = async (giftId: string) => {
    setClaimingGiftId(giftId);
    try {
      const response = await apiRequest('POST', `/api/gifts/${giftId}/claim`, {});
      const data = await response.json();
      if (data.success) {
        setClaimedGifts(prev => new Set([...Array.from(prev), giftId]));
        const gemsText = data.gemsReceived > 0 ? `+${data.gemsReceived} ${t('shop.gems', 'Gems')}` : '';
        const itemText = data.itemReceived ? `+ ${t('shop.item', 'Item')}: ${data.itemReceived}` : '';
        const defaultText = t('social.giftClaimedSuccess', 'Gift claimed successfully!');
        toast({
          title: t('social.giftClaimed', 'Gift Claimed!'),
          description: `${gemsText} ${itemText}`.trim() || defaultText,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/user/progression'] });
        queryClient.invalidateQueries({ queryKey: ['/api/user/inventory'] });
        // Invalidate messages to refresh giftClaimed status
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      }
    } catch (error: any) {
      toast({
        title: t('social.claimError', 'Claim Error'),
        description: error.message || 'Failed to claim gift',
        variant: 'destructive',
      });
    } finally {
      setClaimingGiftId(null);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({
        title: t("social.imageError", "Image Error"),
        description: t("social.invalidImageType", "Only JPEG, PNG, GIF, and WebP images are allowed."),
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast({
        title: t("social.imageError", "Image Error"),
        description: t("social.imageTooLarge", "Image must be less than 10MB."),
        variant: "destructive",
      });
      return;
    }

    const preview = URL.createObjectURL(file);
    setPendingImage({ file, preview });
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const clearPendingImage = () => {
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.preview);
      setPendingImage(null);
    }
  };

  const uploadImageAndSend = async (): Promise<string | null> => {
    if (!pendingImage) return null;

    setIsUploadingImage(true);
    try {
      const res = await fetch("/api/chat/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pendingImage.file.name,
          size: pendingImage.file.size,
          contentType: pendingImage.file.type,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }

      const { uploadURL, objectPath } = await res.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: pendingImage.file,
        headers: { "Content-Type": pendingImage.file.type },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image");
      }

      clearPendingImage();
      return objectPath;
    } catch (err: any) {
      toast({
        title: t("social.uploadFailed", "Upload Failed"),
        description: err.message || t("social.uploadError", "Failed to upload image."),
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSendMessage = async () => {
    const hasText = messageInput.trim().length > 0;
    const hasImage = !!pendingImage;

    if (!hasText && !hasImage) return;
    if (sendMessageMutation.isPending || isUploadingImage) return;

    let imageUrl: string | null = null;
    if (hasImage) {
      imageUrl = await uploadImageAndSend();
      if (!imageUrl && !hasText) return;
    }

    if (hasText || imageUrl) {
      sendMessageMutation.mutate({ content: messageInput.trim() || '', imageUrl });
    }
  };

  const startConversationMutation = useMutation({
    mutationFn: async (otherUserId: string): Promise<{ conversation: Conversation }> => {
      const res = await apiRequest('POST', '/api/conversations', { otherUserId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      setShowUserSearch(false);
      setUserSearchQuery('');
    },
  });

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartConversation = async (otherUser: User) => {
    const result = await startConversationMutation.mutateAsync(otherUser.id);
    const newConversation: ConversationWithDetails = {
      conversation: result.conversation,
      otherUser,
      lastMessage: null,
      unreadCount: 0,
    };
    setSelectedConversation(newConversation);
  };

  const getUserDisplayName = (u: User | null) => {
    if (!u) return 'Unknown';
    if (u.nickname) return u.nickname;
    if (u.firstName) return `${u.firstName}${u.lastName ? ' ' + u.lastName : ''}`;
    return u.email || 'Unknown';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const totalUnread = conversationsData?.conversations?.reduce((sum, c) => sum + c.unreadCount, 0) || 0;

  if (!isAuthenticated) return null;

  return createPortal(
    <>
      {/* Background overlay with blur */}
      <div
        className={`
          fixed inset-0 z-40
          bg-black/40 backdrop-blur-sm
          transition-opacity duration-300
          ${dmOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={() => setDmOpen(false)}
      />
      <div
        ref={panelRef}
        className={`
          fixed z-50 
          bg-white/5 backdrop-blur-md
          border-0
          rounded-2xl shadow-2xl
          transition-[opacity,transform,left] duration-300 ease-out
          ${dmOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}
        `}
        style={{ 
          left: expanded ? '240px' : '88px',
          top: 'calc(3.5rem + 0.5rem + 1rem)',
          bottom: '1rem',
          width: '360px'
        }}
        data-testid="dm-panel"
      >
      <div className="flex flex-col h-full">
        {selectedConversation ? (
          <>
            <div className="p-3 flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                className="rounded-lg flex-shrink-0"
                onClick={() => setSelectedConversation(null)}
                data-testid="button-back-to-conversations"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              {isOperatorConversation ? (
                <>
                  <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <Crown className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                      TETMEER Operator
                    </span>
                    <p className="text-xs text-muted-foreground">Official</p>
                  </div>
                </>
              ) : (
                <>
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={selectedConversation.otherUser?.profileImageUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {selectedConversation.otherUser?.firstName?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate flex-1">
                    {getUserDisplayName(selectedConversation.otherUser)}
                  </span>
                </>
              )}
              <Button 
                variant="ghost" 
                size="icon"
                className="rounded-lg flex-shrink-0"
                onClick={() => setDmOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-premium p-3 space-y-2">
              {messagesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-3/4" />
                  ))}
                </div>
              ) : messagesData?.messages?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageCircle className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">{t('social.noMessages', 'No messages yet')}</p>
                </div>
              ) : (
                <>
                  {messagesData?.messages?.map((message) => {
                    const isOwn = message.senderId === user?.id;
                    const isOperatorMessage = message.senderId === OPERATOR_ID;
                    const hasGift = !!message.giftId;
                    // Use server-side giftClaimed status (from giftClaimedAt), with local tracking for immediate feedback
                    const isGiftClaimed = message.giftClaimed === true || 
                      message.giftClaimedAt !== null || 
                      (message.giftId ? claimedGifts.has(message.giftId) : false);
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : isOperatorMessage
                              ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-bl-md'
                              : 'bg-white/10 rounded-bl-md'
                          }`}
                        >
                          {isOperatorMessage && (
                            <div className="flex items-center gap-1 text-amber-400 text-xs mb-1">
                              <Gift className="w-3 h-3" />
                              <span className="font-medium">TETMEER Operator</span>
                            </div>
                          )}
                          {message.imageUrl && (
                            <a href={message.imageUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
                              <img 
                                src={message.imageUrl} 
                                alt="Sent image" 
                                className="max-w-full max-h-48 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                loading="lazy"
                              />
                            </a>
                          )}
                          {message.content && <p className="break-words">{message.content}</p>}
                          {hasGift && message.giftId && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-2 mb-2">
                                <div className="flex items-center gap-1 mb-1">
                                  <Gift className="w-3 h-3 text-amber-400" />
                                  <span className="text-xs font-medium text-amber-400">
                                    {t('social.giftContents', 'Gift Contents')}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {message.giftItemId && (() => {
                                    const item = getShopItem(message.giftItemId);
                                    return (
                                      <div className="flex items-center gap-1 text-xs">
                                        <Package className="w-3 h-3 text-purple-400" />
                                        <span className="text-foreground">
                                          {item ? t(item.nameKey, item.id) : message.giftItemId}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                  {(message.giftGemAmount ?? 0) > 0 && (
                                    <div className="flex items-center gap-1 text-xs">
                                      <Gem className="w-3 h-3 text-cyan-400" />
                                      <span className="text-foreground">
                                        {message.giftGemAmount?.toLocaleString()} {t('shop.gems', 'Gems')}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {isGiftClaimed ? (
                                <div className="flex items-center gap-1 text-green-400 text-xs">
                                  <CheckCircle className="w-3 h-3" />
                                  <span>{t('social.giftAlreadyClaimed', 'Gift claimed!')}</span>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => claimGift(message.giftId!)}
                                  disabled={claimingGiftId === message.giftId}
                                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 border-0 text-white hover:from-amber-600 hover:to-orange-600"
                                  data-testid={`button-claim-gift-${message.id}`}
                                >
                                  {claimingGiftId === message.giftId ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <Gift className="w-3 h-3 mr-1" />
                                  )}
                                  {t('social.claimGift', 'Claim Gift')}
                                </Button>
                              )}
                            </div>
                          )}
                          <p className={`text-[10px] mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="p-3">
              {isOperatorConversation ? (
                <div className="text-center text-muted-foreground text-xs py-2 px-3 bg-white/5 rounded-xl">
                  <Gift className="w-4 h-4 inline-block mr-1 text-amber-400" />
                  {t('social.operatorOnlyMessages', 'This is a system message channel. Replies are disabled.')}
                </div>
              ) : (
                <>
                  {pendingImage && (
                    <div className="mb-2 relative inline-block">
                      <img 
                        src={pendingImage.preview} 
                        alt="Preview" 
                        className="max-h-24 rounded-lg object-cover"
                      />
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-black/70 hover:bg-black/90"
                        onClick={clearPendingImage}
                        data-testid="button-clear-dm-image"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={imageInputRef}
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleImageSelect}
                      className="hidden"
                      data-testid="input-dm-image-file"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="rounded-xl flex-shrink-0"
                      data-testid="button-dm-image"
                    >
                      {isUploadingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                    </Button>
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder={t('social.typeMessage', 'Type a message...')}
                      className="flex-1 bg-white/5 border-white/10 rounded-xl text-sm"
                      data-testid="input-dm-message"
                    />
                    <Button
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={(!messageInput.trim() && !pendingImage) || sendMessageMutation.isPending || isUploadingImage}
                      className="rounded-xl flex-shrink-0"
                      data-testid="button-send-dm"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="p-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{t('social.messages', 'Messages')}</h2>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="rounded-lg"
                  onClick={() => setShowUserSearch(!showUserSearch)}
                  data-testid="button-new-dm"
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="rounded-lg"
                  onClick={() => setDmOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {showUserSearch && (
              <div className="p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder={t('social.searchUsers', 'Search users...')}
                    className="pl-9 bg-white/5 border-white/10 rounded-xl text-sm"
                    data-testid="input-search-users-dm"
                    autoFocus
                  />
                </div>
                {userSearchData?.users && userSearchData.users.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto scrollbar-premium">
                    {userSearchData.users.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleStartConversation(u)}
                        className="w-full p-2 rounded-xl flex items-center gap-2 hover-elevate active-elevate-2 transition-colors"
                        data-testid={`user-result-${u.id}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xs">{u.firstName?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">{getUserDisplayName(u)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto scrollbar-premium">
              {conversationsLoading ? (
                <div className="p-3 space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : conversationsData?.conversations?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  <MessageCircle className="w-10 h-10 mb-3 opacity-50" />
                  <p className="text-sm text-center">{t('social.noConversations', 'No conversations yet')}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowUserSearch(true)}
                    data-testid="button-start-conversation"
                  >
                    {t('social.startConversation', 'Start a conversation')}
                  </Button>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {conversationsData?.conversations?.map((conv) => {
                    const isOperatorConv = conv.conversation.participantAId === OPERATOR_ID || 
                      conv.conversation.participantBId === OPERATOR_ID;
                    
                    return (
                      <button
                        key={conv.conversation.id}
                        onClick={() => setSelectedConversation(conv)}
                        className={`w-full p-2 rounded-xl flex items-center gap-3 hover-elevate active-elevate-2 transition-colors text-left ${isOperatorConv ? 'border border-amber-500/30 bg-amber-500/5' : ''}`}
                        data-testid={`conversation-${conv.conversation.id}`}
                      >
                        <div className="relative">
                          {isOperatorConv ? (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                              <Crown className="w-5 h-5 text-white" />
                            </div>
                          ) : (
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={conv.otherUser?.profileImageUrl || undefined} />
                              <AvatarFallback className="text-sm">
                                {conv.otherUser?.firstName?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {conv.unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-medium">
                              {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            {isOperatorConv ? (
                              <span className="text-sm font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                                TETMEER Operator
                              </span>
                            ) : (
                              <span className="text-sm font-medium truncate">
                                {getUserDisplayName(conv.otherUser)}
                              </span>
                            )}
                            {conv.lastMessage && (
                              <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                                {formatTime(conv.lastMessage.createdAt)}
                              </span>
                            )}
                          </div>
                          {conv.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {conv.lastMessage.senderId === user?.id ? 'You: ' : ''}
                              {conv.lastMessage.content}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </>,
    document.body
  );
}

interface DMButtonProps {
  expanded: boolean;
}

export function DMButton({ expanded }: DMButtonProps) {
  const { t } = useTranslation();
  const { dmOpen, setDmOpen, setNotificationOpen, setLanguageOpen, setProfileOpen } = useSidebar();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversationsData } = useQuery<{ conversations: ConversationWithDetails[] }>({
    queryKey: ['/api/conversations'],
    enabled: isAuthenticated,
  });

  const totalUnread = conversationsData?.conversations?.reduce((sum, c) => sum + c.unreadCount, 0) || 0;

  const handleClick = () => {
    if (!isAuthenticated) {
      loginWithGoogle();
      return;
    }
    setNotificationOpen(false);
    setLanguageOpen(false);
    setProfileOpen(false);
    setDmOpen(!dmOpen);
  };

  return (
    <Button
      variant={dmOpen ? 'secondary' : 'ghost'}
      onClick={handleClick}
      className="w-full h-10 rounded-xl px-0 overflow-visible"
      data-testid="button-dm"
    >
      <div className={`flex items-center w-full ${expanded ? '' : 'justify-center'}`}>
        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 relative">
          <MessageCircle className="w-5 h-5" />
          {isAuthenticated && totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-medium px-1">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </div>
        <div 
          className={`overflow-hidden transition-all duration-300 ease-out ${
            expanded ? 'w-[140px] opacity-100' : 'w-0 opacity-0'
          }`}
        >
          <span className="whitespace-nowrap text-sm">{t('social.messages', 'Messages')}</span>
        </div>
      </div>
    </Button>
  );
}
