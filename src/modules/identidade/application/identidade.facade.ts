import type { Clock } from '@/shared/domain/clock';
import type { UsuarioRepository } from '../domain/ports/usuario.repository';
import type { RegistrarUsuarioInput, UsuarioDto } from './dto/usuario.dto';
import { ObterUsuario, ObterUsuarios } from './queries/obter-usuarios';
import { RegistrarUsuario } from './use-cases/registrar-usuario';

export type { RegistrarUsuarioInput, UsuarioDto };

// Limite do cache de sincronização: evita crescer sem controle em instâncias longevas.
const LIMITE_CACHE = 5000;
// Enquanto nome e perfil não mudam, o usuário só é regravado a cada 5 minutos.
const TTL_CACHE_MS = 5 * 60 * 1000;

interface Sincronizacao {
  assinatura: string;
  ate: number;
}

/**
 * API pública do módulo `identidade`. Os outros módulos só falam com `identidade`
 * por aqui, e sempre por portas implementadas em `infrastructure/adapters`.
 */
export class IdentidadeFacade {
  private readonly registrarUsuario: RegistrarUsuario;
  private readonly obterUsuario: ObterUsuario;
  private readonly obterUsuarios: ObterUsuarios;
  /** id → última gravação (assinatura "nome|perfil" e validade), para não escrever a cada requisição. */
  private readonly sincronizados = new Map<string, Sincronizacao>();

  constructor(
    usuarios: UsuarioRepository,
    private readonly clock: Clock,
  ) {
    this.registrarUsuario = new RegistrarUsuario(usuarios);
    this.obterUsuario = new ObterUsuario(usuarios);
    this.obterUsuarios = new ObterUsuarios(usuarios);
  }

  /**
   * Garante que o usuário do token existe localmente com nome e perfil atuais. Grava
   * quando algo mudou desde o último registro desta instância ou quando o cache de 5
   * minutos expirou.
   */
  async garantirUsuario(input: RegistrarUsuarioInput): Promise<void> {
    const assinatura = `${input.nome}|${input.perfil}`;
    const agora = this.clock.now().getTime();
    const anterior = this.sincronizados.get(input.id);
    if (anterior && anterior.assinatura === assinatura && anterior.ate > agora) {
      return;
    }
    await this.registrarUsuario.executar(input);
    if (this.sincronizados.size >= LIMITE_CACHE) {
      this.sincronizados.clear();
    }
    this.sincronizados.set(input.id, { assinatura, ate: agora + TTL_CACHE_MS });
  }

  obterPorId(id: string): Promise<UsuarioDto> {
    return this.obterUsuario.executar(id);
  }

  usuariosPorIds(ids: string[]): Promise<UsuarioDto[]> {
    return this.obterUsuarios.executar(ids);
  }

  /** Mapa id → usuário, para exibir autores, comentaristas e decisores. */
  async mapaPorIds(ids: string[]): Promise<Map<string, UsuarioDto>> {
    const usuarios = await this.obterUsuarios.executar(ids);
    return new Map(usuarios.map((usuario) => [usuario.id, usuario]));
  }
}
