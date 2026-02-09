import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { BlockTexture, blockTextureEnum } from "@shared/schema";
import { soundManager } from "@/lib/sound-manager";
import { Settings, Sparkles, Trees, Box } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedTexture, setSelectedTexture] = useState<BlockTexture>("default");
  
  const textureOptions: { value: BlockTexture; labelKey: string; descKey: string; icon: typeof Box }[] = [
    { 
      value: "default", 
      labelKey: "settings.default", 
      descKey: "settings.defaultDesc",
      icon: Box
    },
    { 
      value: "metallic", 
      labelKey: "settings.metallic", 
      descKey: "settings.metallicDesc",
      icon: Sparkles
    },
    { 
      value: "wood", 
      labelKey: "settings.wood", 
      descKey: "settings.woodDesc",
      icon: Trees
    },
  ];

  const { data: settings, isLoading } = useQuery<{ blockTexture: BlockTexture }>({
    queryKey: ["/api/settings"],
    enabled: open,
  });

  useEffect(() => {
    if (settings?.blockTexture) {
      setSelectedTexture(settings.blockTexture);
    }
  }, [settings]);

  const updateSettings = useMutation({
    mutationFn: async (blockTexture: BlockTexture) => {
      const response = await apiRequest("PATCH", "/api/settings", { blockTexture });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: t('settings.settingsSaved'),
        description: t('settings.textureUpdated'),
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('common.failedToSave'),
        variant: "destructive",
      });
    },
  });

  const handleTextureChange = (value: BlockTexture) => {
    setSelectedTexture(value);
    soundManager.playBlockPlace(value);
  };

  const handleSave = () => {
    updateSettings.mutate(selectedTexture);
  };

  const handlePreviewSound = (texture: BlockTexture, type: 'place' | 'clear') => {
    if (type === 'place') {
      soundManager.playBlockPlace(texture);
    } else {
      soundManager.playLineClear(texture);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-lg border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Settings className="w-5 h-5" />
            {t('settings.gameSettings')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-base font-medium">{t('settings.blockTexture')}</Label>
            <RadioGroup
              value={selectedTexture}
              onValueChange={(value) => handleTextureChange(value as BlockTexture)}
              className="space-y-3"
            >
              {textureOptions.map((option) => (
                <div
                  key={option.value}
                  className={`flex items-center space-x-3 p-4 rounded-lg border transition-all cursor-pointer hover-elevate ${
                    selectedTexture === option.value
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-background/50"
                  }`}
                  onClick={() => handleTextureChange(option.value)}
                  data-testid={`texture-option-${option.value}`}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <option.icon className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <Label htmlFor={option.value} className="font-medium cursor-pointer">
                      {t(option.labelKey)}
                    </Label>
                    <p className="text-sm text-muted-foreground">{t(option.descKey)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewSound(option.value, 'place');
                      }}
                      data-testid={`preview-place-${option.value}`}
                    >
                      {t('settings.drop')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewSound(option.value, 'clear');
                      }}
                      data-testid={`preview-clear-${option.value}`}
                    >
                      {t('settings.clear')}
                    </Button>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-settings">
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateSettings.isPending}
            data-testid="button-save-settings"
          >
            {updateSettings.isPending ? t('settings.saving') : t('settings.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
