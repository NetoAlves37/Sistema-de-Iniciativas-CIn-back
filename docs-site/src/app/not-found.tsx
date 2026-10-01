import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center justify-center px-4 py-32 text-center">
      <h1 className="font-bold text-4xl tracking-tight">Página não encontrada</h1>
      <p className="mt-4 text-fd-muted-foreground text-lg">
        A página que você procura pode ter sido movida ou não existe mais.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/docs"
          className="inline-flex items-center rounded-lg bg-brand px-5 py-2.5 font-medium text-fd-primary-foreground text-sm transition-colors hover:bg-brand/90"
        >
          Ver documentação
        </Link>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border bg-fd-background px-5 py-2.5 font-medium text-sm transition-colors hover:bg-fd-accent"
        >
          Ir para a página inicial
        </Link>
      </div>
    </main>
  );
}
