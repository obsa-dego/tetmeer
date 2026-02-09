import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { loginWithGoogle } from '@/lib/auth-utils';
import PolarCheckout from '@/components/PolarCheckout';
import { useNavigation } from '@/contexts/NavigationContext';
import { useTranslation } from 'react-i18next';
import { 
  Crown, 
  Zap, 
  Shield, 
  Palette, 
  BarChart3,
  ArrowRight,
  Check,
} from 'lucide-react';

const PREMIUM_PRICE = '4.99';
const POLAR_PREMIUM_PRODUCT_ID = import.meta.env.VITE_POLAR_PREMIUM_PRODUCT_ID || '';

export default function Premium() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { navigateTo } = useNavigation();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigateTo('landing');
    }
  }, [authLoading, isAuthenticated, navigateTo]);

  const { data: profile } = useQuery<{ isPremium: boolean }>({
    queryKey: ['/api/profile'],
    enabled: isAuthenticated,
  });

  const features = [
    { icon: <Zap className="w-5 h-5" />, text: t('premium.adFree') },
    { icon: <Palette className="w-5 h-5" />, text: t('premium.exclusiveThemes') },
    { icon: <BarChart3 className="w-5 h-5" />, text: t('premium.advancedStats') },
    { icon: <Shield className="w-5 h-5" />, text: t('premium.prioritySupport') },
    { icon: <Crown className="w-5 h-5" />, text: t('premium.leaderboardBadge') },
  ];

  if (profile?.isPremium) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pt-24 pb-8">
          <div className="container mx-auto px-4 max-w-2xl">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-500/25">
                <Crown className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-display font-bold mb-4">{t('premium.alreadyPremium')}</h1>
              <p className="text-muted-foreground mb-6">
                {t('premium.thanksSupport')}
              </p>
              <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-4 py-2">
                <Crown className="w-4 h-4 mr-2" />
                {t('premium.premiumMember')}
              </Badge>
            </div>
            
            <Card className="p-6 bg-black/70 backdrop-blur-sm border-zinc-700 mb-6">
              <h3 className="text-lg font-semibold mb-4">{t('premium.benefits')}</h3>
              <ul className="space-y-3">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Check className="w-4 h-4" />
                    </div>
                    <span className="text-muted-foreground">{feature.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
            
            <div className="text-center">
              <Button 
                variant="outline" 
                data-testid="button-manage-subscription"
                onClick={() => navigateTo('account')}
              >
                {t('premium.manageSubscription')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 pt-24 pb-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-500/25">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-display font-bold mb-4">
              {t('premium.title')}
            </h1>
            <p className="text-xl text-muted-foreground max-w-md mx-auto">
              {t('premium.tagline')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="p-6 bg-black/70 backdrop-blur-sm border-zinc-700">
              <h3 className="text-lg font-semibold mb-6">{t('premium.features')}</h3>
              <ul className="space-y-4">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {feature.icon}
                    </div>
                    <span>{feature.text}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="space-y-4">
              <Card className="p-6 bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/20">
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div>
                    <h4 className="text-xl font-semibold">{t('premium.productName')}</h4>
                    <p className="text-sm text-muted-foreground">{t('premium.monthlySubscription')}</p>
                  </div>
                  <Badge variant="secondary">{t('premium.popular')}</Badge>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold">${PREMIUM_PRICE}</span>
                  <span className="text-muted-foreground">/{t('common.month')}</span>
                </div>
                
                {!isAuthenticated ? (
                  <Button 
                    size="lg" 
                    className="w-full"
                    onClick={() => loginWithGoogle()}
                    data-testid="button-login-premium"
                  >
                    {t('premium.loginToSubscribe')}
                  </Button>
                ) : POLAR_PREMIUM_PRODUCT_ID ? (
                  <PolarCheckout
                    productId={POLAR_PREMIUM_PRODUCT_ID}
                    itemType="premium"
                    buttonText={t('premium.subscribeNow')}
                  />
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>{t('premium.paymentSetup')}</p>
                  </div>
                )}
              </Card>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>{t('premium.securePayment')}</p>
            <p className="mt-1">{t('premium.cancelAnytime')}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
