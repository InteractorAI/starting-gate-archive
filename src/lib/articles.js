import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Directory containing the scraped markdown files
const articlesDirectory = path.join(process.cwd(), 'articles');

/**
 * Get all available articles by reading the directory.
 * @param {Object} options Configuration options
 * @param {boolean} options.includeContent Whether to include the full article content (default: true)
 * @returns {Array} Array of article metadata objects
 */
export function getAllArticles(options = { includeContent: true }) {
    if (!fs.existsSync(articlesDirectory)) return [];

    // Get all .md files in the articles directory
    const fileNames = fs.readdirSync(articlesDirectory).filter(file => file.endsWith('.md'));

    const allArticlesData = fileNames.map((fileName) => {
        // Remove ".md" from file name to get slug
        const slug = fileName.replace(/\.md$/, '');

        // Read markdown file as string
        const fullPath = path.join(articlesDirectory, fileName);
        const fileContents = fs.readFileSync(fullPath, 'utf8');

        // Our scrape.py now writes Frontmatter (title and date)
        const matterResult = matter(fileContents);

        // Combine the data with the slug
        const data = {
            slug,
            title: matterResult.data.title || slug.replace(/-/g, ' '),
            date: matterResult.data.date || 'Unknown Date',
            ...matterResult.data,
        };

        if (options.includeContent) {
            data.content = matterResult.content;
        }

        return data;
    });

    // Sort articles by date descending
    return allArticlesData.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);

        // Handle invalid dates by pushing them to the end
        if (isNaN(dateA.valueOf())) return 1;
        if (isNaN(dateB.valueOf())) return -1;

        return dateB - dateA;
    });
}

/**
 * Get a lightweight index of all articles for client-side search.
 * This includes content but is optimized for search.
 */
export function getSearchData() {
    const articles = getAllArticles({ includeContent: true });
    return articles.map(a => ({
        slug: a.slug,
        title: a.title,
        content: a.content,
        date: a.date
    }));
}

/**
 * Get the full content for a single article slug.
 */
export function getArticleData(slug) {
    const fullPath = path.join(articlesDirectory, `${slug}.md`);

    if (!fs.existsSync(fullPath)) {
        return null;
    }

    const fileContents = fs.readFileSync(fullPath, 'utf8');

    // Parse frontmatter
    const matterResult = matter(fileContents);

    const title = matterResult.data.title || slug.replace(/-/g, ' ');
    const lines = matterResult.content.trim().split('\n');

    // Clean up if the first line is exactly the H1 title
    if (lines[0] && lines[0].startsWith('# ')) {
        lines.shift();
    }

    return {
        slug,
        title,
        content: lines.join('\n').trim(),
        date: matterResult.data.date || 'Unknown Date',
        ...matterResult.data
    };
}
