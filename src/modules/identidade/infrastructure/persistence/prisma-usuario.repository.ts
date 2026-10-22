import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import type { UsuarioRepository } from '../../domain/ports/usuario.repository';
import { Usuario } from '../../domain/usuario';

type UsuarioComPerfil = { id: string; nome: string; perfil: { code: string } };

const paraDominio = (row: UsuarioComPerfil): Usuario =>
  Usuario.criar({ id: row.id, nome: row.nome, perfil: row.perfil.code });

@Injectable()
export class PrismaUsuarioRepository implements UsuarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async salvar(usuario: Usuario): Promise<void> {
    const perfil = { connect: { code: usuario.perfil } };
    await this.prisma.usuario.upsert({
      where: { id: usuario.id },
      create: { id: usuario.id, nome: usuario.nome, perfil },
      update: { nome: usuario.nome, perfil, atualizadoEm: new Date() },
    });
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    const row = await this.prisma.usuario.findUnique({
      where: { id },
      include: { perfil: true },
    });
    return row ? paraDominio(row) : null;
  }

  async buscarPorIds(ids: string[]): Promise<Usuario[]> {
    const rows = await this.prisma.usuario.findMany({
      where: { id: { in: ids } },
      include: { perfil: true },
    });
    return rows.map(paraDominio);
  }
}
