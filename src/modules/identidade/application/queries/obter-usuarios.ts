import { UsuarioNaoEncontradoError } from '../../domain/errors/identidade.errors';
import type { UsuarioRepository } from '../../domain/ports/usuario.repository';
import type { Usuario } from '../../domain/usuario';
import type { UsuarioDto } from '../dto/usuario.dto';

const paraDto = (usuario: Usuario): UsuarioDto => ({
  id: usuario.id,
  nome: usuario.nome,
  perfil: usuario.perfil,
});

export class ObterUsuario {
  constructor(private readonly usuarios: UsuarioRepository) {}

  async executar(id: string): Promise<UsuarioDto> {
    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) {
      throw new UsuarioNaoEncontradoError(id);
    }
    return paraDto(usuario);
  }
}

export class ObterUsuarios {
  constructor(private readonly usuarios: UsuarioRepository) {}

  async executar(ids: string[]): Promise<UsuarioDto[]> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) {
      return [];
    }
    return (await this.usuarios.buscarPorIds(unicos)).map(paraDto);
  }
}
