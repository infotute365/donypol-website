import Image from 'next/image';
import { Award } from 'lucide-react';

export default function PrideCard({ student, preview = false }) {
  const initials = student.name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('') || '?';
  return <article className="pride-card flex h-full flex-col overflow-hidden rounded-[26px] border border-[#dfcdb6] bg-white/80 shadow-[0_15px_40px_-28px_rgba(78,28,47,.4)] backdrop-blur-md">
    <div className="relative m-4 mb-0 aspect-[4/3] overflow-hidden rounded-[18px] border border-[#e6d7c2] bg-gradient-to-br from-[#f7ecdc] to-[#ead5bd]">
      {student.image?.url ? <Image src={student.image.url} alt={`Portrait of ${student.name}`} fill sizes="(max-width: 767px) 90vw, (max-width: 1023px) 45vw, 380px" className="object-cover" unoptimized={preview} /> : <div className="flex h-full flex-col items-center justify-center gap-3 text-[#7b2943]" aria-label={`Photograph unavailable for ${student.name}`}><span className="flex h-24 w-24 items-center justify-center rounded-full border border-[#cfb18a]/60 bg-[#fff9ed]/80 font-display text-4xl shadow-inner">{initials}</span><Award size={24} className="text-[#957040]" aria-hidden="true" /></div>}
    </div>
    <div className="flex flex-1 flex-col p-6">
      <div className="mb-4 flex flex-wrap gap-2">{student.className && <span className="clay-icon rounded-full px-3 py-1 text-xs font-bold text-[#774b2b]">{student.className}</span>}{student.achievementYear && <span className="clay-icon rounded-full px-3 py-1 text-xs font-bold text-[#774b2b]">{student.achievementYear}</span>}</div>
      <h3 className="break-words font-display text-2xl font-bold text-[#741d3b]">{student.name || 'Student name'}</h3>
      <p className="mt-3 break-words font-semibold text-[#774b2b]">{student.achievement || 'Achievement'}</p>
      {student.title && <p className="mt-2 break-words text-sm text-[#75605b]">{student.title}</p>}
      {student.description && <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-[#695b58]">{student.description}</p>}
    </div>
  </article>;
}
