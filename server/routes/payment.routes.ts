import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { createPolarCheckout, verifyPolarCheckout, listPolarProducts, isPolarAvailable, getCustomerSubscriptions, cancelSubscription, reactivateSubscription, createCustomerPortalSession, getCustomerIdByEmail } from "../polar";

export function registerPaymentRoutes(app: Express): void {
  app.get("/api/polar/setup", async (_req, res) => {
    res.json({ configured: isPolarAvailable() });
  });

  app.get("/api/polar/products", async (_req, res) => {
    try {
      const products = await listPolarProducts();
      res.json({ products });
    } catch (error) {
      console.error("Error fetching Polar products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/polar/checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { productId, itemType } = req.body;

      if (!productId) {
        return res.status(400).json({ error: "Product ID is required" });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const successUrl = `${baseUrl}/payment/success?checkout_id={CHECKOUT_ID}&item_type=${itemType || 'item'}`;

      const result = await createPolarCheckout(
        productId,
        successUrl,
        userId,
        user?.email || undefined
      );

      if (!result) {
        return res.status(500).json({ error: "Failed to create checkout session" });
      }

      res.json({
        checkoutUrl: result.checkoutUrl,
        checkoutId: result.checkoutId
      });
    } catch (error) {
      console.error("Error creating Polar checkout:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/polar/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { checkoutId, itemType } = req.body;

      if (!checkoutId) {
        return res.status(400).json({ success: false, message: "Checkout ID is required" });
      }

      const isUsed = await storage.isPaymentIdUsed(checkoutId);
      if (isUsed) {
        console.warn(`Duplicate payment attempt detected: ${checkoutId} by user ${userId}`);
        return res.status(400).json({
          success: false,
          message: "This payment has already been processed."
        });
      }

      const verification = await verifyPolarCheckout(checkoutId);

      if (!verification.verified) {
        console.error("Polar verification failed:", verification);
        return res.status(400).json({
          success: false,
          message: "Payment verification failed.",
          details: verification.error
        });
      }

      if (verification.userId !== userId) {
        console.warn(`User mismatch for checkout ${checkoutId}: expected ${userId}, got ${verification.userId}`);
        return res.status(400).json({
          success: false,
          message: "This payment was created for a different user account"
        });
      }

      const resolvedItemType = itemType || 'remove_bottom_row';

      const purchase = await storage.recordItemPurchase({
        userId,
        itemType: resolvedItemType,
        amount: 99,
        currency: 'USD',
        paymentProvider: 'polar',
        paymentId: checkoutId,
      });

      if (!purchase) {
        console.warn(`Race condition: payment ${checkoutId} already recorded`);
        return res.status(400).json({
          success: false,
          message: "This payment has already been processed."
        });
      }

      if (resolvedItemType === 'premium' || resolvedItemType === 'premium_lifetime') {
        await storage.setPremiumStatus(userId, true);
        res.json({ success: true, message: 'Premium purchased successfully', type: 'premium' });
      } else {
        await storage.addInventoryItem(userId, resolvedItemType, 1);
        const inventory = await storage.getInventoryItem(userId, resolvedItemType);
        res.json({
          success: true,
          message: 'Item purchased and added to inventory',
          quantity: inventory?.quantity || 1,
          type: 'item'
        });
      }
    } catch (error) {
      console.error("Error verifying Polar checkout:", error);
      res.status(500).json({ success: false, message: "Failed to verify payment" });
    }
  });

  app.get("/api/subscription/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.email) {
        return res.json({ subscriptions: [], hasActiveSubscription: false });
      }

      const subscriptions = await getCustomerSubscriptions(user.email);

      res.json({
        subscriptions: subscriptions.map((sub: any) => ({
          id: sub.id,
          status: sub.status,
          productId: sub.productId,
          productName: sub.product?.name || 'Premium',
          amount: sub.amount,
          currency: sub.currency,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        })),
        hasActiveSubscription: subscriptions.length > 0,
      });
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });

  app.post("/api/subscription/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { subscriptionId } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ success: false, message: "Subscription ID is required" });
      }

      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(400).json({ success: false, message: "User not found" });
      }

      const subscriptions = await getCustomerSubscriptions(user.email);
      const subscription = subscriptions.find((sub: any) => sub.id === subscriptionId);

      if (!subscription) {
        return res.status(403).json({ success: false, message: "Subscription not found or not owned by user" });
      }

      const result = await cancelSubscription(subscriptionId);

      if (result.success) {
        res.json({ success: true, message: "Subscription will be cancelled at the end of the billing period" });
      } else {
        res.status(500).json({ success: false, message: result.error || "Failed to cancel subscription" });
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ success: false, message: "Failed to cancel subscription" });
    }
  });

  app.post("/api/subscription/reactivate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { subscriptionId } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ success: false, message: "Subscription ID is required" });
      }

      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(400).json({ success: false, message: "User not found" });
      }

      const subscriptions = await getCustomerSubscriptions(user.email);
      const subscription = subscriptions.find((sub: any) => sub.id === subscriptionId);

      if (!subscription) {
        return res.status(403).json({ success: false, message: "Subscription not found or not owned by user" });
      }

      const result = await reactivateSubscription(subscriptionId);

      if (result.success) {
        res.json({ success: true, message: "Subscription reactivated successfully" });
      } else {
        res.status(500).json({ success: false, message: result.error || "Failed to reactivate subscription" });
      }
    } catch (error) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ success: false, message: "Failed to reactivate subscription" });
    }
  });

  app.get("/api/billing/portal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.email) {
        return res.status(400).json({ success: false, message: "User not found" });
      }

      const customerId = await getCustomerIdByEmail(user.email);

      if (!customerId) {
        return res.status(404).json({ success: false, message: "No billing account found" });
      }

      const portalUrl = await createCustomerPortalSession(customerId);

      if (portalUrl) {
        res.json({ success: true, url: portalUrl });
      } else {
        res.status(500).json({ success: false, message: "Failed to create billing portal session" });
      }
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ success: false, message: "Failed to access billing portal" });
    }
  });
}
