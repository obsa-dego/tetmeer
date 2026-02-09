interface AdBannerProps {
  className?: string;
}

export function AdBanner({ className = '' }: AdBannerProps) {
  return (
    <div 
      className={`h-20 w-full bg-black/40 backdrop-blur-sm border-t border-white/10 flex items-center justify-center ${className}`}
      data-testid="ad-banner"
    >
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
          Advertisement
        </span>
        <div className="px-6 py-2 rounded-lg bg-white/5 border border-white/10">
          <span className="text-sm text-muted-foreground">
            Your ad could be here
          </span>
        </div>
      </div>
    </div>
  );
}
