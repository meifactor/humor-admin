"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineBullet } from "@/components/line-bullet";

// Sections grouped like subway lines: each group shares a line color.
const GROUPS = [
  {
    label: "Content",
    color: "#EE352E",
    textColor: "#FFFFFF",
    sections: [
      { href: "/", label: "Dashboard", letter: "D" },
      { href: "/media", label: "Media", letter: "M" },
      { href: "/images", label: "Images", letter: "I" },
      { href: "/users", label: "Users", letter: "U" },
      { href: "/ratings", label: "Ratings", letter: "R" },
    ],
  },
  {
    label: "AI pipeline",
    color: "#FCCC0A",
    textColor: "#000000",
    sections: [
      { href: "/prompts", label: "Prompt chains", letter: "P" },
      { href: "/manage/terms", label: "Terms", letter: "T" },
      { href: "/manage/examples", label: "Examples", letter: "E" },
      { href: "/manage/models", label: "Models", letter: "L" },
      { href: "/manage/providers", label: "Providers", letter: "V" },
      { href: "/requests", label: "Requests", letter: "Q" },
      { href: "/responses", label: "Responses", letter: "S" },
    ],
  },
  {
    label: "Access",
    color: "#00933C",
    textColor: "#FFFFFF",
    sections: [
      { href: "/manage/domains", label: "Signup domains", letter: "A" },
      { href: "/manage/emails", label: "Whitelisted emails", letter: "W" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="space-y-2">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex flex-wrap items-center gap-1">
          <span className="w-24 shrink-0 text-xs font-bold tracking-wide text-ink-3 uppercase">{group.label}</span>
          {group.sections.map((section) => {
            const active =
              section.href === "/" ? pathname === "/" : pathname === section.href || pathname.startsWith(`${section.href}/`);
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full py-0.5 pr-3 pl-0.5 text-sm font-bold transition ${
                  active ? "bg-white text-black" : "text-ink-2 hover:bg-panel-2 hover:text-white"
                }`}
              >
                <LineBullet color={group.color} textColor={group.textColor} size={22}>
                  {section.letter}
                </LineBullet>
                {section.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
