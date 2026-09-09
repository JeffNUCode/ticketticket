import { Skeleton } from "@/components/ui/skeleton";

export default function MovieLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  );
}
