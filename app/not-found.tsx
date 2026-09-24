import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="panel p-10 text-center">
      <p className="page-title">Page not found</p>
      <p className="mt-2 text-sm text-white/55">
        That link is wrong or the movie is no longer showing.
      </p>
      <Button variant="gold" className="mt-6" asChild>
        <Link href="/">See showtimes near you</Link>
      </Button>
    </div>
  );
}
