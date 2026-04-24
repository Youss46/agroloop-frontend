import { runSlaBreachCheck } from "../routes/support-tickets";
import { logger } from "./logger";

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

export function startSupportSlaCron(): void {
  const tick = async () => {
    try {
      const r = await runSlaBreachCheck();
      if (r.marked > 0) logger.info({ marked: r.marked }, "Support SLA breach check");
    } catch (err) {
      logger.error({ err }, "Support SLA cron failed");
    }
  };
  tick();
  setInterval(tick, FIFTEEN_MIN_MS);
  logger.info({ intervalMs: FIFTEEN_MIN_MS }, "Support SLA cron scheduled");
}
