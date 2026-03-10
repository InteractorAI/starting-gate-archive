import './globals.css';
import { getAllArticles } from '@/lib/articles';
import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: 'The Starting Gate | Archive',
  description: 'An archive of The Starting Gate blog by The Miami Herald, chronicling the rise of Miami Tech.',
};

export default function RootLayout({ children }) {
  const articles = getAllArticles();

  // Group logic sorting by whatever it is already sorted by (date desc)
  const grouped = {};
  articles.forEach(article => {
    // Basic catch if article date isn't ready
    if (!article.date) article.date = "Unknown Date";

    // Convert e.g., "March 09, 2012" to "March 2012"
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

  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <Sidebar groupedArticles={grouped} />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
