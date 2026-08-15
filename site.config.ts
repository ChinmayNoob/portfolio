import type { SiteConfig } from '~/cfg-schema';

const config: SiteConfig = {
  siteUrl: 'https://chinmay.fyi/',
  title: 'Chinmay Sawant',
  titleTemplate: '%s',
  description: 'My personal blog about software development, AI, and other topics.',
  favicon: '/favicon.svg',
  ogImage: '/image.webp',
  // analytics: {
  //   provider: 'umami',
  //   websiteId: 'your-umami-website-id',
  // },
  bio: {
    name: 'chinmay sawant',
    avatar: '/chinmay.webp',
    description: 'software engineer writing about distributed systems, algorithms,AI, and modern React development.',
    links: [
      {
        label: 'mail',
        url: 'mailto:chinmaypvt04@gmail.com',
      },
      {
        label: 'github',
        url: 'https://github.com/chinmaynoob',
      },
      {
        label: 'linkedin',
        url: 'https://www.linkedin.com/in/chinmay-sawant0408/',
      },
      {
        label: 'x',
        url: 'https://x.com/Chinmay0408',
      },
    ],
  },
};

export default config;
