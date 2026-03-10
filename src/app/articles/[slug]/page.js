import { notFound } from 'next/navigation';
import Link from 'next/link';
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
            {/* Mobile-only back button */}
            <Link href="/" className={styles.mobileBack}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
                All articles
            </Link>
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
                    {article.author && (
                        <>
                            <span className={styles.metaSeparator}>·</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            {article.author}
                        </>
                    )}
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
                        },
                        a: ({ node, href, children, ...props }) => {
                            if (!href) return <a {...props}>{children}</a>;

                            // If the link wraps only an image (Typepad lightbox pattern),
                            // strip the link and just render the image unlinked.
                            // Check the mdast node.children — reliably typed as 'image'.
                            if (node?.children?.length === 1 && node.children[0]?.type === 'image') {
                                return <>{children}</>;
                            }

                            const isInternal = href.startsWith('/') || href.startsWith('#') || (href.endsWith('.md') && !href.startsWith('http'));
                            let actualHref = href;

                            if (href.endsWith('.md') && !href.startsWith('http')) {
                                actualHref = `/articles/${href.replace('.md', '')}`;
                            }

                            if (isInternal) {
                                return <Link href={actualHref} {...props}>{children}</Link>;
                            }

                            return (
                                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                                    {children}
                                </a>
                            );
                        }
                    }}
                >
                    {article.content}
                </ReactMarkdown>
            </article>
        </div>
    );
}
