'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar({ groupedArticles }) {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>
                    Starting Gate
                </h1>
            </div>
            <div className="sidebar-content">
                {Object.keys(groupedArticles).map(monthStr => (
                    <div key={monthStr} className="month-group">
                        <div className="month-label">{monthStr}</div>
                        <div className="month-articles">
                            {groupedArticles[monthStr].map(article => {
                                const isActive = pathname === `/articles/${article.slug}`;
                                return (
                                    <Link
                                        key={article.slug}
                                        href={`/articles/${article.slug}`}
                                        className={`article-link ${isActive ? 'active' : ''}`}
                                    >
                                        <div className="article-title">{article.title}</div>
                                        <div className="article-date">{article.date}</div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    );
}
