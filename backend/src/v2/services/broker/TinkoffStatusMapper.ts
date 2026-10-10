export class TinkoffStatusMapper {
  mapStatus(raw: string | undefined | null): string | null {
    if (!raw) return null;
    const map: Record<string, string> = {
      EXECUTION_REPORT_STATUS_UNSPECIFIED: null as any,
      EXECUTION_REPORT_STATUS_FILL: 'filled',
      EXECUTION_REPORT_STATUS_PARTIALLYFILL: 'partially_filled',
      EXECUTION_REPORT_STATUS_CANCELLED: 'cancelled',
      EXECUTION_REPORT_STATUS_REJECTED: 'rejected',
      EXECUTION_REPORT_STATUS_NEW: 'accepted'
    };
    return map[raw] || null;
  }
}
