export type OrderState = 'new' | 'queued' | 'accepted' | 'rejected' | 'cancelled' | 'filled' | 'partially_filled';

const transitions: Record<OrderState, OrderState[]> = {
  new: ['queued', 'accepted', 'rejected', 'cancelled'],
  queued: ['accepted', 'rejected', 'cancelled'],
  accepted: ['partially_filled', 'filled', 'cancelled'],
  partially_filled: ['filled', 'cancelled'],
  filled: [],
  rejected: [],
  cancelled: []
};

export class OrderStateMachine {
  canTransition(from: OrderState, to: OrderState): boolean {
    return transitions[from]?.includes(to) || false;
  }
}
