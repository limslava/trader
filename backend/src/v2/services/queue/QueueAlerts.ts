import { JetStreamLagMetrics } from './JetStreamLagMetrics';
import { QueueAlertDispatcher } from './QueueAlertDispatcher';
import { QueueAlertPolicyService } from './QueueAlertPolicyService';
import { QueueAlertThrottle } from './QueueAlertThrottle';

export class QueueAlerts {
  private lagMetrics = new JetStreamLagMetrics();
  private dispatcher = new QueueAlertDispatcher();
  private policyService = new QueueAlertPolicyService();
  private throttle = new QueueAlertThrottle();

  async shouldAlert(tenantId: string): Promise<boolean> {
    const lag = await this.lagMetrics.getLag();
    if (!lag) return false;
    const pending = lag?.num_pending ?? 0;
    const threshold = await this.policyService.getLagThreshold(tenantId);
    const criticalThreshold = await this.policyService.getCriticalLagThreshold(tenantId);

    if (pending >= criticalThreshold) {
      if (!this.throttle.shouldSend(Number(process.env.QUEUE_ALERT_CRITICAL_COOLDOWN_MS || 30000))) {
        return false;
      }
      await this.dispatcher.dispatch(`CRITICAL: Queue lag ${pending} exceeds ${criticalThreshold}`);
      return true;
    }

    if (pending > threshold) {
      if (!this.throttle.shouldSend()) {
        return false;
      }
      await this.dispatcher.dispatch(`Queue lag ${pending} exceeds ${threshold}`);
      return true;
    }
    return false;
  }
}
