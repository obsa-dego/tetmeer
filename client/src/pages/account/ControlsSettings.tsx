import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Check, Loader2, MoveHorizontal, MoveVertical,
  MousePointerClick, ZoomIn, RotateCcw,
} from 'lucide-react';

interface ControlsSettingsProps {
  settings: {
    invertX?: boolean;
    invertY?: boolean;
    mouseSensitivity?: number;
    wheelSensitivity?: number;
  } | undefined;
  onBack: () => void;
  onSaved: () => void;
}

export function ControlsSettings({ settings, onBack, onSaved }: ControlsSettingsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [editInvertX, setEditInvertX] = useState(false);
  const [editInvertY, setEditInvertY] = useState(false);
  const [editMouseSensitivity, setEditMouseSensitivity] = useState(50);
  const [editWheelSensitivity, setEditWheelSensitivity] = useState(50);

  useEffect(() => {
    if (settings) {
      setEditInvertX(settings.invertX ?? false);
      setEditInvertY(settings.invertY ?? false);
      setEditMouseSensitivity(settings.mouseSensitivity ?? 50);
      setEditWheelSensitivity(settings.wheelSensitivity ?? 50);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await apiRequest('PATCH', '/api/settings', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({ title: t('settings.saved', 'Settings saved'), description: t('settings.controlsSaved', 'Control settings updated') });
      onSaved();
    },
    onError: () => {
      toast({ title: t('common.error'), description: t('settings.saveFailed'), variant: 'destructive' });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      invertX: editInvertX,
      invertY: editInvertY,
      mouseSensitivity: editMouseSensitivity,
      wheelSensitivity: editWheelSensitivity,
    });
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-controls">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold">{t('settings.controlSettings', 'Controls')}</h2>
        </div>
        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-controls">
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
          {t('common.save', 'Save')}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MoveHorizontal className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">{t('settings.invertX', 'Invert X Axis')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.invertXDesc', 'Reverse horizontal rotation')}</p>
              </div>
            </div>
            <Switch checked={editInvertX} onCheckedChange={setEditInvertX} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MoveVertical className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">{t('settings.invertY', 'Invert Y Axis')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.invertYDesc', 'Reverse vertical rotation')}</p>
              </div>
            </div>
            <Switch checked={editInvertY} onCheckedChange={setEditInvertY} />
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <MousePointerClick className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <Label className="text-sm font-medium">{t('settings.mouseSensitivity', 'Mouse Sensitivity')}</Label>
                <p className="text-xs text-muted-foreground">{editMouseSensitivity}%</p>
              </div>
            </div>
            <Slider value={[editMouseSensitivity]} onValueChange={(v) => setEditMouseSensitivity(v[0])} min={10} max={100} step={5} />
          </div>

          <div>
            <div className="flex items-center gap-3 mb-2">
              <ZoomIn className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <Label className="text-sm font-medium">{t('settings.wheelSensitivity', 'Wheel Sensitivity')}</Label>
                <p className="text-xs text-muted-foreground">{editWheelSensitivity}%</p>
              </div>
            </div>
            <Slider value={[editWheelSensitivity]} onValueChange={(v) => setEditWheelSensitivity(v[0])} min={10} max={100} step={5} />
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={() => { setEditInvertX(false); setEditInvertY(false); setEditMouseSensitivity(50); setEditWheelSensitivity(50); }}>
          <RotateCcw className="w-4 h-4 mr-2" />
          {t('settings.resetDefaults', 'Reset to Defaults')}
        </Button>
      </div>
    </div>
  );
}
