import type { MetadataRoute } from 'next';

/** App instalável (PWA): atalho na tela do celular para atletas e diretoria. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fênix Vôlei',
    short_name: 'Fênix',
    description: 'Site oficial e sistema de gestão do Time Fênix Volleyball.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0B0613',
    theme_color: '#0B0613',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/brand/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ],
    shortcuts: [
      { name: 'Minha conta', url: '/minha-conta' },
      { name: 'Loja', url: '/loja' },
      { name: 'Painel', url: '/admin' }
    ]
  };
}
