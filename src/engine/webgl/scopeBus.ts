export interface ScopeFramePacket {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

type ScopeListener = (packet: ScopeFramePacket) => void;

class ScopeBus {
  private listeners = new Set<ScopeListener>();
  private lastEmitMs = 0;

  subscribe(listener: ScopeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  hasListeners(): boolean {
    return this.listeners.size > 0;
  }

  emit(packet: ScopeFramePacket): void {
    const now = performance.now();
    if (now - this.lastEmitMs < 50) return;
    this.lastEmitMs = now;
    this.listeners.forEach((fn) => fn(packet));
  }
}

export const scopeBus = new ScopeBus();
