/**
 * Circuit Breaker Pattern Implementation for External Service Calls (Buró)
 */
export class CircuitBreaker {
  constructor({ failureThreshold = 3, resetTimeout = 10000, requestTimeout = 2000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.requestTimeout = requestTimeout;

    this.state = 'CLOSED'; // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
    this.failureCount = 0;
    this.lastStateChange = Date.now();
  }

  async execute(asyncFn) {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastStateChange > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.lastStateChange = now;
        console.log('⚡ [CircuitBreaker] Transición a HALF_OPEN: Probando endpoint...');
      } else {
        console.warn('⚡ [CircuitBreaker] Estado ABIERTO (OPEN): Solicitud rechazada sin llamar al servicio externo.');
        throw new Error('CIRCUIT_BREAKER_OPEN: El servicio del buró no está disponible');
      }
    }

    try {
      // Wrapper con timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT: El servicio del buró tardó demasiado')), this.requestTimeout)
      );

      const result = await Promise.race([asyncFn(), timeoutPromise]);

      // Si tiene éxito en HALF_OPEN o CLOSED
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.lastStateChange = Date.now();
        console.log('⚡ [CircuitBreaker] Transición a CLOSED: Servicio externo recuperado.');
      } else {
        this.failureCount = 0;
      }

      return result;
    } catch (err) {
      this.failureCount += 1;
      console.error(`⚡ [CircuitBreaker] Fallo registrado (${this.failureCount}/${this.failureThreshold}): ${err.message}`);

      if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
        this.state = 'OPEN';
        this.lastStateChange = Date.now();
        console.error('⚡ [CircuitBreaker] ¡Límite de fallos alcanzado! Transición a estado ABIERTO (OPEN).');
      }

      throw err;
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastStateChange: new Date(this.lastStateChange).toISOString()
    };
  }
}
