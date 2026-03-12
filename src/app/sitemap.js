import { getAllArticles } from '@/lib/articles';

export default async function sitemap() {
  const baseUrl = 'https://startinggate.miamitech.ai';
  const articles = getAllArticles({ includeContent: false });

  const articleEntries = articles.map((article) => ({
    url: `${baseUrl}/articles/${article.slug}`,
    lastModified: new Date(article.date || new Date()),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...articleEntries,
  ];
}
