'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Sidebar({ articles }) {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [fullSearchData, setFullSearchData] = useState(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const pathname = usePathname();
    const router = useRouter();
    const searchRef = useRef(null);
    const listRef = useRef(null);

    const isArticleOpen = pathname !== '/';

    // Fetch full search data in background
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/search-data');
                const data = await res.json();
                setFullSearchData(data);
            } catch (err) {
                console.error("Failed to load search index", err);
            }
        };
        fetchData();
    }, []);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 150);
        return () => clearTimeout(timer);
    }, [search]);

    const filteredAndGrouped = useMemo(() => {
        const query = debouncedSearch.toLowerCase();

        // Use full search data if available, otherwise use initial metadata
        const dataSource = fullSearchData || articles;

        const filtered = dataSource.filter(article =>
            article.title.toLowerCase().includes(query) ||
            (article.content && article.content.toLowerCase().includes(query)) ||
            article.slug.toLowerCase().includes(query)
        );

        const grouped = {};
        filtered.forEach(article => {
            if (!article.date) article.date = "Unknown Date";

            let monthYear = "Unknown";
            try {
                const d = new Date(article.date);
                if (!isNaN(d.valueOf())) {
                    monthYear = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                }
            } catch (e) { }

            if (!grouped[monthYear]) grouped[monthYear] = [];
            grouped[monthYear].push(article);
        });

        return grouped;
    }, [articles, fullSearchData, debouncedSearch]);

    // Flat ordered list for index-based navigation
    const flatArticles = useMemo(() =>
        Object.values(filteredAndGrouped).flat(),
        [filteredAndGrouped]
    );

    // Reset when search changes
    useEffect(() => {
        setFocusedIndex(-1);
    }, [search]);

    // Scroll focused item into view
    useEffect(() => {
        if (focusedIndex < 0 || !listRef.current) return;
        const items = listRef.current.querySelectorAll('.article-link');
        items[focusedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [focusedIndex]);

    // Scroll active item into view on initial load or direct URL access
    useEffect(() => {
        if (focusedIndex >= 0 || !listRef.current) return;

        // Small timeout allows DOM to update .active classes before querying
        setTimeout(() => {
            const activeItem = listRef.current?.querySelector('.article-link.active');
            if (activeItem) {
                activeItem.scrollIntoView({ block: 'center' });
            }
        }, 50);
    }, [pathname, flatArticles, focusedIndex]);

    // Focus list container when entering list-navigation mode
    useEffect(() => {
        if (focusedIndex >= 0) {
            listRef.current?.focus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusedIndex >= 0]);

    // Navigate immediately as the focused article changes
    useEffect(() => {
        if (focusedIndex < 0) return;
        const article = flatArticles[focusedIndex];
        if (article) router.replace(`/articles/${article.slug}`);
    }, [focusedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    // Single handler on the <aside> — bubbles from both input and list
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIndex(i => Math.min(i + 1, flatArticles.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(i => {
                if (i <= 0) {
                    searchRef.current?.focus();
                    return -1;
                }
                return i - 1;
            });
        } else if (e.key === 'Enter' && focusedIndex >= 0) {
            e.preventDefault();
            const article = flatArticles[focusedIndex];
            if (article) router.push(`/articles/${article.slug}`);
        }
    }, [focusedIndex, flatArticles, router]);

    return (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <aside className={`sidebar ${isArticleOpen ? 'sidebar--hidden-mobile' : ''}`} onKeyDown={handleKeyDown}>
            <div className="sidebar-header">
                <Link href="/" className="logo-link">
                    <h1>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                        </svg>
                        Starting Gate
                    </h1>
                </Link>
                <div className="courtesy-badge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 16v-4"></path>
                        <path d="M12 8h.01"></path>
                    </svg>
                    <div>
                        Archive compiled and hosted courtesy of Miami-based <a href="https://interactor.ai" target="_blank" rel="noopener noreferrer" className="interactor-link">Interactor</a>, the AI concierge for your business. Check <a href="https://miamitech.ai" target="_blank" rel="noopener noreferrer" className="interactor-link">MiamiTech.ai</a> for more resources.
                    </div>
                </div>

                <div className="search-container">
                    <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search archive..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="search-input"
                    />
                    {search && (
                        <button className="clear-search" onClick={() => setSearch('')}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Search loading indicator */}
                {search && !fullSearchData && (
                    <div className="search-loading-hint">Indexing full archive for deep search...</div>
                )}

                {/* Keyboard hint — hidden on touch devices via CSS */}
                <div className="keyboard-hint">
                    <span className="key-chip">↑</span>
                    <span className="key-chip">↓</span>
                    <span className="keyboard-hint-label">to navigate</span>
                </div>
            </div>

            <div
                className="sidebar-content"
                ref={listRef}
                tabIndex={-1}
            >
                {Object.keys(filteredAndGrouped).length > 0 ? (
                    Object.keys(filteredAndGrouped).map(monthStr => (
                        <div key={monthStr} className="month-group">
                            <div className="month-label">{monthStr}</div>
                            <div className="month-articles">
                                {filteredAndGrouped[monthStr].map(article => {
                                    const globalIndex = flatArticles.findIndex(a => a.slug === article.slug);
                                    const isActive = pathname === `/articles/${article.slug}`;
                                    const isFocused = globalIndex === focusedIndex;
                                    return (
                                        <Link
                                            key={article.slug}
                                            href={`/articles/${article.slug}`}
                                            className={`article-link ${isActive ? 'active' : ''} ${isFocused ? 'keyboard-focused' : ''}`}
                                            tabIndex={-1}
                                        >
                                            <div className="article-title">{article.title}</div>
                                            <div className="article-date">{article.date}</div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="no-results">
                        <p>No articles found for &ldquo;{search}&rdquo;</p>
                    </div>
                )}
            </div>
        </aside>
    );
}
