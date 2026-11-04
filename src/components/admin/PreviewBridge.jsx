'use client';
import { useEffect } from 'react';
import { PREVIEW_PAGES, previewUrl } from '@/lib/site-editor.mjs';

export default function PreviewBridge({ draft, path }) {
  useEffect(() => {
    window.parent.postMessage({ type: 'dpvn-preview-ready', path }, window.location.origin);
    function onClick(event) {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin === window.location.origin && PREVIEW_PAGES.some((p) => p.route === url.pathname)) {
        event.preventDefault(); event.stopImmediatePropagation();
        window.location.assign(previewUrl(url.pathname + url.search, draft));
      } else if (anchor.target !== '_blank' && !url.hash) {
        event.preventDefault(); event.stopImmediatePropagation(); window.open(anchor.href, '_blank', 'noopener,noreferrer');
      }
    }
    function onMessage(event) {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type === 'dpvn-preview-restore-scroll' && Number.isFinite(event.data.scrollY)) window.scrollTo(0, event.data.scrollY);
    }
    function onScroll() { window.parent.postMessage({ type: 'dpvn-preview-scroll', scrollY: window.scrollY }, window.location.origin); }
    document.addEventListener('click', onClick, true); window.addEventListener('message', onMessage); window.addEventListener('scroll', onScroll, { passive: true });
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('message', onMessage); window.removeEventListener('scroll', onScroll); };
  }, [draft, path]);
  return null;
}
