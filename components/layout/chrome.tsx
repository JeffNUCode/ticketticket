"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Clapperboard, Compass, Heart } from "lucide-react";
import { CITY_COOKIE } from "@/lib/cities";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Discover", icon: Compass },
  { href: "/cinemas", label: "Cinemas", icon: Clapperboard },
  { href: "/watchlist", label: "Saved", icon: Heart },
];

function useActive() {
  const path = usePathname();
  return (href: string) => path === href || (href !== "/" && path.startsWith(href));
}

/**
 * URL city wins; cookie covers a tab switch that dropped the query. `useSearchParams` opts the
 * caller into a CSR bailout, so only the Suspense *child* may call this — never the fallback.
 */
function useCityHref() {
  const fromUrl = useSearchParams().get("city");
  return (href: string) => {
    const city =
      fromUrl ??
      (typeof document === "undefined"
        ? null
        : document.cookie.match(new RegExp(`(?:^|; )${CITY_COOKIE}=([^;]+)`))?.[1]);
    return city ? `${href}?city=${city}` : href;
  };
}

type Href = (href: string) => string;

const plain: Href = (href) => href;

function BottomLinks({ href = plain }: { href?: Href }) {
  const isActive = useActive();
  return (
    <>
      {ITEMS.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={href(item.href)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
                active ? "text-zap" : "text-white/45",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </>
  );
}

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-3">
        <Suspense fallback={<BottomLinks />}>
          <CityBottomLinks />
        </Suspense>
      </ul>
    </nav>
  );
}

function HeaderLinks({ href = plain }: { href?: Href }) {
  const isActive = useActive();
  return (
    <>
      {ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={href(item.href)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 font-display text-sm font-bold",
              active ? "bg-zap text-black" : "text-white/70 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-4 px-4">
        <Suspense fallback={<LogoLink href="/" />}>
          <HomeLogo />
        </Suspense>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          <Suspense fallback={<HeaderLinks />}>
            <CityHeaderLinks />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

function CityBottomLinks() {
  return <BottomLinks href={useCityHref()} />;
}

function CityHeaderLinks() {
  return <HeaderLinks href={useCityHref()} />;
}

function HomeLogo() {
  const href = useCityHref()("/");
  return <LogoLink href={href} />;
}

function LogoLink({ href }: { href: string }) {
  return (
    <Link href={href} aria-label="GoSee! home" className="press shrink-0">
      <Image
        src="/logo.png"
        alt=""
        width={1024}
        height={512}
        priority
        className="h-10 w-auto sm:h-12"
      />
    </Link>
  );
}
