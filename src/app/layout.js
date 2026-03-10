import './globals.css';
import { getAllArticles } from '@/lib/articles';
import Sidebar from '@/components/Sidebar';
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: 'The Starting Gate | Archive',
  description: 'An archive of The Starting Gate blog by The Miami Herald, chronicling the rise of Miami Tech.',
};

export default function RootLayout({ children }) {
  const articles = getAllArticles();

  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <Sidebar articles={articles} />
          <main className="main-content">
            {children}
          </main>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
