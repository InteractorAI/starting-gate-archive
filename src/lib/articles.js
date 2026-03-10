import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Directory containing the scraped markdown files
const articlesDirectory = path.join(process.cwd(), 'articles');

/**
 * Get all available articles by reading the directory.
 * @returns {Array} Array of article metadata objects
 */
export function getAllArticles() {
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
        return {
            slug,
            title: matterResult.data.title || slug.replace(/-/g, ' '),
            date: matterResult.data.date || 'Unknown Date',
            content: matterResult.content,
            ...matterResult.data,
        };
    });

    // Sort articles by date descending
    return allArticlesData.sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });
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
