export type CheckoutRequest = {
  userId: string;
  planId: string;
  idempotencyKey: string;
};

export type CheckoutSession = { id: string; url: string };

export type SubscriptionStatus =
  | "FREE"
  | "ACTIVE"
  | "PENDING"
  | "PAST_DUE"
  | "CANCELED"
  | "EXPIRED"
  | "REFUNDED";

export type BillingSubscription = {
  id: string;
  userId: string;
  provider: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
};

export type BillingEvent = {
  id: string;
  provider: string;
  type: string;
  status: "processed" | "ignored" | "duplicate";
  subscriptionStatus?: SubscriptionStatus;
};

export interface BillingService {
  startCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  processWebhook(payload: string, headers: Headers): Promise<BillingEvent>;
  cancel(userId: string): Promise<BillingSubscription>;
  getSubscription(userId: string): Promise<BillingSubscription | null>;
}
