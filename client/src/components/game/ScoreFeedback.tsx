import { useEffect, useState } from 'react';
import { ScoreActionType } from '@/lib/game-engine';
import { useTranslation } from 'react-i18next';

interface ScoreFeedbackProps {
  actionType: ScoreActionType;
  scoreGain: number;
  combo: number;
  wasB2BApplied: boolean;
  backToBack: number;
  isPerfectClear: boolean;
}

interface FeedbackItem {
  id: number;
  text: string;
  color: string;
  size: 'large' | 'medium' | 'small';
  delay: number;
}

let feedbackIdCounter = 0;

export function ScoreFeedback({ actionType, scoreGain, combo, wasB2BApplied, backToBack, isPerfectClear }: ScoreFeedbackProps) {
  const { t } = useTranslation();
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);

  useEffect(() => {
    if (!actionType && !isPerfectClear) return;

    const newItems: FeedbackItem[] = [];
    let delay = 0;

    // Main action label
    if (actionType) {
      const actionLabels: Record<string, { text: string; color: string }> = {
        'single': { text: 'SINGLE', color: 'text-white' },
        'double': { text: 'DOUBLE', color: 'text-blue-400' },
        'triple': { text: 'TRIPLE', color: 'text-purple-400' },
        'tetris': { text: 'TETRIS', color: 'text-cyan-400' },
        'tspin': { text: 'T-SPIN', color: 'text-orange-400' },
        'tspin_mini': { text: 'T-SPIN MINI', color: 'text-yellow-400' },
        'tspin_single': { text: 'T-SPIN SINGLE', color: 'text-orange-400' },
        'tspin_double': { text: 'T-SPIN DOUBLE', color: 'text-red-400' },
        'tspin_triple': { text: 'T-SPIN TRIPLE', color: 'text-red-500' },
      };

      const action = actionLabels[actionType];
      if (action) {
        newItems.push({
          id: ++feedbackIdCounter,
          text: action.text,
          color: action.color,
          size: 'large',
          delay,
        });
        delay += 100;
      }
    }

    // Back-to-Back label (only if B2B bonus was actually applied)
    if (wasB2BApplied) {
      newItems.push({
        id: ++feedbackIdCounter,
        text: `BACK-TO-BACK`,
        color: 'text-pink-400',
        size: 'medium',
        delay,
      });
      delay += 100;
    }

    // Combo label (if combo > 1)
    if (combo > 1) {
      newItems.push({
        id: ++feedbackIdCounter,
        text: `${combo} COMBO`,
        color: 'text-green-400',
        size: 'medium',
        delay,
      });
      delay += 100;
    }

    // Perfect Clear (special effect - show separately from action type)
    if (isPerfectClear) {
      newItems.push({
        id: ++feedbackIdCounter,
        text: 'PERFECT CLEAR',
        color: 'text-yellow-300',
        size: 'large',
        delay,
      });
      delay += 100;
    }

    // Score gain
    if (scoreGain > 0) {
      newItems.push({
        id: ++feedbackIdCounter,
        text: `+${scoreGain.toLocaleString()}`,
        color: 'text-white/80',
        size: 'small',
        delay,
      });
    }

    setFeedbackItems(prev => [...prev, ...newItems]);

    // Clear items after animation completes
    const timeout = setTimeout(() => {
      setFeedbackItems(prev => prev.filter(item => !newItems.some(ni => ni.id === item.id)));
    }, 2000);

    return () => clearTimeout(timeout);
  }, [actionType, scoreGain, combo, wasB2BApplied, backToBack, isPerfectClear]);

  if (feedbackItems.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-50">
      {feedbackItems.map((item, index) => (
        <div
          key={item.id}
          className={`
            ${item.color}
            ${item.size === 'large' ? 'text-3xl font-black' : item.size === 'medium' ? 'text-xl font-bold' : 'text-lg font-semibold'}
            animate-score-popup
            drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]
          `}
          style={{
            animationDelay: `${item.delay}ms`,
            textShadow: '0 0 10px currentColor, 0 0 20px currentColor',
          }}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
}
