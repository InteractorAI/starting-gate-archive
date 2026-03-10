import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { getArticleData, getAllArticles } from '@/lib/articles';
import styles from './article.module.css';

// This generates static paths for all articles at build time (SSG)
export async function generateStaticParams() {
    const articles = getAllArticles();
    return articles.map((article) => ({
        slug: article.slug,
    }));
}

// Generates correct SEO meta tags for each individual article
export async function generateMetadata({ params }) {
    // Read params explicitly from modern Next.js
    const { slug } = await params;
    const article = getArticleData(slug);

    if (!article) return { title: 'Not Found' };

    return {
        title: `${article.title} | Starting Gate Archive`,
        description: article.content.substring(0, 160).replace(/\n/g, ' ') + '...',
    };
}

export default async function ArticlePage({ params }) {
    const { slug } = await params;
    const article = getArticleData(slug);

    if (!article) {
        notFound();
    }

    return (
        <div className={`${styles.articleContainer} animate-in`}>
            <header className={styles.header}>
                <h1 className={styles.title}>{article.title}</h1>
                <div className={styles.meta}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    {article.date}
                </div>
            </header>

            <article className={styles.content}>
                <ReactMarkdown
                    components={{
                        img: ({ node, src, alt, ...props }) => {
                            let actualSrc = src;
                            if (src && src.startsWith('../images/')) {
                                actualSrc = src.replace('../images/', '/images/');
                            }
                            return <img src={actualSrc} alt={alt || ""} {...props} />;
                        }
                    }}
                >
                    {article.content}
                </ReactMarkdown>
            </article>
        </div>
    );
}
