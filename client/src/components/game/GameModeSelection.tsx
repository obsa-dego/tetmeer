import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useNavigation } from '@/contexts/NavigationContext';
import { 
  GameMode, 
  GameDifficulty,
  GAME_MODE_CONFIGS 
} from '@/lib/game-engine';
import { 
  Trophy, Flame, Zap, Infinity as InfinityIcon, 
  Shovel, Heart, EyeOff, Target, Crown, Star, Loader2, Search, X, Activity
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CATEGORIES = ['marathon', 'sprint', 'ultra', 'zen', 'test-match'] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_MODES: Record<Category, GameMode[]> = {
  marathon: ['marathon'],
  sprint: ['sprint'],
  ultra: ['ultra'],
  zen: ['zen'],
  'test-match': [],
};

const MODE_ICONS: Record<GameMode, any> = {
  marathon: Trophy,
  sprint: Zap,
  ultra: Flame,
  zen: InfinityIcon,
  dig: Shovel, // Keep defined for type safety but won't be used
  survival: Heart,
  invisible: EyeOff,
  zone: Target,
  master: Crown,
};

const MODE_COLORS: Record<GameMode, string> = {
  marathon: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  sprint: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30',
  ultra: 'from-red-500/20 to-pink-500/20 border-red-500/30',
  zen: 'from-purple-500/20 to-violet-500/20 border-purple-500/30',
  dig: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30',
  survival: 'from-rose-500/20 to-red-500/20 border-rose-500/30',
  invisible: 'from-gray-500/20 to-slate-500/20 border-gray-500/30',
  zone: 'from-cyan-500/20 to-teal-500/20 border-cyan-500/30',
  master: 'from-gold-500/20 to-yellow-500/20 border-yellow-500/30',
};

type MatchmakingStatus = 'idle' | 'connecting' | 'queuing' | 'match_found' | 'in_match' | 'error';

interface GameModeSelectionProps {
  onSelectMode: (mode: GameMode, difficulty?: GameDifficulty) => void;
  gameType?: 'single' | 'multi';
  matchmakingStatus?: MatchmakingStatus;
  matchmakingQueueTime?: number;
  onJoinQueue?: (mode: GameMode) => void;
  onLeaveQueue?: () => void;
}

export function GameModeSelection({ 
  onSelectMode,
  gameType = 'single',
  matchmakingStatus = 'idle',
  matchmakingQueueTime = 0,
  onJoinQueue,
  onLeaveQueue,
}: GameModeSelectionProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { navigateTo } = useNavigation();
  const [activeCategory, setActiveCategory] = useState<Category>('marathon');
  const [selectedMode, setSelectedMode] = useState<GameMode>('marathon');
  const [selectedDifficulty, setSelectedDifficulty] = useState<GameDifficulty>('normal');

  const { data: scores } = useQuery<any[]>({
    queryKey: ['/api/scores/me'],
    enabled: isAuthenticated,
  });

  const personalBest = scores
    ? scores
        .filter((s: any) => s.mode === selectedMode)
        .sort((a: any, b: any) => b.score - a.score)[0]
    : null;

  const modes = CATEGORY_MODES[activeCategory];

  useEffect(() => {
    if (modes.length > 0 && !modes.includes(selectedMode)) {
      setSelectedMode(modes[0]);
    }
  }, [activeCategory, modes, selectedMode]);

  useEffect(() => {
    const config = GAME_MODE_CONFIGS[selectedMode];
    if (config.hasDifficulty && config.difficulties) {
      setSelectedDifficulty(config.difficulties[1] || config.difficulties[0]);
    }
  }, [selectedMode]);

  const handleSelectAndPlay = () => {
    const config = GAME_MODE_CONFIGS[selectedMode];
    if (config.hasDifficulty) {
      onSelectMode(selectedMode, selectedDifficulty);
    } else {
      onSelectMode(selectedMode);
    }
  };

  const getModeTranslation = (mode: GameMode) => {
    const modeKey = `modes.${mode}` as const;
    const descKey = `modes.${mode}Desc` as const;
    return {
      name: t(modeKey),
      description: t(descKey),
    };
  };

  const getDifficultyTranslation = (diff: GameDifficulty) => t(`difficulty.${diff}`);

  const activeModeDetails = getModeTranslation(selectedMode);
  const currentConfig = GAME_MODE_CONFIGS[selectedMode];

  return (
    <div className="w-full h-full flex flex-col gap-6 relative">
      <div className="flex-1 flex gap-6 pt-0">
        {/* Main Selection Area */}
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-3xl font-display font-black tracking-tighter uppercase text-white/90">
                {activeModeDetails.name}
              </h2>
            </div>

            {/* Category Tabs - Moved here */}
            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    if (category === 'test-match') {
                      navigateTo('test-match');
                      return;
                    }
                    setActiveCategory(category);
                    setSelectedMode(category as GameMode);
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                    activeCategory === category
                      ? 'bg-primary text-primary-foreground shadow-lg'
                      : category === 'test-match'
                        ? 'text-cyan-400 hover:text-cyan-300'
                        : 'text-muted-foreground hover:text-white'
                  }`}
                  data-testid={`button-category-${category}`}
                >
                  {category === 'test-match' && <Activity className="w-3 h-3" />}
                  {category === 'test-match' 
                    ? t('modes.testMatch', 'Test Match')
                    : t(`modes.${category}`, category.toUpperCase())
                  }
                </button>
              ))}
            </div>
          </div>

          <p className="text-base text-white/60 leading-relaxed w-full line-clamp-3">
            {activeModeDetails.description}
          </p>

          <div className="w-full h-px bg-white/10 my-2" />

          {/* Mode-specific details */}
          <div className="flex flex-col gap-1.5">
            {selectedMode === 'marathon' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 w-16">{t('modeDetails.goal')}</span>
                  <span className="text-sm text-white/70">{t('modeDetails.marathonGoal')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 w-16">{t('modeDetails.speed')}</span>
                  <span className="text-sm text-white/70">{t('modeDetails.marathonSpeed')}</span>
                </div>
              </>
            )}
            {selectedMode === 'sprint' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 w-16">{t('modeDetails.goal')}</span>
                  <span className="text-sm text-white/70">{t('modeDetails.sprintGoal')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 w-16"></span>
                  <span className="text-sm text-white/70">{t('modeDetails.sprintRecord')}</span>
                </div>
              </>
            )}
            {selectedMode === 'ultra' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 w-16">{t('modeDetails.timeLimit')}</span>
                  <span className="text-sm text-white/70">{t('modeDetails.ultraTimeLimit')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 w-16">{t('modeDetails.goal')}</span>
                  <span className="text-sm text-white/70">{t('modeDetails.ultraGoal')}</span>
                </div>
              </>
            )}
            {selectedMode === 'zen' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 w-16">{t('modeDetails.limit')}</span>
                  <span className="text-sm text-white/70">{t('modeDetails.zenNoLimit')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 w-16"></span>
                  <span className="text-sm text-white/70">{t('modeDetails.zenRelax')}</span>
                </div>
              </>
            )}
          </div>

          {currentConfig.hasDifficulty && currentConfig.difficulties && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('game.difficulty')}</span>
              <div className="flex gap-1.5">
                {currentConfig.difficulties.map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setSelectedDifficulty(diff)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      selectedDifficulty === diff
                        ? 'bg-white text-black border-white'
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {getDifficultyTranslation(diff)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto flex items-end justify-between">
            <div className="flex flex-col gap-0.5">
              {gameType === 'multi' && (matchmakingStatus === 'queuing' || matchmakingStatus === 'connecting') ? (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">{t('matchmaking.searching', '상대 검색 중...')}</span>
                  <span className="font-mono text-sm text-primary font-bold">
                    {Math.floor(matchmakingQueueTime / 60)}:{(matchmakingQueueTime % 60).toString().padStart(2, '0')}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">{t('stats.personalBest')}</span>
                  <span className="font-mono text-sm text-primary font-bold">
                    {isAuthenticated 
                      ? (personalBest ? personalBest.score.toLocaleString() : t('common.noRecord', 'No record yet'))
                      : t('auth.loginRequiredForStats', 'Login to track your best score')
                    }
                  </span>
                </>
              )}
            </div>

            {gameType === 'single' ? (
              <Button
                size="lg"
                onClick={handleSelectAndPlay}
                className="rounded-full px-10 py-6 text-base font-black uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 shadow-xl"
                data-testid="button-start-game"
              >
                {t('game.startGame')}
              </Button>
            ) : (
              matchmakingStatus === 'queuing' || matchmakingStatus === 'connecting' ? (
                <Button
                  size="lg"
                  onClick={onLeaveQueue}
                  className="rounded-full px-10 py-6 text-base font-black uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white border border-red-500/30 shadow-xl gap-2"
                  data-testid="button-cancel-match"
                >
                  <X className="w-5 h-5" />
                  {t('matchmaking.cancel', '취소')}
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => onJoinQueue?.(selectedMode)}
                  className="rounded-full px-10 py-6 text-base font-black uppercase tracking-wider bg-primary hover:bg-primary/90 text-white border border-primary/30 shadow-xl gap-2"
                  data-testid="button-find-match"
                >
                  <Search className="w-5 h-5" />
                  {t('matchmaking.findMatch', '매치 찾기')}
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
