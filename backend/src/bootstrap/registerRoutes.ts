import { type Application, type Request, type Response } from "express";

import { errorHandler } from "../middleware/errorHandler";
import { createAcquisitionRouter } from "../routes/acquisition";
import { createAiRouter } from "../routes/ai";
import { createAligoRouter } from "../routes/aligo";
import { createAttributionRouter } from "../routes/attribution";
import { createCallpriceRouter } from "../routes/callprice";
import { createChannelTalkRouter } from "../routes/channeltalk";
import { createConsultationRouter } from "../routes/consultation";
import { createCrawlRouter } from "../routes/crawl";
import { createCrmLocalRouter } from "../routes/crmLocal";
import { createCrmPhase1Router } from "../routes/crmPhase1";
import { createDiagnosisRouter } from "../routes/diagnosis";
import { createGa4Router } from "../routes/ga4";
import { createGoogleAdsRouter } from "../routes/googleAds";
import { createGscRouter } from "../routes/gsc";
import { createIdentityCoverageRouter } from "../routes/identityCoverage";
import { createPageSpeedRouter } from "../routes/pagespeed";
import { createRefundRouter } from "../routes/refund";
import { createTossRouter } from "../routes/toss";
import { createTotalRouter } from "../routes/total";
import { createAdsRouter } from "../routes/ads";
import { createMetaCapiRouter, createMetaRouter } from "../routes/meta";
import { createSourceFreshnessRouter } from "../routes/sourceFreshness";
import { createAibioRouter } from "../routes/aibio";
import { createCoffeeRouter } from "../routes/coffee";
import { createCoupangRouter } from "../routes/coupang";
import { createNpayRouter } from "../routes/npay";

export const registerRoutes = (app: Application) => {
  app.use(createGscRouter());
  app.use(createGa4Router());
  app.use(createPageSpeedRouter());
  app.use(createChannelTalkRouter());
  app.use(createTossRouter());
  app.use(createTotalRouter());
  app.use(createAdsRouter());
  app.use(createGoogleAdsRouter());
  app.use(createMetaRouter());
  app.use(createMetaCapiRouter());
  app.use(createAligoRouter());
  app.use(createAcquisitionRouter());
  app.use(createAttributionRouter());
  app.use(createCallpriceRouter());
  app.use(createCrmPhase1Router());
  app.use(createCrmLocalRouter());
  app.use(createSourceFreshnessRouter());
  app.use(createConsultationRouter());
  app.use(createAiRouter());
  app.use(createCrawlRouter());
  app.use(createDiagnosisRouter());
  app.use(createRefundRouter());
  app.use(createIdentityCoverageRouter());
  app.use(createAibioRouter());
  app.use(createCoffeeRouter());
  app.use(createCoupangRouter());
  app.use(createNpayRouter());

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: "not_found",
      message: "Route not found",
    });
  });

  app.use(errorHandler);
};
