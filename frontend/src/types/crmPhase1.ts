export type CrmPhase1Experiment = {
  experiment_key: string;
  name: string;
  channel: string;
  status: string;
  assignment_version: number;
  conversion_window_days: number;
  variant_weights: Record<string, number>;
  created_at: string | null;
  updated_at: string | null;
};

export type CrmPhase1ExperimentResults = {
  experiment: CrmPhase1Experiment;
  assignments: Array<{ variant_key: string; assignment_count: number }>;
  messages: Array<{ provider_status: string; message_count: number }>;
  variant_summary: Array<{
    variant_key: string;
    assignment_count: number;
    purchaser_count: number;
    purchase_count: number;
    revenue_amount: number;
    refund_amount: number;
    net_revenue: number;
    purchase_rate: number;
  }>;
  conversions: Array<{
    conversion_type: string;
    conversion_count: number;
    revenue_amount: number;
    refund_amount: number;
    net_revenue: number;
  }>;
};

export type CrmPhase1Assignments = {
  total_count: number;
  limit: number;
  offset: number;
  items: Array<{
    customer_key: string;
    variant_key: string;
    assignment_bucket: number;
    assigned_at: string | null;
    source_segment: string | null;
    conversion_summary: {
      purchase_count: number;
      purchase_revenue: number;
      refund_amount: number;
      net_revenue: number;
      last_conversion_at: string | null;
      has_purchase: boolean;
    };
  }>;
};

export type CrmPhase1OpsSnapshot = {
  range: { startDate: string; endDate: string };
  generatedAt: string;
  blockers: string[];
  p1s1: {
    revenueBridge: {
      configured: boolean;
      baseUrl: string | null;
      reachable: boolean;
      authReady: boolean;
      error: string | null;
    };
    experimentCount: number;
    experiments: CrmPhase1Experiment[];
    selectedExperimentKey: string | null;
    selectedExperimentResults: CrmPhase1ExperimentResults | null;
    selectedAssignments: CrmPhase1Assignments | null;
  };
  p1s1a: {
    ledgerSummary: {
      totalEntries: number;
      countsByTouchpoint: Record<string, number>;
      countsByCaptureMode: {
        live: number;
        replay: number;
        smoke: number;
      };
      paymentSuccessByCaptureMode: {
        live: number;
        replay: number;
        smoke: number;
      };
      checkoutByCaptureMode: {
        live: number;
        replay: number;
        smoke: number;
      };
      entriesWithPaymentKey: number;
      entriesWithOrderId: number;
      entriesWithGaSessionId: number;
      latestLoggedAt: string | null;
    };
    tossJoinSummary: {
      tossRows: number;
      paymentSuccessEntries: number;
      matchedTossRows: number;
      matchedByPaymentKey: number;
      matchedByOrderId: number;
      unmatchedTossRows: number;
      unmatchedLedgerEntries: number;
      joinCoverageRate: number;
      ledgerCoverageRate: number;
      byCaptureMode: {
        live: {
          paymentSuccessEntries: number;
          matchedTossRows: number;
          unmatchedLedgerEntries: number;
          joinCoverageRate: number;
          ledgerCoverageRate: number;
        };
        replay: {
          paymentSuccessEntries: number;
          matchedTossRows: number;
          unmatchedLedgerEntries: number;
          joinCoverageRate: number;
          ledgerCoverageRate: number;
        };
        smoke: {
          paymentSuccessEntries: number;
          matchedTossRows: number;
          unmatchedLedgerEntries: number;
          joinCoverageRate: number;
          ledgerCoverageRate: number;
        };
      };
    };
    ga4NotSetTotals: {
      ecommercePurchases: number;
      grossPurchaseRevenue: number;
    } | null;
    ga4Diagnosis: {
      sourceSignals: {
        notSetRevenue: number;
        notSetPurchases: number;
        selfReferralRevenue: number;
        selfReferralPurchases: number;
        suspiciousSources: string[];
      };
      dataQualitySignals: {
        notSetLandingRatio: number;
      };
      transactionSignals: {
        distinctTransactionIds: number;
        totalPurchaseEvents: number;
        blankTransactionEvents: number;
        duplicatePurchaseEvents: number;
        transactionCoverageRatio: number;
      };
    } | null;
    timeline: Array<{
      date: string;
      ga4NotSetPurchases: number;
      ga4NotSetRevenue: number;
      tossApprovalCount: number;
      tossApprovalAmount: number;
      paymentSuccessEntries: number;
      livePaymentSuccessEntries: number;
      replayPaymentSuccessEntries: number;
      smokePaymentSuccessEntries: number;
      checkoutEntries: number;
      diagnosticLabel: string;
    }>;
    nextActions: string[];
  };
};

export type CrmPhase1OpsResponse = {
  ok: boolean;
  data: CrmPhase1OpsSnapshot;
};
