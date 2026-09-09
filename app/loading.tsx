import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-24 rounded-xl" />
        <Skeleton className="h-11 w-24 rounded-xl" />
        <Skeleton className="h-11 w-24 rounded-xl" />
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
