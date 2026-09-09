import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="panel p-10 text-center">
      <p className="page-title">Not playing</p>
      <p className="mt-2 text-sm text-white/55">That movie or page is not in the catalog.</p>
      <Button variant="gold" className="mt-6" asChild>
        <Link href="/">Back to discover</Link>
      </Button>
    </div>
  );
}
