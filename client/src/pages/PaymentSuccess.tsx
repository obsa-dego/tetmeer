import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { CheckCircle, XCircle, Loader2, ArrowRight, Crown } from 'lucide-react';
import { useNavigation } from '@/contexts/NavigationContext';
import { useTranslation } from 'react-i18next';

export default function PaymentSuccess() {
  const { navigateTo } = useNavigation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const verifyPayment = async () => {
      const params = new URLSearchParams(window.location.search);
      const checkoutId = params.get('checkout_id');
      const itemType = params.get('item_type') || 'premium';

      if (!checkoutId) {
        setStatus('error');
        setErrorMessage('Missing checkout ID');
        return;
      }

      try {
        const response = await apiRequest('POST', '/api/polar/verify', {
          checkoutId,
          itemType,
        });

        const data = await response.json();

        if (data.success) {
          setStatus('success');
          setResult(data);
          queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
          queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
          toast({
            title: t('payment.success', 'Payment Successful!'),
            description: data.type === 'premium' 
              ? t('payment.premiumActivated', 'Premium has been activated!') 
              : t('payment.itemAdded', 'Item added to inventory ({{count}} total)', { count: data.quantity }),
          });
        } else {
          setStatus('error');
          setErrorMessage(data.message || 'Payment verification failed');
        }
      } catch (error: any) {
        console.error('Payment verification error:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Failed to verify payment');
      }
    };

    verifyPayment();
  }, [toast]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 pt-24 pb-8 flex items-center justify-center">
        <div className="container mx-auto px-4 max-w-md">
          <Card className="p-8 bg-black/70 backdrop-blur-sm border-zinc-700 text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
                <h2 className="text-xl font-semibold mb-2">{t('payment.verifying', 'Verifying Payment...')}</h2>
                <p className="text-muted-foreground">{t('payment.pleaseWait', 'Please wait while we confirm your purchase')}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-xl font-semibold mb-2">{t('payment.success', 'Payment Successful!')}</h2>
                <p className="text-muted-foreground mb-6">
                  {result?.type === 'premium' 
                    ? t('payment.welcomePremium', 'Welcome to Premium! Enjoy all the exclusive features.') 
                    : t('payment.itemAddedDesc', 'Your item has been added to inventory. You now have {{count}} item(s).', { count: result?.quantity || 1 })}
                </p>
                
                <div className="space-y-3">
                  <Button className="w-full" data-testid="button-go-to-account" onClick={() => navigateTo('account')}>
                    <Crown className="w-4 h-4 mr-2" />
                    {t('payment.viewAccount', 'View Account')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  
                  <Button variant="outline" className="w-full" data-testid="button-play-now" onClick={() => navigateTo('game')}>
                    {t('payment.playNow', 'Play Now')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold mb-2">{t('payment.verificationFailed', 'Payment Verification Failed')}</h2>
                <p className="text-muted-foreground mb-6">
                  {errorMessage || t('payment.verificationFailedDesc', 'We could not verify your payment. Please contact support if you were charged.')}
                </p>
                
                <div className="space-y-3">
                  <Button variant="outline" className="w-full" data-testid="button-back-to-account" onClick={() => navigateTo('account')}>
                    {t('payment.backToAccount', 'Back to Account')}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
