import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";

export default function AppLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <div className="flex min-h-14 flex-col justify-center gap-2 pt-4 md:min-h-[72px] md:pt-6">
        <Skeleton className="h-2.5 w-32" />
        <Skeleton className="h-6 w-48" />
      </div>
      <Card className="flex flex-col gap-3">
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-14 w-full" />
      </Card>
      <Card flush>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </Card>
    </div>
  );
}
