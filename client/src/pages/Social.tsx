import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigation } from '@/contexts/NavigationContext';
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  Search, 
  Send, 
  Image as ImageIcon,
  MoreVertical,
  Phone,
  Video,
  Users,
  Check,
  CheckCheck,
  Loader2,
  X,
  Crown
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSidebar } from "@/contexts/SidebarContext";
import { useAuth } from "@/hooks/use-auth";
import { useChatSSE } from "@/hooks/use-chat-sse";
import { apiRequest } from "@/lib/queryClient";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const OPERATOR_ID = "OPERATOR"; // Special ID for operator messages

type TabFilter = "all" | "friends" | "groups" | "unread";

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
  isRead: boolean;
  createdAt: string;
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

export default function Social() {
  const { t } = useTranslation();
  const { expanded, notificationOpen, languageOpen, profileOpen } = useSidebar();
  const anyPanelOpen = notificationOpen || languageOpen || profileOpen;
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { navigateTo } = useNavigation();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  const { toast } = useToast();
  const [tabFilter, setTabFilter] = useState<TabFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
  }, [queryClient]);

  const { subscribeToConversation, sendTypingIndicator } = useChatSSE({
    userId: user?.id,
    onNewMessage: handleNewMessage,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigateTo('landing');
    }
  }, [authLoading, isAuthenticated, navigateTo]);

  useEffect(() => {
    if (selectedConversation?.conversation.id) {
      subscribeToConversation(selectedConversation.conversation.id);
    }
  }, [selectedConversation?.conversation.id, subscribeToConversation]);

  const { data: conversationsData, isLoading: conversationsLoading } = useQuery<{ conversations: ConversationWithDetails[] }>({
    queryKey: ["/api/conversations"],
    enabled: isAuthenticated,
  });

  const { data: friendsData, isLoading: friendsLoading } = useQuery<{ friends: User[] }>({
    queryKey: ["/api/friends"],
    enabled: isAuthenticated,
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery<{ messages: Message[] }>({
    queryKey: ['/api/conversations', selectedConversation?.conversation.id, 'messages'],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${selectedConversation?.conversation.id}/messages`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    enabled: !!selectedConversation,
  });

  const { data: userSearchData } = useQuery<{ users: User[] }>({
    queryKey: [`/api/users/search?q=${encodeURIComponent(userSearchQuery)}`],
    enabled: userSearchQuery.length >= 2 && showUserSearch,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, imageUrl }: { content: string; imageUrl?: string | null }) => {
      if (!selectedConversation) throw new Error("No conversation selected");
      return apiRequest("POST", `/api/conversations/${selectedConversation.conversation.id}/messages`, { content, imageUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', selectedConversation?.conversation.id, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setMessageInput("");
      setIsSending(false);
    },
    onError: () => {
      setIsSending(false);
    },
  });

  const startConversationMutation = useMutation({
    mutationFn: async (otherUserId: string): Promise<{ conversation: Conversation }> => {
      const res = await apiRequest("POST", "/api/conversations", { otherUserId });
      return res.json();
    },
    onSuccess: async (data: { conversation: Conversation }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setShowUserSearch(false);
      setUserSearchQuery("");
      const convs = await queryClient.fetchQuery<{ conversations: ConversationWithDetails[] }>({
        queryKey: ["/api/conversations"],
      });
      const newConv = convs?.conversations.find(c => c.conversation.id === data.conversation.id);
      if (newConv) {
        setSelectedConversation(newConv);
      }
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.messages]);

  const handleStartConversationWithFriend = async (friendId: string) => {
    try {
      const res = await apiRequest("POST", "/api/conversations", { otherUserId: friendId });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      const convs = await queryClient.fetchQuery<{ conversations: ConversationWithDetails[] }>({
        queryKey: ["/api/conversations"],
      });
      const conv = convs?.conversations.find(c => c.conversation.id === data.conversation.id);
      if (conv) {
        setSelectedConversation(conv);
        setTabFilter("all");
      }
    } catch (error) {
      console.error("Failed to start conversation with friend:", error);
    }
  };

  const conversations = conversationsData?.conversations || [];
  const messages = messagesData?.messages || [];

  const filteredConversations = conversations.filter(conv => {
    if (tabFilter === "unread" && conv.unreadCount === 0) return false;
    if (searchQuery) {
      const name = getDisplayName(conv.otherUser);
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  function getDisplayName(user: User | null): string {
    if (!user) return t("leaderboard.anonymous");
    if (user.nickname) return user.nickname;
    if (user.firstName) return `${user.firstName} ${user.lastName?.[0] || ""}`.trim();
    if (user.email) return user.email.split("@")[0];
    return t("common.player");
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return t("social.yesterday");
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { month: "2-digit", day: "2-digit", year: "2-digit" });
  }

  function formatMessageDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString([], { month: "2-digit", day: "2-digit", year: "numeric" });
  }

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
    if (isSending || sendMessageMutation.isPending || isUploadingImage) return;

    setIsSending(true);
    try {
      let imageUrl: string | null = null;
      if (hasImage) {
        imageUrl = await uploadImageAndSend();
        if (!imageUrl && !hasText) {
          setIsSending(false);
          return;
        }
      }

      if (hasText || imageUrl) {
        await sendMessageMutation.mutateAsync({ 
          content: messageInput.trim() || '', 
          imageUrl 
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 pt-24">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{t("account.loading")}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <Header />
      
      <main 
        className={`flex-1 overflow-hidden transition-all duration-300 ease-out ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
        style={{ 
          paddingLeft: expanded ? "240px" : "88px",
          paddingTop: "1rem",
          paddingRight: "1rem",
          paddingBottom: "1rem"
        }}
      >
        <Card className="h-full bg-black/80 border-zinc-700 overflow-hidden">
          <CardContent className="p-0 h-full flex">
            {/* Left Panel - Conversations List */}
            <div className="w-80 border-r border-zinc-700 flex flex-col">
              {/* Tabs */}
              <div className="flex items-center gap-2 p-3 border-b border-zinc-700">
                <div className="flex rounded-full bg-zinc-800/50 p-1">
                  {(["all", "friends", "groups", "unread"] as const).map((tab) => (
                    <Button
                      key={tab}
                      variant={tabFilter === tab ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTabFilter(tab)}
                      className={`rounded-full text-xs px-3 ${tabFilter === tab ? "" : "text-muted-foreground"}`}
                      data-testid={`tab-${tab}`}
                    >
                      {t(`social.${tab}`)}
                    </Button>
                  ))}
                </div>
                <div className="flex-1" />
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => setShowUserSearch(!showUserSearch)}
                  data-testid="button-new-message"
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>

              {/* Search */}
              <div className="p-3 border-b border-zinc-700/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    placeholder={showUserSearch ? t("social.searchUsers") : t("social.searchMessages")}
                    value={showUserSearch ? userSearchQuery : searchQuery}
                    onChange={(e) => showUserSearch ? setUserSearchQuery(e.target.value) : setSearchQuery(e.target.value)}
                    className="pl-9 bg-zinc-800/50 border-zinc-700 text-sm"
                    data-testid="input-search"
                  />
                </div>
              </div>

              {/* User Search Results */}
              {showUserSearch && userSearchQuery.length >= 2 && (
                <div className="p-2 border-b border-zinc-700 max-h-48 overflow-y-auto scrollbar-premium">
                  {userSearchData?.users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 cursor-pointer"
                      onClick={() => startConversationMutation.mutate(u.id)}
                      data-testid={`user-search-result-${u.id}`}
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={u.profileImageUrl || undefined} />
                        <AvatarFallback className="text-xs">{getDisplayName(u)[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{getDisplayName(u)}</span>
                    </div>
                  ))}
                  {userSearchData?.users.length === 0 && (
                    <p className="text-xs text-zinc-500 text-center py-2">{t("social.noUsersFound")}</p>
                  )}
                </div>
              )}

              {/* Conversations/Friends List */}
              <div className="flex-1 overflow-y-auto scrollbar-premium">
                {tabFilter === "friends" ? (
                  friendsLoading ? (
                    <div className="p-3 space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="w-10 h-10 rounded-full" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-24 mb-1" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (friendsData?.friends || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <Users className="w-10 h-10 text-zinc-600 mb-2" />
                      <p className="text-sm text-zinc-500">{t("social.noFriends")}</p>
                    </div>
                  ) : (
                    (friendsData?.friends || []).map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-zinc-800/50"
                        onClick={() => handleStartConversationWithFriend(friend.id)}
                        data-testid={`friend-${friend.id}`}
                      >
                        <Avatar 
                          className="w-10 h-10 cursor-pointer ring-2 ring-transparent hover:ring-lime-500 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/profile/${friend.id}`);
                          }}
                          data-testid={`avatar-friend-${friend.id}`}
                        >
                          <AvatarImage src={friend.profileImageUrl || undefined} />
                          <AvatarFallback>{getDisplayName(friend)[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm truncate block">{getDisplayName(friend)}</span>
                          <span className="text-xs text-zinc-500">@{friend.nickname || friend.email?.split("@")[0]}</span>
                        </div>
                        <MessageCircle className="w-4 h-4 text-zinc-500" />
                      </div>
                    ))
                  )
                ) : conversationsLoading ? (
                  <div className="p-3 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-24 mb-1" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <MessageCircle className="w-10 h-10 text-zinc-600 mb-2" />
                    <p className="text-sm text-zinc-500">{t("social.noConversations")}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => setShowUserSearch(true)}
                      data-testid="button-start-conversation"
                    >
                      {t("social.startConversation")}
                    </Button>
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const isOperatorConv = conv.conversation.participantAId === OPERATOR_ID || 
                      conv.conversation.participantBId === OPERATOR_ID;
                    
                    return (
                      <div
                        key={conv.conversation.id}
                        className={`
                          flex items-center gap-3 p-3 cursor-pointer transition-colors
                          ${selectedConversation?.conversation.id === conv.conversation.id 
                            ? "bg-lime-500/20 border-l-2 border-lime-500" 
                            : "hover:bg-zinc-800/50"}
                          ${isOperatorConv ? "border border-amber-500/30 bg-amber-500/5" : ""}
                        `}
                        onClick={() => setSelectedConversation(conv)}
                        data-testid={`conversation-${conv.conversation.id}`}
                      >
                        {isOperatorConv ? (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                            <Crown className="w-5 h-5 text-white" />
                          </div>
                        ) : (
                          <Avatar 
                            className="w-10 h-10 cursor-pointer ring-2 ring-transparent hover:ring-lime-500 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (conv.otherUser?.id) navigate(`/profile/${conv.otherUser.id}`);
                            }}
                            data-testid={`avatar-conversation-${conv.conversation.id}`}
                          >
                            <AvatarImage src={conv.otherUser?.profileImageUrl || undefined} />
                            <AvatarFallback>{getDisplayName(conv.otherUser)[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            {isOperatorConv ? (
                              <span className="font-bold text-sm bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                                TETMEER Operator
                              </span>
                            ) : (
                              <span className="font-medium text-sm truncate">{getDisplayName(conv.otherUser)}</span>
                            )}
                            <span className="text-xs text-zinc-500">
                              {conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : ""}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 truncate">
                            {conv.lastMessage?.content || t("social.noMessages")}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="w-5 h-5 rounded-full bg-lime-500 text-black text-xs font-bold flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Panel - Chat View */}
            <div className="flex-1 flex flex-col">
              {selectedConversation ? (() => {
                const isOperatorConv = selectedConversation.conversation.participantAId === OPERATOR_ID || 
                  selectedConversation.conversation.participantBId === OPERATOR_ID;
                
                return (
                <>
                  {/* Chat Header */}
                  <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                    <div className="flex items-center gap-3">
                      {isOperatorConv ? (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                          <Crown className="w-5 h-5 text-white" />
                        </div>
                      ) : (
                        <Avatar 
                          className="w-10 h-10 cursor-pointer ring-2 ring-transparent hover:ring-lime-500 transition-all"
                          onClick={() => {
                            if (selectedConversation.otherUser?.id) navigate(`/profile/${selectedConversation.otherUser.id}`);
                          }}
                          data-testid="avatar-chat-header"
                        >
                          <AvatarImage src={selectedConversation.otherUser?.profileImageUrl || undefined} />
                          <AvatarFallback>{getDisplayName(selectedConversation.otherUser)[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                      )}
                      <div>
                        {isOperatorConv ? (
                          <>
                            <h3 className="font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">TETMEER Operator</h3>
                            <p className="text-xs text-zinc-500">Official</p>
                          </>
                        ) : (
                          <>
                            <h3 className="font-semibold">{getDisplayName(selectedConversation.otherUser)}</h3>
                            <p className="text-xs text-zinc-500">@{selectedConversation.otherUser?.nickname || selectedConversation.otherUser?.email?.split("@")[0] || "user"}</p>
                          </>
                        )}
                      </div>
                    </div>
                    {!isOperatorConv && (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="w-4 h-4 text-zinc-500" />
                        </div>
                        <Button size="icon" variant="ghost" data-testid="button-call">
                          <Phone className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" data-testid="button-video">
                          <Video className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" data-testid="button-more">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto scrollbar-premium p-4 space-y-4">
                    {messagesLoading ? (
                      <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                            <Skeleton className="h-16 w-64 rounded-2xl" />
                          </div>
                        ))}
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <MessageCircle className="w-12 h-12 text-zinc-600 mb-3" />
                        <p className="text-zinc-500">{t("social.startChatting")}</p>
                      </div>
                    ) : (
                      messages.map((msg, idx) => {
                        const isOwn = msg.senderId === user?.id;
                        const showDate = idx === 0 || 
                          formatMessageDate(messages[idx - 1].createdAt) !== formatMessageDate(msg.createdAt);
                        
                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <div className="text-center my-4">
                                <span className="text-xs text-zinc-500 bg-zinc-800 px-3 py-1 rounded-full">
                                  {formatMessageDate(msg.createdAt)}
                                </span>
                              </div>
                            )}
                            <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`
                                  max-w-[70%] px-4 py-2 rounded-2xl
                                  ${isOwn 
                                    ? "bg-lime-400 text-black rounded-br-sm" 
                                    : "bg-zinc-800 text-white rounded-bl-sm"}
                                `}
                                data-testid={`message-${msg.id}`}
                              >
                                {msg.imageUrl && (
                                  <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
                                    <img 
                                      src={msg.imageUrl} 
                                      alt="Sent image" 
                                      className="max-w-full max-h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      loading="lazy"
                                    />
                                  </a>
                                )}
                                {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                                <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                                  <span className={`text-xs ${isOwn ? "text-lime-800" : "text-zinc-500"}`}>
                                    {formatMessageDate(msg.createdAt)}
                                  </span>
                                  {isOwn && (
                                    msg.isRead 
                                      ? <CheckCheck className="w-3 h-3 text-lime-800" />
                                      : <Check className="w-3 h-3 text-lime-800" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-zinc-700">
                    {/* Image Preview */}
                    {pendingImage && (
                      <div className="mb-3 relative inline-block">
                        <img 
                          src={pendingImage.preview} 
                          alt="Preview" 
                          className="max-h-32 rounded-lg object-cover"
                        />
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-zinc-800 hover:bg-zinc-700"
                          onClick={clearPendingImage}
                          data-testid="button-clear-image"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 bg-zinc-800/50 rounded-full px-4 py-2">
                      <input
                        type="file"
                        ref={imageInputRef}
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handleImageSelect}
                        className="hidden"
                        data-testid="input-image-file"
                      />
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="shrink-0" 
                        onClick={() => imageInputRef.current?.click()}
                        disabled={isUploadingImage}
                        data-testid="button-image"
                      >
                        {isUploadingImage ? (
                          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-zinc-400" />
                        )}
                      </Button>
                      <Input
                        placeholder={t("social.typeMessage")}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-sm"
                        data-testid="input-message"
                      />
                      <Button 
                        size="icon" 
                        onClick={handleSendMessage}
                        disabled={(!messageInput.trim() && !pendingImage) || isSending || sendMessageMutation.isPending || isUploadingImage}
                        className="shrink-0 bg-lime-500 hover:bg-lime-600 text-black"
                        data-testid="button-send"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
                );
              })() : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <MessageCircle className="w-16 h-16 text-zinc-600 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{t("social.selectConversation")}</h3>
                  <p className="text-zinc-500 max-w-md">
                    {t("social.selectConversationDesc")}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
