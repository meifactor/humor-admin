"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineBullet } from "@/components/line-bullet";

// Each section is a "line" with its own bullet, like a subway map.
const SECTIONS = [
  { href: "/", label: "Dashboard", letter: "D", color: "#EE352E", textColor: "#FFFFFF" },
  { href: "/media", label: "Media", letter: "M", color: "#FCCC0A", textColor: "#000000" },
  { href: "/users", label: "Users", letter: "U", color: "#00933C", textColor: "#FFFFFF" },
  { href: "/ratings", label: "Ratings", letter: "R", color: "#0039A6", textColor: "#FFFFFF" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="flex flex-wrap gap-1">
      {SECTIONS.map((section) => {
        const active =
          section.href === "/" ? pathname === "/" : pathname.startsWith(section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-bold transition ${
              active ? "bg-white text-black" : "text-ink-2 hover:bg-panel-2 hover:text-white"
            }`}
          >
            <LineBullet color={section.color} textColor={section.textColor} size={24}>
              {section.letter}
            </LineBullet>
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
