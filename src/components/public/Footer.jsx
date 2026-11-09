import Link from "next/link";
import { Mail, MapPin, Phone, LockKeyhole } from "lucide-react";
import SchoolLogo from "./SchoolLogo";

export default function Footer({ s, logo }) {
  const links = [
    ["/", "Home"],
    ["/about", "About"],
    ["/admission", "Admission"],
    ["/facilities", "Facilities"],
    ["/gallery", "Gallery"],
    ["/cbse-information", "CBSE information"],
    ["/circulars", "Circulars"],
    ["/our-pride", "Our Pride"],
    ["/contact", "Contact"],
  ];
  const developer = process.env.DEVELOPER_CREDIT_NAME?.trim();
  const developerUrl = process.env.DEVELOPER_CREDIT_URL?.trim();
  const safeCreditUrl = /^https:\/\/[^\s<>]+$/i.test(developerUrl || "")
    ? developerUrl
    : null;
  return (
    <footer className="bg-[#371524] text-white/75">
      <div className="mx-auto grid max-w-[1300px] gap-10 px-5 py-16 md:grid-cols-[1.2fr_.8fr_1fr] md:px-10">
        <div>
          <SchoolLogo
            src={logo}
            alt="Original school crest"
            className="mb-4 h-16 w-16 bg-white object-contain"
            fallbackClassName="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white font-display text-sm font-bold text-[#74233e]"
          />
          <h2 className="max-w-sm font-display text-2xl font-bold text-white">
            {s.name}
          </h2>
        </div>
        <div>
          <h3 className="mb-4 font-display text-lg font-bold text-white">
            Quick links
          </h3>
          <ul className="grid grid-cols-2 gap-3 text-sm">
            {links.map(([href, label]) => (
              <li key={href}>
                <Link className="hover:text-[#f5d293]" href={href}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-4 font-display text-lg font-bold text-white">
            Get in touch
          </h3>
          <div className="space-y-4 text-sm">
            <p className="flex gap-3">
              <MapPin size={18} className="shrink-0 text-[#dbb47d]" />
              {s.address}
            </p>
            <a
              href={"tel:" + s.phone}
              className="flex items-center gap-3 hover:text-white"
            >
              <Phone size={18} className="text-[#dbb47d]" />
              {s.phone}
            </a>
            <a
              href={"mailto:" + s.email}
              className="flex items-center gap-3 break-all hover:text-white"
            >
              <Mail size={18} className="shrink-0 text-[#dbb47d]" />
              {s.email}
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/15 px-5 py-5">
        <div className="mx-auto flex max-w-[1220px] flex-col items-center justify-between gap-4 text-center text-xs md:flex-row md:text-left">
          <div>
            <p>
              © {new Date().getFullYear()} {s.name}. All rights reserved.
            </p>
            <p className="mt-2 text-[#f5d293]">
              DEsign by Apex@spire Digicom solution
            </p>
            {developer && (
              <p className="mt-2">
                Developed by{" "}
                {safeCreditUrl ? (
                  <a
                    href={safeCreditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#f5d293] underline underline-offset-4"
                  >
                    {developer}
                  </a>
                ) : (
                  developer
                )}
              </p>
            )}
          </div>
          <Link
            href="/admin/login"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#cba56e]/60 bg-white/5 px-5 py-2.5 font-semibold text-[#f5d293] transition hover:bg-white/10"
          >
            <LockKeyhole size={14} aria-hidden="true" />
            Admin Login
          </Link>
        </div>
      </div>
    </footer>
  );
}
