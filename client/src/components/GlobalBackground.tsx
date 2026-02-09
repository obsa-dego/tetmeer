import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { UserProfile } from "@shared/schema";

export function GlobalBackground() {
  const { isAuthenticated } = useAuth();
  
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['/api/profile'],
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  if (!profile?.backgroundImage) {
    return null;
  }

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <img 
        src={profile.backgroundImage} 
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/90" />
      <div className="absolute inset-0 bg-black/30" />
    </div>
  );
}
