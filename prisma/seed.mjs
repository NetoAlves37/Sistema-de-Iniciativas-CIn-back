// Seed de DESENVOLVIMENTO / demonstração (IT-06). Nunca roda em produção.
//
//   npm run seed
//
// Cria (ou atualiza) os usuários de teste do realm do Keycloak (mesmos ids) e as iniciativas
// de exemplo do protótipo, sem o rascunho (HU-04 está fora do escopo), mais uma iniciativa
// sem votação para demonstrar a HU-26. As datas são relativas a "agora". É idempotente:
// roda quantas vezes quiser; as iniciativas de exemplo têm ids fixos e são recriadas.
import { PrismaClient } from '@prisma/client';

try {
  process.loadEnvFile('.env');
} catch {
  // sem .env: usa o ambiente
}

if (process.env.NODE_ENV === 'production') {
  console.error('O seed de demonstração não roda em produção (NODE_ENV=production).');
  process.exit(1);
}

const prisma = new PrismaClient();

const DAY = 86_400_000;
const HOUR = 3_600_000;

// --- usuários (iguais aos do setup/realm.json) -------------------------------------------
const USUARIOS = {
  u1: { id: '00000000-0000-4000-a000-000000000001', nome: 'Ana Souza', perfil: 'ALUNO' },
  u2: { id: '00000000-0000-4000-a000-000000000002', nome: 'Bruno Lima', perfil: 'PROFESSOR' },
  u3: { id: '00000000-0000-4000-a000-000000000003', nome: 'Carla Menezes', perfil: 'COMITE' },
  u4: { id: '00000000-0000-4000-a000-000000000004', nome: 'Diego Alves', perfil: 'ALUNO' },
  u5: { id: '00000000-0000-4000-a000-000000000005', nome: 'Elisa Rocha', perfil: 'COMITE' },
  u6: { id: '00000000-0000-4000-a000-000000000006', nome: 'Admin Test', perfil: 'ADMIN' },
};

const TIPO = { Extensão: 'EXTENSAO', Pesquisa: 'PESQUISA', Evento: 'EVENTO' };
const PERIODICIDADE = {
  'Evento único': 'EVENTO_UNICO',
  Diária: 'DIARIA',
  Semanal: 'SEMANAL',
  Quinzenal: 'QUINZENAL',
  Mensal: 'MENSAL',
};

const base = Date.now();
const isoDia = (n) => new Date(base + n * DAY).toISOString().slice(0, 10);
const em = (dd) => new Date(base + dd * DAY);

/** Limite inferior do intervalo de Wilson (95%): mesma fórmula do domínio de `votacao`. */
function wilson(pos, n) {
  if (!n) return 0;
  const z = 1.96;
  const p = pos / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / (1 + (z * z) / n);
}

// --- iniciativas de exemplo ---------------------------------------------------------------
// Histórico: [dias relativos, de, para, por, nota]. `por` é uma chave de USUARIOS ou 'SISTEMA'.
const SUBMETIDA = 'Submetida e aberta a sugestões';
const REF = 'Prazo de refinamento encerrado';
const VOT = 'Prazo de votação encerrado';
const APROVADA = 'Aprovada pelo comitê';

const fluxoAprovada = (autor, d0) => [
  [d0, null, 'EM_ANDAMENTO', autor, SUBMETIDA],
  [d0 + 3, 'EM_ANDAMENTO', 'EM_VOTACAO', 'SISTEMA', REF],
  [d0 + 6, 'EM_VOTACAO', 'EM_ANALISE', 'SISTEMA', VOT],
];

const INICIATIVAS = [
  {
    n: 1, autor: 'u2', tipo: 'Evento', titulo: 'Hackathon de Acessibilidade Digital',
    resumo: 'Maratona de 24h para criar soluções que tornem sistemas da UFPE mais acessíveis.',
    detalhe: 'Equipes de até 5 pessoas desenvolvem protótipos voltados a pessoas com deficiência visual, auditiva e motora. Mentoria do NACE e premiação para os três melhores projetos.',
    inicio: 9, fim: 10, per: 'Evento único', org: 'Bruno Lima, Diretório Acadêmico', membros: 'Ana Souza, Diego Alves',
    part: 80, espaco: 'Auditório do CIn', horas: ['09:00', '18:00'], status: 'APROVADA', votos: [34, 3], decisor: 'u3', decidida: -2,
    historico: [...fluxoAprovada('u2', -14), [-2, 'EM_ANALISE', 'APROVADA', 'u3', APROVADA]],
  },
  {
    n: 2, autor: 'u1', tipo: 'Pesquisa', titulo: 'Grupo de Estudos em IA Responsável',
    resumo: 'Encontros semanais para ler e discutir artigos sobre viés, transparência e ética em IA.',
    detalhe: 'Cada encontro tem um relator que apresenta um artigo. Ao final do semestre, o grupo produz um relatório técnico aberto.',
    inicio: -12, fim: 60, per: 'Semanal', org: 'Ana Souza', membros: 'Bruno Lima (orientador)', part: 20, espaco: 'Sala E-112',
    horas: ['14:00', '16:00'], status: 'APROVADA', votos: [21, 2], decisor: 'u3', decidida: -20, criada: -40,
    historico: [[-38, null, 'EM_ANDAMENTO', 'u1', SUBMETIDA], [-35, 'EM_ANDAMENTO', 'EM_VOTACAO', 'SISTEMA', REF],
      [-32, 'EM_VOTACAO', 'EM_ANALISE', 'SISTEMA', VOT], [-20, 'EM_ANALISE', 'APROVADA', 'u3', APROVADA]],
  },
  {
    n: 3, autor: 'u4', tipo: 'Extensão', titulo: 'Mutirão de Inclusão Digital',
    resumo: 'Um dia de atendimento gratuito à comunidade do entorno para uso de celular e serviços gov.br.',
    detalhe: 'Voluntários atendem moradores em estações por tema: cadastro gov.br, golpes no WhatsApp, uso de aplicativos de banco.',
    inicio: 4, fim: 4, per: 'Evento único', org: 'Diego Alves', membros: 'Ana Souza', part: 40, espaco: 'Laboratório G1',
    horas: ['08:00', '12:00'], status: 'APROVADA', votos: [19, 0], decisor: 'u3', decidida: -4,
    historico: [...fluxoAprovada('u4', -14), [-4, 'EM_ANALISE', 'APROVADA', 'u3', APROVADA]],
  },
  {
    n: 4, autor: 'u2', tipo: 'Extensão', titulo: 'Plantão de Dúvidas de Algoritmos',
    resumo: 'Plantão quinzenal aberto a qualquer estudante com dúvidas de Algoritmos e Estruturas de Dados.',
    detalhe: 'Monitores e professor se revezam. Não precisa de inscrição.',
    inicio: -20, fim: 40, per: 'Quinzenal', org: 'Bruno Lima', membros: 'Monitores de AED', part: 30, espaco: 'Sala D-005',
    horas: ['18:30', '20:30'], status: 'APROVADA', votos: [15, 1], decisor: 'u5', decidida: -22, criada: -35,
    historico: [...fluxoAprovada('u2', -33), [-22, 'EM_ANALISE', 'APROVADA', 'u5', APROVADA]],
  },
  {
    n: 5, autor: 'u4', tipo: 'Extensão', titulo: 'Oficina de Programação para Escolas Públicas',
    resumo: 'Oficinas de lógica de programação com Scratch para alunos do ensino fundamental da rede pública.',
    detalhe: 'Parceria com duas escolas da Várzea. Seis encontros de 2h. Os alunos do CIn atuam como instrutores.',
    inicio: 20, fim: 62, per: 'Semanal', org: 'Diego Alves', membros: 'Ana Souza, Bruno Lima', part: 35, espaco: 'Laboratório G2',
    status: 'EM_VOTACAO', fimRef: -1, fimVot: 2 + 3 / 24, votos: [18, 2, ['u2']],
    comentarios: [['u2', 'Sugiro incluir um encontro final de apresentação dos projetos para as famílias.', -3],
      ['u4', 'Boa ideia, incluí o encontro de encerramento.', -2.5]],
    historico: [[-4, null, 'EM_ANDAMENTO', 'u4', SUBMETIDA], [-1, 'EM_ANDAMENTO', 'EM_VOTACAO', 'SISTEMA', REF]],
  },
  {
    n: 6, autor: 'u2', tipo: 'Evento', titulo: 'Maratona Interna de Programação',
    resumo: 'Seletiva interna para formar os times do CIn na Maratona SBC.',
    detalhe: 'Prova de 5 horas no estilo ICPC, com problemas inéditos.',
    inicio: 30, fim: 30, per: 'Evento único', org: 'Bruno Lima', membros: 'Treinadores da maratona', part: 60,
    espaco: 'Laboratórios G1 e G2', status: 'EM_VOTACAO', fimRef: -2, fimVot: 1, votos: [6, 0],
    historico: [[-5, null, 'EM_ANDAMENTO', 'u2', SUBMETIDA], [-2, 'EM_ANDAMENTO', 'EM_VOTACAO', 'SISTEMA', REF]],
  },
  {
    n: 7, autor: 'u1', tipo: 'Evento', titulo: 'Sala de Descompressão Gamer',
    resumo: 'Espaço com consoles e jogos de tabuleiro aberto nos intervalos, durante a semana de provas.',
    detalhe: 'Uso de uma sala ociosa durante a semana de provas, com escala de voluntários.',
    inicio: 35, fim: 40, per: 'Diária', org: 'Ana Souza', membros: '', part: 25, espaco: 'Sala E-201',
    status: 'EM_VOTACAO', fimRef: -1, fimVot: 3, votos: [9, 11],
    historico: [[-4, null, 'EM_ANDAMENTO', 'u1', SUBMETIDA], [-1, 'EM_ANDAMENTO', 'EM_VOTACAO', 'SISTEMA', REF]],
  },
  {
    n: 8, autor: 'u1', tipo: 'Extensão', titulo: 'Monitoria Colaborativa de Cálculo',
    resumo: 'Grupos de estudo guiados por veteranos para calouros com dificuldade em Cálculo 1.',
    detalhe: 'Encontros em pequenos grupos de até 6 calouros, com listas de exercícios comentadas.',
    inicio: 15, fim: 75, per: 'Semanal', org: 'Ana Souza', membros: 'Diego Alves', part: 36, espaco: 'Sala D-010',
    status: 'EM_ANDAMENTO', fimRef: 1 + 5 / 24,
    comentarios: [['u2', 'Vale combinar os horários com a monitoria oficial para não coincidir.', -1],
      ['u4', 'Posso ajudar com as listas de limites e derivadas.', -0.6], ['u1', 'Obrigada! Vou alinhar os horários com a coordenação.', -0.3]],
    historico: [[-2, null, 'EM_ANDAMENTO', 'u1', SUBMETIDA]],
  },
  {
    n: 9, autor: 'u2', tipo: 'Extensão', titulo: 'Podcast Bits do CIn',
    resumo: 'Podcast quinzenal com entrevistas de egressos e pesquisadores do Centro.',
    detalhe: 'Episódios de 30 minutos gravados no estúdio da Rádio Universitária e publicados nas plataformas do CIn.',
    inicio: 25, fim: 120, per: 'Quinzenal', org: 'Bruno Lima', membros: 'Ana Souza', part: 4, espaco: 'Estúdio da Rádio Universitária',
    status: 'EM_ANDAMENTO', fimRef: 2,
    comentarios: [['u3', 'Seria interessante ter episódios sobre as iniciativas aprovadas aqui na plataforma.', -0.4]],
    historico: [[-1, null, 'EM_ANDAMENTO', 'u2', SUBMETIDA]],
  },
  {
    // HU-26: iniciativa SEM votação. Ao fim do refinamento vai direto para a análise.
    n: 10, autor: 'u1', tipo: 'Extensão', titulo: 'Clube de Xadrez do CIn', comVotacao: false,
    resumo: 'Encontros semanais de xadrez abertos a toda a comunidade, com aulas para iniciantes.',
    detalhe: 'Tabuleiros e relógios emprestados pelo Diretório Acadêmico. Sem votação geral: segue direto para o comitê ao fim do prazo de sugestões.',
    inicio: 12, fim: 90, per: 'Semanal', org: 'Ana Souza', membros: 'Diego Alves', part: 24, espaco: 'Sala E-110',
    horas: ['17:00', '19:00'], status: 'EM_ANDAMENTO', fimRef: 2,
    comentarios: [['u4', 'Posso trazer dois tabuleiros extras.', -0.2]],
    historico: [[-1, null, 'EM_ANDAMENTO', 'u1', SUBMETIDA]],
  },
  {
    n: 11, autor: 'u3', tipo: 'Pesquisa', titulo: 'Laboratório Aberto de Robótica',
    resumo: 'Abertura do laboratório de robótica às sextas para projetos de alunos de qualquer período.',
    detalhe: 'Alunos propõem projetos curtos e usam kits do laboratório com supervisão de um bolsista.',
    inicio: 14, fim: 90, per: 'Semanal', org: 'Carla Menezes', membros: 'Bolsistas do laboratório', part: 15,
    espaco: 'Laboratório de Robótica', status: 'EM_ANALISE', fimRef: -5, fimVot: -1, votos: [22, 4],
    historico: [[-9, null, 'EM_ANDAMENTO', 'u3', SUBMETIDA], [-5, 'EM_ANDAMENTO', 'EM_VOTACAO', 'SISTEMA', REF],
      [-1, 'EM_VOTACAO', 'EM_ANALISE', 'SISTEMA', VOT]],
  },
  {
    n: 12, autor: 'u4', tipo: 'Evento', titulo: 'Semana de Boas-vindas dos Calouros',
    resumo: 'Programação de acolhimento com tour pelo CIn, palestras curtas e gincana.',
    detalhe: 'Cinco dias de atividades no início do semestre, organizadas por veteranos e pelo DA.',
    inicio: 40, fim: 44, per: 'Diária', org: 'Diego Alves, Diretório Acadêmico', membros: 'Ana Souza', part: 150,
    espaco: 'Hall e auditório do CIn', status: 'EM_ANALISE', fimRef: -6, fimVot: -2, votos: [27, 1],
    historico: [[-10, null, 'EM_ANDAMENTO', 'u4', SUBMETIDA], [-6, 'EM_ANDAMENTO', 'EM_VOTACAO', 'SISTEMA', REF],
      [-2, 'EM_VOTACAO', 'EM_ANALISE', 'SISTEMA', VOT]],
  },
  {
    n: 13, autor: 'u1', tipo: 'Evento', titulo: 'Semana de Carreiras em Tech',
    resumo: 'Uma semana de palestras e rodas de conversa com profissionais do mercado.',
    detalhe: 'Palestras diárias no fim da tarde, com empresas do Porto Digital.',
    inicio: 12, fim: 16, per: 'Diária', org: 'Ana Souza', membros: 'Diego Alves', part: 120, espaco: 'Auditório do CIn',
    status: 'REPROVADA', fimRef: -8, fimVot: -5, votos: [30, 5], decisor: 'u3', decidida: -1,
    justificativa: 'O período coincide com a semana de provas do calendário acadêmico e o auditório já está reservado. Sugerimos mover para depois das provas e detalhar a lista de empresas confirmadas.',
    comentarios: [['u4', 'Dá para incluir uma sessão de revisão de currículos?', -8]],
    historico: [[-12, null, 'EM_ANDAMENTO', 'u1', SUBMETIDA], [-8, 'EM_ANDAMENTO', 'EM_VOTACAO', 'SISTEMA', REF],
      [-5, 'EM_VOTACAO', 'EM_ANALISE', 'SISTEMA', VOT],
      [-1, 'EM_ANALISE', 'REPROVADA', 'u3', 'Reprovada pelo comitê', 'justificativa']],
  },
];

const idDe = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function main() {
  const lookup = async (model) => new Map((await model.findMany()).map((l) => [l.code, l.id]));
  const [perfis, status, tipos, periodicidades] = await Promise.all([
    lookup(prisma.perfilUsuario),
    lookup(prisma.statusIniciativa),
    lookup(prisma.tipoIniciativa),
    lookup(prisma.periodicidade),
  ]);

  for (const u of Object.values(USUARIOS)) {
    await prisma.usuario.upsert({
      where: { id: u.id },
      update: { nome: u.nome, perfilId: perfis.get(u.perfil) },
      create: { id: u.id, nome: u.nome, perfilId: perfis.get(u.perfil) },
    });
  }

  const ids = INICIATIVAS.map((i) => idDe(i.n));
  // Recria só as iniciativas de exemplo (ids fixos), sem tocar no que as pessoas criaram.
  await prisma.voto.deleteMany({ where: { iniciativaId: { in: ids } } });
  await prisma.placar.deleteMany({ where: { iniciativaId: { in: ids } } });
  await prisma.comentario.deleteMany({ where: { iniciativaId: { in: ids } } });
  await prisma.transicaoHistorico.deleteMany({ where: { iniciativaId: { in: ids } } });
  await prisma.iniciativa.deleteMany({ where: { id: { in: ids } } });

  for (const it of INICIATIVAS) {
    const id = idDe(it.n);
    const criadaEm = em(it.criada ?? -15);
    await prisma.iniciativa.create({
      data: {
        id,
        autorId: USUARIOS[it.autor].id,
        tipoId: tipos.get(TIPO[it.tipo]),
        titulo: it.titulo,
        resumo: it.resumo,
        detalhe: it.detalhe,
        inicio: new Date(isoDia(it.inicio)),
        fim: new Date(isoDia(it.fim)),
        horaInicio: it.horas?.[0] ?? null,
        horaFim: it.horas?.[1] ?? null,
        periodicidadeId: periodicidades.get(PERIODICIDADE[it.per]),
        espaco: it.espaco,
        organizadores: it.org,
        membros: it.membros || null,
        participantes: it.part,
        comVotacao: it.comVotacao ?? true,
        statusId: status.get(it.status),
        ciclo: 1,
        fimRefinamento: it.fimRef === undefined ? null : em(it.fimRef),
        fimVotacao: it.fimVot === undefined ? null : em(it.fimVot),
        justificativa: it.justificativa ?? null,
        decisorId: it.decisor ? USUARIOS[it.decisor].id : null,
        decididaEm: it.decidida === undefined ? null : em(it.decidida),
        criadaEm,
      },
    });

    await prisma.transicaoHistorico.createMany({
      data: it.historico.map(([dd, de, para, por, nota, comJustificativa]) => ({
        iniciativaId: id,
        ciclo: 1,
        deId: de ? status.get(de) : null,
        paraId: status.get(para),
        por: por === 'SISTEMA' ? 'SISTEMA' : USUARIOS[por].id,
        nota,
        justificativa: comJustificativa ? it.justificativa : null,
        ocorreuEm: em(dd),
      })),
    });

    if (it.comentarios?.length) {
      await prisma.comentario.createMany({
        data: it.comentarios.map(([quem, texto, dd]) => ({
          iniciativaId: id,
          ciclo: 1,
          autorId: USUARIOS[quem].id,
          texto,
          criadoEm: em(dd),
        })),
      });
    }

    if (it.votos) {
      const [likes, dislikes, extras = []] = it.votos;
      // Votantes fictícios (`seed-voter-N`), mais usuários reais que já curtiram.
      const votos = [];
      for (let i = 0; i < likes; i++) votos.push({ usuarioId: `seed-voter-${i}`, valor: 1 });
      for (let i = 0; i < dislikes; i++) votos.push({ usuarioId: `seed-voter-${200 + i}`, valor: -1 });
      for (const quem of extras) votos.push({ usuarioId: USUARIOS[quem].id, valor: 1 });
      await prisma.voto.createMany({
        data: votos.map((v) => ({ iniciativaId: id, ciclo: 1, ...v })),
      });
      const totalLikes = votos.filter((v) => v.valor === 1).length;
      const totalDislikes = votos.length - totalLikes;
      await prisma.placar.create({
        data: {
          iniciativaId: id,
          ciclo: 1,
          likes: totalLikes,
          dislikes: totalDislikes,
          relevancia: wilson(totalLikes, votos.length),
        },
      });
    }
  }

  console.log(`Seed concluído: ${Object.keys(USUARIOS).length} usuários e ${INICIATIVAS.length} iniciativas de exemplo.`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
