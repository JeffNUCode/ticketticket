import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <Skeleton className="h-14 w-14 rounded-2xl" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-36 w-24 rounded-xl" />
        <Skeleton className="h-36 w-24 rounded-xl" />
        <Skeleton className="h-36 w-24 rounded-xl" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
