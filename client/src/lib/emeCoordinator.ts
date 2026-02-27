/**
 * [OMEGA ZERO - PHASE 7]
 * Singularity UI Architecture - Global EME Coordinator
 */

class EMECoordinator {
  private registries: Map<string, number> = new Map();
  private limits: Map<string, number> = new Map();

  constructor() {
    this.limits.set('Dashboard_EME', 25);
    this.limits.set('Market_EME', 25);
    this.limits.set('Logs_EME', 15);
    this.limits.set('Telegram_EME', 15);
    this.limits.set('Risk_EME', 20);
  }

  public reportMemory(id: string, usage: number) {
    this.registries.set(id, usage);
    const limit = this.limits.get(id) || 100;
    
    if (usage > limit) {
      // Trigger EME Throttle via CustomEvent
      window.dispatchEvent(new CustomEvent(`eme-throttle-${id}`, { detail: { usage, limit } }));
    }
  }
}

export const emeCoordinator = new EMECoordinator();
