import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { setupSocketIO } from "./lib/socket";
import { startExpiryCron } from "./lib/expiry-cron";
import { startDevisExpiryCron } from "./lib/devis-expiry-cron";
import { startOrderExpiryCron } from "./lib/order-expiry-cron";
import { startSubscriptionExpiryCron, ensureDefaultPlans } from "./lib/subscriptions";
import { startVerificationReminderCron } from "./lib/verification-reminder-cron";
import { startSupportSlaCron } from "./lib/support-sla-cron";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);
setupSocketIO(httpServer);

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
  ensureDefaultPlans();
  startExpiryCron();
  startSubscriptionExpiryCron();
  startDevisExpiryCron();
  startOrderExpiryCron();
  startVerificationReminderCron();
  startSupportSlaCron();
});

httpServer.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});
