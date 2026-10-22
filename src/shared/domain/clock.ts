/**
 * Relógio injetável (RNF-04): toda regra de prazo lê o tempo daqui, para os testes
 * poderem simular a passagem do tempo.
 */
export interface Clock {
  now(): Date;
}
