export interface QueueAlertPolicy {
  lagThreshold: number;
  lagCriticalThreshold?: number;
}

export const defaultQueueAlertPolicy: QueueAlertPolicy = {
  lagThreshold: 1000,
  lagCriticalThreshold: 5000
};
