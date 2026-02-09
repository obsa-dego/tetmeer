import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PolarCheckoutProps {
  productId: string;
  itemType: string;
  buttonText?: string;
  onSuccess?: () => void;
  onError?: (error: any) => void;
  className?: string;
}

export default function PolarCheckout({
  productId,
  itemType,
  buttonText = "Purchase",
  onSuccess,
  onError,
  className,
}: PolarCheckoutProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest("POST", "/api/polar/checkout", {
        productId,
        itemType,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create checkout");
      }

      const { checkoutUrl } = await response.json();

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (e: any) {
      console.error("Checkout error:", e);
      setError(e.message || "Failed to start checkout");
      setIsLoading(false);
      if (onError) {
        onError(e);
      }
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      <Button
        onClick={handleCheckout}
        disabled={isLoading}
        className={className || "w-full"}
        data-testid="button-polar-checkout"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            {buttonText}
            <ExternalLink className="w-3 h-3 ml-2" />
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Secure payment powered by Polar
      </p>
    </div>
  );
}
