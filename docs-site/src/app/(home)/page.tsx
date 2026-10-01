import {
  BookOpenIcon,
  CodeIcon,
  FileTextIcon,
  GithubIcon,
  GitlabIcon,
  InstagramIcon,
  MailIcon,
  ServerIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PaperDesignBackground } from '@/components/ui/paper-design-background';

type LucideIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface CardProps {
  href: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
}

interface QuickLinkProps {
  href: string;
  title: string;
  description: string;
}

function FeatureCard({ href, icon: Icon, iconBg, iconColor, title, description }: CardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-xl border bg-fd-card p-6 transition-all hover:border-fd-primary/50 hover:shadow-md"
    >
      <div
        className={`mb-4 flex size-12 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}
      >
        <Icon className="size-6" />
      </div>
      <h2 className="mb-2 font-semibold text-lg">{title}</h2>
      <p className="mb-4 flex-1 text-fd-muted-foreground text-sm">{description}</p>
      <span className="font-medium text-fd-foreground text-sm transition-colors group-hover:text-fd-primary">
        Leia mais →
      </span>
    </Link>
  );
}

function QuickLink({ href, title, description }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-fd-background p-3 text-sm transition-colors hover:border-fd-primary/50"
    >
      <div className="mb-1 font-medium">{title}</div>
      <div className="text-fd-muted-foreground text-xs">{description}</div>
    </Link>
  );
}

export const metadata: Metadata = {
  title: 'CInCoders NestJS StarterKit - Documentação',
  description:
    'Documentação completa do CInCoders NestJS StarterKit com TypeORM, Keycloak e Zod. Setup, arquitetura, guias de desenvolvimento.',
};

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      {/* Hero */}
      <div className="relative mb-16 overflow-hidden pt-6 text-center">
        <h1 className="mb-4 font-bold text-4xl tracking-tight">CInCoders NestJS StarterKit</h1>
        <p className="mx-auto mb-8 max-w-2xl text-fd-muted-foreground text-lg">
          Uma base estruturada e robusta para criar microsserviços e APIs REST em Node.js com
          TypeScript. Segue as melhores práticas de engenharia de software da comunidade.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-5 py-2.5 font-medium text-fd-primary-foreground text-sm transition-colors hover:bg-fd-primary/90"
          >
            Começar
          </Link>
          <a
            href="https://gitlab.cin.ufpe.br/cincoders/platform/cincoders-nestjs-boilerplate"
            className="inline-flex items-center gap-2 rounded-lg border bg-fd-background px-5 py-2.5 font-medium text-sm transition-colors hover:bg-fd-accent"
          >
            <GitlabIcon className="size-4" />
            Ver no GitLab
          </a>
        </div>
      </div>

      {/* Main Guide Cards */}
      <div className="mb-16 grid gap-4 md:grid-cols-3">
        <FeatureCard
          href="/docs/setup/quick-start"
          icon={FileTextIcon}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          title="Setup & Inicialização"
          description="Configure o ambiente local, rodando a aplicação via Docker Compose."
        />

        <FeatureCard
          href="/docs/architecture/overview"
          icon={ServerIcon}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-600"
          title="Arquitetura"
          description="Entenda a estrutura modular, autenticação, persistência e padrões de erro."
        />

        <FeatureCard
          href="/docs/guides/module-scaffolding"
          icon={CodeIcon}
          iconBg="bg-green-500/10"
          iconColor="text-green-600"
          title="Guias de Desenvolvimento"
          description="Crie novos módulos, escreva testes e siga as convenções do projeto."
        />
      </div>

      {/* Quick Start & Core Concepts */}
      <div className="mb-16 grid gap-8 md:grid-cols-2">
        <div className="rounded-xl border bg-fd-card/50 p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <BookOpenIcon className="size-5 text-fd-muted-foreground" />
            Quick Start
          </h3>
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 font-medium text-sm">Primeiro Deploy</h4>
              <ol className="list-inside list-decimal space-y-1 text-fd-muted-foreground text-sm">
                <li>
                  <Link
                    href="/docs/setup/quick-start"
                    className="text-fd-foreground underline decoration-fd-muted-foreground/40 underline-offset-2 transition-colors hover:text-fd-primary hover:decoration-fd-primary/60"
                  >
                    Instale as dependências
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/setup/keycloak-local"
                    className="text-fd-foreground underline decoration-fd-muted-foreground/40 underline-offset-2 transition-colors hover:text-fd-primary hover:decoration-fd-primary/60"
                  >
                    Configure o Keycloak
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/architecture/overview"
                    className="text-fd-foreground underline decoration-fd-muted-foreground/40 underline-offset-2 transition-colors hover:text-fd-primary hover:decoration-fd-primary/60"
                  >
                    Entenda a arquitetura
                  </Link>
                </li>
              </ol>
            </div>
            <div>
              <h4 className="mb-2 font-medium text-sm">Desenvolver Novos Módulos</h4>
              <ol className="list-inside list-decimal space-y-1 text-fd-muted-foreground text-sm">
                <li>
                  <Link
                    href="/docs/guides/module-scaffolding"
                    className="text-fd-foreground underline decoration-fd-muted-foreground/40 underline-offset-2 transition-colors hover:text-fd-primary hover:decoration-fd-primary/60"
                  >
                    Crie um novo módulo
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/guides/testing-guide"
                    className="text-fd-foreground underline decoration-fd-muted-foreground/40 underline-offset-2 transition-colors hover:text-fd-primary hover:decoration-fd-primary/60"
                  >
                    Escreva testes unitários
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/architecture/authentication"
                    className="text-fd-foreground underline decoration-fd-muted-foreground/40 underline-offset-2 transition-colors hover:text-fd-primary hover:decoration-fd-primary/60"
                  >
                    Implemente autenticação
                  </Link>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-fd-card/50 p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <BookOpenIcon className="size-5 text-fd-muted-foreground" />
            Conceitos Principais
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <QuickLink
              href="/docs/architecture/authentication"
              title="Autenticação"
              description="JWT + Keycloak"
            />
            <QuickLink
              href="/docs/architecture/persistence-and-migrations"
              title="Persistência"
              description="TypeORM + PostgreSQL"
            />
            <QuickLink
              href="/docs/architecture/request-pipeline"
              title="Pipeline"
              description="Guards, Pipes, Interceptors"
            />
            <QuickLink
              href="/docs/architecture/error-handling"
              title="Erros"
              description="Exceções e tratamento"
            />
          </div>
        </div>
      </div>

      {/* Technology Stack */}
      <div className="mb-16 grid gap-4 md:grid-cols-2">
        <Link
          href="/docs/architecture/overview"
          className="flex items-start gap-4 rounded-xl border bg-fd-card/50 p-5 transition-all hover:border-fd-primary/50"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
            <ShieldCheckIcon className="size-5" />
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Stack Tecnológica</h3>
            <p className="text-fd-muted-foreground text-sm">
              NestJS 11, TypeORM, PostgreSQL, Keycloak, Zod, Vitest, Biome
            </p>
          </div>
        </Link>

        <Link
          href="/docs/modules/overview"
          className="flex items-start gap-4 rounded-xl border bg-fd-card/50 p-5 transition-all hover:border-fd-primary/50"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
            <CodeIcon className="size-5" />
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Módulos Inclusos</h3>
            <p className="text-fd-muted-foreground text-sm">
              Health Module, Task Module e estrutura de exemplo
            </p>
          </div>
        </Link>
      </div>

      {/* Community CTA */}
      <div className="relative overflow-hidden rounded-xl border bg-fd-card/50 px-8 py-18 text-center">
        <PaperDesignBackground className="opacity-30" />
        <div className="relative z-10">
          <h3 className="mb-2 font-semibold text-lg">Contribua com a Comunidade</h3>
          <p className="mb-6 text-fd-muted-foreground text-sm">
            O CInCoders NestJS StarterKit é mantido pelo CInCoders. Contribuições são bem-vindas!
          </p>
          <ul
            className="flex flex-wrap items-center justify-center gap-3"
            aria-label="Redes sociais"
          >
            <li>
              <a
                href="https://gitlab.cin.ufpe.br/cincoders/platform/cincoders-nestjs-boilerplate"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitLab"
                className="inline-flex size-9 items-center justify-center rounded-full border bg-fd-background transition-colors hover:bg-fd-accent"
              >
                <GitlabIcon className="size-4" />
              </a>
            </li>
            <li>
              <a
                href="https://github.com/CinCoders"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="inline-flex size-9 items-center justify-center rounded-full border bg-fd-background transition-colors hover:bg-fd-accent"
              >
                <GithubIcon className="size-4" />
              </a>
            </li>
            <li>
              <a
                href="https://instagram.com/cincoders"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="inline-flex size-9 items-center justify-center rounded-full border bg-fd-background transition-colors hover:bg-fd-accent"
              >
                <InstagramIcon className="size-4" />
              </a>
            </li>
            <li>
              <a
                href="mailto:cincoders@cin.ufpe.br"
                aria-label="Email"
                className="inline-flex size-9 items-center justify-center rounded-full border bg-fd-background transition-colors hover:bg-fd-accent"
              >
                <MailIcon className="size-4" />
              </a>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
