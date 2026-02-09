import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Trophy, Gamepad2, Crown, Shield, Search, RefreshCw, ChevronLeft, ChevronRight, Eye, Edit, Trash2, Package, Megaphone, Award, CreditCard, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import AdminGifts from "@/pages/admin/AdminGifts";
import AdminShop from "@/pages/admin/AdminShop";

interface AdminStats {
  users: number;
  profiles: number;
  gameScores: number;
  rankedMatches: number;
  premiumUsers: number;
}

interface User {
  id: string;
  email: string | null;
  nickname: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  createdAt: string | null;
  gemBalance: number | null;
}

interface UserDetails {
  user: User;
  profile: any;
  progression: any;
  inventory: any[];
  recentScores: any[];
  recentMatches: any[];
}

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [editGemBalance, setEditGemBalance] = useState(0);
  
  const { data: adminCheck, isLoading: adminCheckLoading } = useQuery<{ isAdmin: boolean; role: string | null }>({
    queryKey: ["/api/admin/check"],
  });

  const { data: stats, refetch: refetchStats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!adminCheck?.isAdmin,
  });

  const { data: usersData, refetch: refetchUsers } = useQuery<{ users: User[]; pagination: any }>({
    queryKey: ["/api/admin/users", { page: currentPage, search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: !!adminCheck?.isAdmin,
  });

  const { data: scoresData, refetch: refetchScores } = useQuery<{ scores: any[]; pagination: any }>({
    queryKey: ["/api/admin/game-scores", { page: currentPage }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/game-scores?page=${currentPage}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch scores");
      return res.json();
    },
    enabled: !!adminCheck?.isAdmin && activeTab === "scores",
  });

  const { data: matchesData, refetch: refetchMatches } = useQuery<{ matches: any[]; pagination: any }>({
    queryKey: ["/api/admin/ranked-matches", { page: currentPage }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ranked-matches?page=${currentPage}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch matches");
      return res.json();
    },
    enabled: !!adminCheck?.isAdmin && activeTab === "matches",
  });

  const { data: inventoryData, refetch: refetchInventory } = useQuery<{ inventory: any[]; pagination: any }>({
    queryKey: ["/api/admin/inventory", { page: currentPage, username: inventorySearch }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      if (inventorySearch) params.set("username", inventorySearch);
      const res = await fetch(`/api/admin/inventory?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
    enabled: !!adminCheck?.isAdmin && activeTab === "inventory",
  });

  const { data: announcementsData, refetch: refetchAnnouncements } = useQuery<{ announcements: any[]; pagination: any }>({
    queryKey: ["/api/admin/announcements", { page: currentPage, includeInactive: true }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/announcements?page=${currentPage}&includeInactive=true`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch announcements");
      return res.json();
    },
    enabled: !!adminCheck?.isAdmin && activeTab === "announcements",
  });

  const { data: purchasesData, refetch: refetchPurchases } = useQuery<{ purchases: any[]; stats: any; pagination: any }>({
    queryKey: ["/api/admin/purchases", { page: currentPage }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/purchases?page=${currentPage}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch purchases");
      return res.json();
    },
    enabled: !!adminCheck?.isAdmin && activeTab === "purchases",
  });

  const { data: achievementsData, refetch: refetchAchievements } = useQuery<{ achievements: any[]; pagination: any }>({
    queryKey: ["/api/admin/achievements", { page: currentPage }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/achievements?page=${currentPage}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch achievements");
      return res.json();
    },
    enabled: !!adminCheck?.isAdmin && activeTab === "achievements",
  });

  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", titleKo: "", content: "", contentKo: "", type: "info", priority: 0, isPinned: false });
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);

  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/admin/announcements", data),
    onSuccess: () => {
      toast({ title: "Success", description: "Announcement created" });
      refetchAnnouncements();
      setShowAnnouncementDialog(false);
      setNewAnnouncement({ title: "", titleKo: "", content: "", contentKo: "", type: "info", priority: 0, isPinned: false });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/announcements/${id}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Announcement deleted" });
      refetchAnnouncements();
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: any }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}`, updates);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User updated successfully" });
      refetchUsers();
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update user", variant: "destructive" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: any }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/profile`, updates);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Profile updated successfully" });
      refetchUsers();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update profile", variant: "destructive" });
    },
  });

  const fetchUserDetails = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setSelectedUser(data);
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/");
    }
  }, [authLoading, user, setLocation]);

  if (authLoading || adminCheckLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Shield className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
        <Button onClick={() => setLocation("/")} data-testid="button-go-home">Go Home</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Crown className="w-8 h-8 text-yellow-500" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Role: <Badge variant={adminCheck.role === "super_admin" ? "default" : "secondary"}>{adminCheck.role}</Badge>
          </p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-back-to-game">
          Back to Game
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
          <TabsTrigger value="shop" data-testid="tab-shop">Shop Items</TabsTrigger>
          <TabsTrigger value="inventory" data-testid="tab-inventory">Inventory</TabsTrigger>
          <TabsTrigger value="scores" data-testid="tab-scores">Game Scores</TabsTrigger>
          <TabsTrigger value="matches" data-testid="tab-matches">Ranked Matches</TabsTrigger>
          <TabsTrigger value="announcements" data-testid="tab-announcements">Announcements</TabsTrigger>
          <TabsTrigger value="purchases" data-testid="tab-purchases">Payments</TabsTrigger>
          <TabsTrigger value="achievements" data-testid="tab-achievements">Achievements</TabsTrigger>
          <TabsTrigger value="gifts" data-testid="tab-gifts">Send Gift</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.users || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Profiles</CardTitle>
                <Gamepad2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.profiles || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Game Scores</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.gameScores || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ranked Matches</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.rankedMatches || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Premium Users</CardTitle>
                <Crown className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.premiumUsers || 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => { refetchStats(); refetchUsers(); }} data-testid="button-refresh-data">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage all registered users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email, nickname, or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-user-search"
                  />
                </div>
                <Button variant="outline" onClick={() => refetchUsers()} data-testid="button-search-users">
                  <Search className="w-4 h-4" />
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nickname</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(usersData?.users || []).map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-sm">{u.email || "-"}</TableCell>
                      <TableCell>{u.nickname || "-"}</TableCell>
                      <TableCell>{[u.firstName, u.lastName].filter(Boolean).join(" ") || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "super_admin" ? "default" : u.role === "admin" ? "secondary" : "outline"}>
                          {u.role || "user"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => fetchUserDetails(u.id)}
                            data-testid={`button-view-user-${u.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {adminCheck.role === "super_admin" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => { setEditingUser(u); setEditRole(u.role || "user"); setEditGemBalance(u.gemBalance || 0); }}
                              data-testid={`button-edit-user-${u.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {usersData?.pagination && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {usersData.pagination.page} of {usersData.pagination.totalPages} ({usersData.pagination.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= usersData.pagination.totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scores">
          <Card>
            <CardHeader>
              <CardTitle>Game Scores</CardTitle>
              <CardDescription>All game scores across all modes</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Lines</TableHead>
                    <TableHead>Play Time</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(scoresData?.scores || []).map((score) => (
                    <TableRow key={score.id}>
                      <TableCell className="font-mono text-xs">{score.userId}</TableCell>
                      <TableCell><Badge variant="outline">{score.gameMode}</Badge></TableCell>
                      <TableCell className="font-bold">{score.score?.toLocaleString()}</TableCell>
                      <TableCell>{score.level}</TableCell>
                      <TableCell>{score.linesCleared}</TableCell>
                      <TableCell>{Math.floor((score.playTime || 0) / 1000)}s</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {score.createdAt ? new Date(score.createdAt).toLocaleDateString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {scoresData?.pagination && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {scoresData.pagination.page} of {scoresData.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentPage >= scoresData.pagination.totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches">
          <Card>
            <CardHeader>
              <CardTitle>Ranked Matches</CardTitle>
              <CardDescription>All ranked match history</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player A</TableHead>
                    <TableHead>Player B</TableHead>
                    <TableHead>Winner</TableHead>
                    <TableHead>A Score</TableHead>
                    <TableHead>B Score</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(matchesData?.matches || []).map((match) => (
                    <TableRow key={match.id}>
                      <TableCell className="font-mono text-xs">{match.playerAId}</TableCell>
                      <TableCell className="font-mono text-xs">{match.isAiOpponent ? `AI (${match.aiDifficulty})` : match.playerBId}</TableCell>
                      <TableCell>
                        <Badge variant={match.winnerId === match.playerAId ? "default" : "secondary"}>
                          {match.winnerId === match.playerAId ? "A" : "B"}
                        </Badge>
                      </TableCell>
                      <TableCell>{match.playerAScore}</TableCell>
                      <TableCell>{match.playerBScore}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {match.startedAt ? new Date(match.startedAt).toLocaleDateString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {matchesData?.pagination && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {matchesData.pagination.page} of {matchesData.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentPage >= matchesData.pagination.totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shop Items Tab */}
        <TabsContent value="shop">
          <AdminShop isAdmin={!!adminCheck?.isAdmin} />
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                User Inventory
              </CardTitle>
              <CardDescription>All user-owned items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username..."
                    value={inventorySearch}
                    onChange={(e) => {
                      setInventorySearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                    data-testid="input-inventory-search"
                  />
                </div>
                {inventorySearch && (
                  <Button variant="ghost" size="sm" onClick={() => { setInventorySearch(""); setCurrentPage(1); }}>
                    Clear
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Item Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Expires At</TableHead>
                    <TableHead>Purchased</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(inventoryData?.inventory || []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.userProfileImage && (
                            <img src={item.userProfileImage} alt="" className="w-6 h-6 rounded-full" />
                          )}
                          <div className="flex flex-col">
                            <span className="font-medium">{item.username || 'Unknown'}</span>
                            <span className="font-mono text-xs text-muted-foreground">{item.userId?.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{item.itemType}</Badge></TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="text-sm">{item.duration || 'permanent'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.purchasedAt ? new Date(item.purchasedAt).toLocaleDateString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {inventoryData?.pagination && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {inventoryData.pagination.page} of {inventoryData.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentPage >= inventoryData.pagination.totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Announcements Tab */}
        <TabsContent value="announcements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5" />
                  Announcements
                </CardTitle>
                <CardDescription>System announcements and notifications</CardDescription>
              </div>
              <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-announcement">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Announcement
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Announcement</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Title (EN)</Label>
                        <Input value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})} data-testid="input-announcement-title" />
                      </div>
                      <div>
                        <Label>Title (KO)</Label>
                        <Input value={newAnnouncement.titleKo} onChange={(e) => setNewAnnouncement({...newAnnouncement, titleKo: e.target.value})} data-testid="input-announcement-title-ko" />
                      </div>
                    </div>
                    <div>
                      <Label>Content (EN)</Label>
                      <Textarea value={newAnnouncement.content} onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})} data-testid="input-announcement-content" />
                    </div>
                    <div>
                      <Label>Content (KO)</Label>
                      <Textarea value={newAnnouncement.contentKo} onChange={(e) => setNewAnnouncement({...newAnnouncement, contentKo: e.target.value})} data-testid="input-announcement-content-ko" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Type</Label>
                        <Select value={newAnnouncement.type} onValueChange={(v) => setNewAnnouncement({...newAnnouncement, type: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="info">Info</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="event">Event</SelectItem>
                            <SelectItem value="update">Update</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Priority</Label>
                        <Input type="number" value={newAnnouncement.priority} onChange={(e) => setNewAnnouncement({...newAnnouncement, priority: parseInt(e.target.value) || 0})} />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <input type="checkbox" checked={newAnnouncement.isPinned} onChange={(e) => setNewAnnouncement({...newAnnouncement, isPinned: e.target.checked})} />
                        <Label>Pinned</Label>
                      </div>
                    </div>
                    <Button onClick={() => createAnnouncementMutation.mutate(newAnnouncement)} disabled={!newAnnouncement.title || !newAnnouncement.content} data-testid="button-save-announcement">
                      Create Announcement
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(announcementsData?.announcements || []).map((ann) => (
                    <TableRow key={ann.id}>
                      <TableCell className="font-medium">{ann.title}</TableCell>
                      <TableCell>
                        <Badge variant={ann.type === 'warning' ? 'destructive' : ann.type === 'event' ? 'default' : 'secondary'}>
                          {ann.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{ann.priority}</TableCell>
                      <TableCell>
                        <Badge variant={ann.isActive ? 'default' : 'outline'}>
                          {ann.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {ann.isPinned && <Badge variant="secondary" className="ml-1">Pinned</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteAnnouncementMutation.mutate(ann.id)} data-testid={`button-delete-announcement-${ann.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {announcementsData?.pagination && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {announcementsData.pagination.page} of {announcementsData.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentPage >= announcementsData.pagination.totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="purchases">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment History
              </CardTitle>
              <CardDescription>All in-app purchases and transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {purchasesData?.stats && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Total Revenue</div>
                      <div className="text-2xl font-bold">${(purchasesData.stats.totalAmount / 100).toFixed(2)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Total Purchases</div>
                      <div className="text-2xl font-bold">{purchasesData.stats.totalPurchases}</div>
                    </CardContent>
                  </Card>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(purchasesData?.purchases || []).map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-mono text-xs">{purchase.userId.slice(0, 8)}...</TableCell>
                      <TableCell>{purchase.itemType}</TableCell>
                      <TableCell>${(purchase.amount / 100).toFixed(2)} {purchase.currency}</TableCell>
                      <TableCell><Badge variant="outline">{purchase.paymentProvider}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{purchase.paymentId.slice(0, 12)}...</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {purchase.createdAt ? new Date(purchase.createdAt).toLocaleDateString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {purchasesData?.pagination && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {purchasesData.pagination.page} of {purchasesData.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentPage >= purchasesData.pagination.totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                User Achievements
              </CardTitle>
              <CardDescription>Unlocked achievements by users</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Achievement ID</TableHead>
                    <TableHead>Unlocked At</TableHead>
                    <TableHead>Reward Claimed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(achievementsData?.achievements || []).map((ach) => (
                    <TableRow key={ach.id}>
                      <TableCell className="font-mono text-xs">{ach.userId.slice(0, 8)}...</TableCell>
                      <TableCell><Badge variant="outline">{ach.achievementId}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ach.rewardClaimed ? 'default' : 'secondary'}>
                          {ach.rewardClaimed ? 'Claimed' : 'Unclaimed'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {achievementsData?.pagination && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {achievementsData.pagination.page} of {achievementsData.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentPage >= achievementsData.pagination.totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gifts">
          <AdminGifts isAdmin={!!adminCheck?.isAdmin} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Detailed information about this user</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">ID</Label>
                  <p className="font-mono text-sm">{selectedUser.user.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p>{selectedUser.user.email || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Nickname</Label>
                  <p>{selectedUser.user.nickname || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Role</Label>
                  <Badge>{selectedUser.user.role || "user"}</Badge>
                </div>
              </div>

              {selectedUser.profile && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-2 text-sm">
                    <div>High Score: <span className="font-bold">{selectedUser.profile.highScore?.toLocaleString()}</span></div>
                    <div>Games Played: <span className="font-bold">{selectedUser.profile.totalGamesPlayed}</span></div>
                    <div>Lines Cleared: <span className="font-bold">{selectedUser.profile.totalLinesCleared}</span></div>
                    <div>Premium: <Badge variant={selectedUser.profile.isPremium ? "default" : "outline"}>{selectedUser.profile.isPremium ? "Yes" : "No"}</Badge></div>
                    <div>Block Texture: <span className="font-bold">{selectedUser.profile.blockTexture}</span></div>
                    <div>Game Engine: <span className="font-bold">{selectedUser.profile.gameEngine}</span></div>
                  </CardContent>
                </Card>
              )}

              {selectedUser.progression && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Progression</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-2 text-sm">
                    <div>Level: <span className="font-bold">{selectedUser.progression.level}</span></div>
                    <div>XP: <span className="font-bold">{selectedUser.progression.xp?.toLocaleString()}</span></div>
                    <div>Gems: <span className="font-bold">{selectedUser.progression.gemBalance?.toLocaleString()}</span></div>
                    <div>Rank: <span className="font-bold">{selectedUser.progression.rankTier} {selectedUser.progression.rankDivision}</span></div>
                    <div>Wins: <span className="font-bold">{selectedUser.progression.rankedWins}</span></div>
                    <div>Losses: <span className="font-bold">{selectedUser.progression.rankedLosses}</span></div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Modify user settings for {editingUser?.email || editingUser?.nickname}</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div>
                <Label>Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger data-testid="select-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gem Balance</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={editGemBalance}
                    onChange={(e) => setEditGemBalance(Number(e.target.value))}
                    className="flex-1"
                    data-testid="input-gem-balance"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updateProfileMutation.mutate({ 
                        userId: editingUser.id, 
                        updates: { gemBalance: editGemBalance } 
                      });
                    }}
                    disabled={updateProfileMutation.isPending || editGemBalance === editingUser.gemBalance}
                    data-testid="button-save-gems"
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Apply"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Current: {editingUser.gemBalance?.toLocaleString() || 0} Gem
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingUser(null)} data-testid="button-cancel-edit">Cancel</Button>
                <Button
                  onClick={() => updateUserMutation.mutate({ userId: editingUser.id, updates: { role: editRole } })}
                  disabled={updateUserMutation.isPending || editRole === editingUser.role}
                  data-testid="button-save-role"
                >
                  {updateUserMutation.isPending ? "Saving..." : "Save Role"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
