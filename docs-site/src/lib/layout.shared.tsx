import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

const GitLabIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" role="img" viewBox="0 0 24 24">
    <title>GitLab</title>
    <path d="m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0537.8585.8585 0 0 0-.3362.405L.4332 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.0286.0199 4.9884 3.7363 2.4706 1.8682 1.505 1.1391a1.0056 1.0056 0 0 0 1.2151 0l1.505-1.1391 2.4706-1.8682 5.0187-3.7562.0113-.0113a6.0663 6.0663 0 0 0 2.0006-7.0004Z" />
  </svg>
);

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <img
          src="/logo_cincoders-full.svg"
          alt="Cincoders"
          className="h-6 w-auto"
          style={{ height: 24 }}
        />
      ),
    },
    links: [
      {
        type: 'icon',
        label: 'GitLab',
        icon: <GitLabIcon />,
        text: 'GitLab',
        url: 'https://gitlab.cin.ufpe.br/cincoders/platform/cincoders-nestjs-boilerplate',
        external: true,
      },
    ],
    themeSwitch: { enabled: false },
  };
}
