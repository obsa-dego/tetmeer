import { Polar } from "@polar-sh/sdk";

const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN;

const isPolarConfigured = !!POLAR_ACCESS_TOKEN;

let polarClient: Polar | null = null;

if (isPolarConfigured) {
  polarClient = new Polar({
    accessToken: POLAR_ACCESS_TOKEN!,
    server: "production",
  });
}

export function isPolarAvailable(): boolean {
  return isPolarConfigured;
}

export async function createPolarCheckout(
  productId: string,
  successUrl: string,
  userId: string,
  userEmail?: string
): Promise<{ checkoutUrl: string; checkoutId: string } | null> {
  if (!polarClient) {
    console.error("Polar is not configured");
    return null;
  }

  try {
    const checkout = await polarClient.checkouts.create({
      products: [productId],
      successUrl,
      customerEmail: userEmail,
      metadata: {
        userId,
      },
    });

    return {
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
    };
  } catch (error) {
    console.error("Failed to create Polar checkout:", error);
    return null;
  }
}

export async function verifyPolarCheckout(checkoutId: string): Promise<{
  verified: boolean;
  status?: string;
  userId?: string;
  productId?: string;
  error?: string;
}> {
  if (!polarClient) {
    return { verified: false, error: "Polar is not configured" };
  }

  try {
    const checkout = await polarClient.checkouts.get({ id: checkoutId });

    const successStatuses = ["succeeded", "paid", "confirmed"];
    
    if (successStatuses.includes(checkout.status)) {
      return {
        verified: true,
        status: checkout.status,
        userId: checkout.metadata?.userId as string,
        productId: checkout.productId || undefined,
      };
    }

    return {
      verified: false,
      status: checkout.status,
      error: `Checkout status is ${checkout.status} (expected: ${successStatuses.join(", ")})`,
    };
  } catch (error) {
    console.error("Failed to verify Polar checkout:", error);
    return { verified: false, error: "Failed to verify checkout" };
  }
}

export async function listPolarProducts(): Promise<any[]> {
  if (!polarClient) {
    return [];
  }

  try {
    const products = await polarClient.products.list({});
    return products.result.items || [];
  } catch (error) {
    console.error("Failed to list Polar products:", error);
    return [];
  }
}

export async function getCustomerIdByEmail(email: string): Promise<string | null> {
  if (!polarClient) {
    return null;
  }

  try {
    const customers = await polarClient.customers.list({
      email: email
    });
    const items = customers.result.items || [];
    return items.length > 0 ? items[0].id : null;
  } catch (error) {
    console.error("Failed to get customer by email:", error);
    return null;
  }
}

export async function getCustomerSubscriptions(customerEmail: string): Promise<any[]> {
  if (!polarClient) {
    return [];
  }

  try {
    const customerId = await getCustomerIdByEmail(customerEmail);
    if (!customerId) {
      return [];
    }

    const allSubscriptions: any[] = [];
    let page = 1;
    const limit = 100;
    
    while (true) {
      const subscriptions = await polarClient.subscriptions.list({
        customerId: customerId,
        page: page,
        limit: limit
      });
      
      const items = subscriptions.result.items || [];
      const activeItems = items.filter((sub: any) => 
        sub.status === 'active' || sub.status === 'past_due'
      );
      allSubscriptions.push(...activeItems);
      
      if (items.length < limit) {
        break;
      }
      page++;
    }
    
    return allSubscriptions;
  } catch (error) {
    console.error("Failed to get customer subscriptions:", error);
    return [];
  }
}

export async function cancelSubscription(subscriptionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!polarClient) {
    return { success: false, error: "Polar is not configured" };
  }

  try {
    await polarClient.subscriptions.update({
      id: subscriptionId,
      subscriptionUpdate: {
        cancelAtPeriodEnd: true
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to cancel subscription:", error);
    return { success: false, error: "Failed to cancel subscription" };
  }
}

export async function reactivateSubscription(subscriptionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!polarClient) {
    return { success: false, error: "Polar is not configured" };
  }

  try {
    await polarClient.subscriptions.update({
      id: subscriptionId,
      subscriptionUpdate: {
        cancelAtPeriodEnd: false
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to reactivate subscription:", error);
    return { success: false, error: "Failed to reactivate subscription" };
  }
}

export async function createCustomerPortalSession(customerId: string): Promise<string | null> {
  if (!polarClient) {
    return null;
  }

  try {
    const session = await polarClient.customerSessions.create({
      customerId
    });
    return session.customerPortalUrl || null;
  } catch (error) {
    console.error("Failed to create customer portal session:", error);
    return null;
  }
}

export { polarClient };
