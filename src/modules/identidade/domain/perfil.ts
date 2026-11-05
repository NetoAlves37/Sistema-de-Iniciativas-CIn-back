export const PERFIS = ['ALUNO', 'PROFESSOR', 'COMITE', 'ADMIN'] as const;

export type Perfil = (typeof PERFIS)[number];

export function ehPerfil(valor: string): valor is Perfil {
  return (PERFIS as readonly string[]).includes(valor);
}
