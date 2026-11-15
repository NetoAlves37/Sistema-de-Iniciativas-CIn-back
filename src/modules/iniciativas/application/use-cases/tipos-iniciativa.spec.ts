import { entrada, montar, T0 } from '@/modules/iniciativas/testing/montar-casos-de-uso';
import { ValidacaoError } from '@/shared/domain/domain-error';
import {
  SomenteComiteError,
  TipoEmUsoError,
  TipoNaoEncontradoError,
} from '../../domain/errors/iniciativas.errors';
import { codigoDoNome } from '../../domain/tipo-de-iniciativa';

const admin = { id: 'admin', nome: 'Administrador', ehComite: true };
const aluno = { id: 'diego', nome: 'Diego', ehComite: false };

async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  return promessa.then(
    () => undefined,
    (e: unknown) => e,
  );
}

describe('Cadastro de tipos de iniciativa', () => {
  describe('codigoDoNome', () => {
    it.each([
      ['Palestra', 'PALESTRA'],
      ['Liga Acadêmica', 'LIGA_ACADEMICA'],
      ['  Festival  de   Música! ', 'FESTIVAL_DE_MUSICA'],
      ['***', 'TIPO'],
    ])('"%s" vira %s', (nome, codigo) => {
      expect(codigoDoNome(nome)).toBe(codigo);
    });
  });

  describe('CadastrarTipo', () => {
    it('cria ativo, com código gerado do nome, e registra CRIADO no log com quem e quando', async () => {
      const { cadastrarTipo, tipos } = montar();

      const criado = await cadastrarTipo.executar(admin, { nome: ' Palestra ', cor: '#1a2b3c' });

      expect(criado).toMatchObject({
        code: 'PALESTRA',
        nome: 'Palestra',
        cor: '#1A2B3C',
        ativo: true,
        iniciativas: 0,
      });
      expect(tipos.log.at(-1)).toMatchObject({
        acao: 'CRIADO',
        tipoId: criado.id,
        tipoCode: 'PALESTRA',
        por: 'admin',
        porNome: 'Administrador',
        ocorreuEm: T0,
        antes: null,
        depois: { nome: 'Palestra', cor: '#1A2B3C', ativo: true },
      });
    });

    it('nome repetido (sem diferenciar acento e maiúsculas) recebe 422 no campo nome', async () => {
      const { cadastrarTipo, tipos } = montar();
      const erro = await erroDe(
        cadastrarTipo.executar(admin, { nome: 'extensao', cor: '#000000' }),
      );
      expect(erro).toBeInstanceOf(ValidacaoError);
      expect((erro as ValidacaoError).campos).toEqual({ nome: 'Já existe um tipo com este nome.' });
      expect(tipos.log).toHaveLength(0);
    });

    it('nome e cor obrigatórios, cor em #RRGGBB', async () => {
      const { cadastrarTipo } = montar();
      const vazio = await erroDe(cadastrarTipo.executar(admin, {}));
      expect((vazio as ValidacaoError).campos).toEqual({
        nome: 'Informe o nome do tipo.',
        cor: 'Escolha a cor do tipo.',
      });
      const corRuim = await erroDe(cadastrarTipo.executar(admin, { nome: 'Liga', cor: 'azul' }));
      expect((corRuim as ValidacaoError).campos).toEqual({
        cor: 'Informe a cor no formato #RRGGBB.',
      });
    });

    it('código já usado por um tipo renomeado ganha sufixo', async () => {
      const { cadastrarTipo, alterarTipo } = montar();
      const liga = await cadastrarTipo.executar(admin, { nome: 'Liga', cor: '#112233' });
      await alterarTipo.executar(liga.id, admin, { nome: 'Liga Acadêmica' });
      const nova = await cadastrarTipo.executar(admin, { nome: 'Liga', cor: '#445566' });
      expect(nova.code).toBe('LIGA_2');
    });

    it('quem não é do comitê nem ADMIN recebe 403', async () => {
      const { cadastrarTipo } = montar();
      await expect(
        cadastrarTipo.executar(aluno, { nome: 'Palestra', cor: '#000000' }),
      ).rejects.toBeInstanceOf(SomenteComiteError);
    });
  });

  describe('AlterarTipo', () => {
    it('renomeia e troca a cor de um tipo em uso, sem mudar o código, e registra o antes e o depois', async () => {
      const { alterarTipo, tipos } = montar();
      const [evento] = (await tipos.listar()).filter((t) => t.code === 'EVENTO');
      tipos.usos.set(evento.id, 3);

      const alterado = await alterarTipo.executar(evento.id, admin, {
        nome: 'Festival',
        cor: '#ff0000',
      });

      expect(alterado).toMatchObject({
        code: 'EVENTO',
        nome: 'Festival',
        cor: '#FF0000',
        iniciativas: 3,
      });
      expect(tipos.log.at(-1)).toMatchObject({
        acao: 'ALTERADO',
        por: 'admin',
        antes: { nome: 'Evento', cor: '#F7AE85' },
        depois: { nome: 'Festival', cor: '#FF0000' },
      });
    });

    it('desativar e ativar registram DESATIVADO e ATIVADO; o tipo inativo sai da seleção', async () => {
      const { alterarTipo, listarTipos, tipos } = montar();
      const [pesquisa] = (await tipos.listar()).filter((t) => t.code === 'PESQUISA');

      await alterarTipo.executar(pesquisa.id, admin, { ativo: false });
      expect(tipos.log.at(-1)).toMatchObject({
        acao: 'DESATIVADO',
        antes: { ativo: true },
        depois: { ativo: false },
      });
      const ativos = await listarTipos.executar({ somenteAtivos: true });
      expect(ativos.map((t) => t.code)).not.toContain('PESQUISA');
      expect((await listarTipos.executar()).map((t) => t.code)).toContain('PESQUISA');

      await alterarTipo.executar(pesquisa.id, admin, { ativo: true });
      expect(tipos.log.at(-1)?.acao).toBe('ATIVADO');
    });

    it('nome, cor e ativo juntos geram dois registros; sem mudança real, nenhum', async () => {
      const { alterarTipo, tipos } = montar();
      const [extensao] = (await tipos.listar()).filter((t) => t.code === 'EXTENSAO');

      await alterarTipo.executar(extensao.id, admin, { nome: 'Extensão', cor: '#9be0a0' });
      expect(tipos.log).toHaveLength(0);

      await alterarTipo.executar(extensao.id, admin, {
        nome: 'Extensão Universitária',
        ativo: false,
      });
      expect(tipos.log.map((l) => l.acao)).toEqual(['ALTERADO', 'DESATIVADO']);
    });

    it('renomear para o nome de outro tipo recebe 422; tipo inexistente, 404', async () => {
      const { alterarTipo, tipos } = montar();
      const [evento] = (await tipos.listar()).filter((t) => t.code === 'EVENTO');
      const erro = await erroDe(alterarTipo.executar(evento.id, admin, { nome: 'PESQUISA' }));
      expect((erro as ValidacaoError).campos).toEqual({ nome: 'Já existe um tipo com este nome.' });
      await expect(alterarTipo.executar(999, admin, { nome: 'X' })).rejects.toBeInstanceOf(
        TipoNaoEncontradoError,
      );
    });
  });

  describe('ExcluirTipo', () => {
    it('exclui um tipo sem iniciativas e registra EXCLUIDO no log', async () => {
      const { cadastrarTipo, excluirTipo, tipos } = montar();
      const liga = await cadastrarTipo.executar(admin, { nome: 'Liga', cor: '#123456' });

      await excluirTipo.executar(liga.id, admin);

      expect(tipos.persistido(liga.id)).toBeUndefined();
      expect(tipos.log.at(-1)).toMatchObject({
        acao: 'EXCLUIDO',
        tipoCode: 'LIGA',
        tipoLabel: 'Liga',
        por: 'admin',
        antes: { nome: 'Liga', cor: '#123456', ativo: true },
        depois: null,
      });
    });

    it('com iniciativas associadas recebe 409 e nada muda', async () => {
      const { excluirTipo, tipos } = montar();
      const [evento] = (await tipos.listar()).filter((t) => t.code === 'EVENTO');
      tipos.usos.set(evento.id, 2);

      const erro = await erroDe(excluirTipo.executar(evento.id, admin));

      expect(erro).toBeInstanceOf(TipoEmUsoError);
      expect((erro as Error).message).toBe(
        'Este tipo não pode ser excluído porque há 2 iniciativas associadas a ele. Você pode desativá-lo.',
      );
      expect(tipos.persistido(evento.id)).toBeDefined();
      expect(tipos.log).toHaveLength(0);
    });

    it('quem não é do comitê nem ADMIN recebe 403', async () => {
      const { excluirTipo, tipos } = montar();
      const [evento] = await tipos.listar();
      await expect(excluirTipo.executar(evento.id, aluno)).rejects.toBeInstanceOf(
        SomenteComiteError,
      );
    });
  });

  describe('iniciativas usam só tipos ativos', () => {
    it('submeter com um tipo cadastrado funciona; com tipo desativado recebe 422', async () => {
      const { cadastrarTipo, alterarTipo, submeter } = montar();
      const palestra = await cadastrarTipo.executar(admin, { nome: 'Palestra', cor: '#336699' });

      await expect(submeter.executar('ana', entrada({ tipo: 'PALESTRA' }))).resolves.toBeTypeOf(
        'string',
      );

      await alterarTipo.executar(palestra.id, admin, { ativo: false });
      const erro = await erroDe(submeter.executar('ana', entrada({ tipo: 'PALESTRA' })));
      expect((erro as ValidacaoError).campos).toEqual({
        tipo: 'Este tipo não existe ou foi desativado. Selecione outro.',
      });
    });

    it('editar mantém o tipo atual mesmo que ele tenha sido desativado', async () => {
      const { cadastrarTipo, alterarTipo, submeter, editar, repositorio } = montar();
      const palestra = await cadastrarTipo.executar(admin, { nome: 'Palestra', cor: '#336699' });
      const id = await submeter.executar('ana', entrada({ tipo: 'PALESTRA' }));
      await alterarTipo.executar(palestra.id, admin, { ativo: false });

      await editar.executar(id, 'ana', entrada({ tipo: 'PALESTRA', titulo: 'Novo título' }));

      expect(repositorio.persistida(id).dados).toMatchObject({
        tipo: 'PALESTRA',
        titulo: 'Novo título',
      });
    });
  });
});
