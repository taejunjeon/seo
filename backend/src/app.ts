import express, { type Request, type Response } from "express";

import { configureMiddleware } from "./bootstrap/configureMiddleware";
import { registerRoutes } from "./bootstrap/registerRoutes";
import { buildHealthPayload } from "./health/buildHealthPayload";

export const createApp = () => {
  const app = express();

  configureMiddleware(app);

  app.get("/health", (_req: Request, res: Response) => {
    res.json(buildHealthPayload());
  });

  registerRoutes(app);

  return app;
};
