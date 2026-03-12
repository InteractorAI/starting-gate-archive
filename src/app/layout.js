import './globals.css';
import { getAllArticles } from '@/lib/articles';
import Sidebar from '@/components/Sidebar';
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  metadataBase: new URL('https://startinggate.miamitech.ai'),
  title: {
    default: 'The Starting Gate | Archive',
    template: '%s | Starting Gate Archive'
  },
  description: 'An archive of The Starting Gate blog by The Miami Herald, chronicling the rise of Miami Tech.',
  openGraph: {
    title: 'The Starting Gate | Archive',
    description: 'Archive of the Miami Herald Starting Gate tech blog.',
    url: 'https://startinggate.miamitech.ai',
    siteName: 'Starting Gate Archive',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Starting Gate | Archive',
    description: 'Archive of the Miami Herald Starting Gate tech blog.',
  },
  alternates: {
    canonical: '/',
  }
};

export default function RootLayout({ children }) {
  const articles = getAllArticles({ includeContent: false });

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
