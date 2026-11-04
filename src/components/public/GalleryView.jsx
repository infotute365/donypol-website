'use client';
import { useState } from 'react';
import Link from 'next/link';
import PhotoGrid from './PhotoGrid';

export default function GalleryView({ items: albums, page, pages }) {
  const [active, setActive] = useState('All');
  const shown = albums.filter((a) => active === 'All' || a.title === active);
  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-2">
        {['All', ...albums.map((a) => a.title)].map((t) => (
          <button key={t} onClick={() => setActive(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${active === t ? 'bg-ink text-white' : 'bg-mist hover:bg-sun/40'}`}>{t}</button>
        ))}
      </div>
      {shown.map((a) => (
        <section key={a.title} className="mb-12">
          <h2 className="mb-4 font-display text-2xl font-bold">{a.title}</h2>
          <PhotoGrid images={a.photos.map((photo) => photo.url)} />
        </section>
      ))}
      {pages > 1 && <nav className="flex items-center justify-center gap-2" aria-label="Gallery pages">
        {Array.from({ length: pages }, (_, index) => index + 1).map((number) => <Link key={number} href={`/gallery?page=${number}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${number === page ? 'bg-ink text-white' : 'bg-mist hover:bg-sun/40'}`}>{number}</Link>)}
      </nav>}
    </div>
  );
}
