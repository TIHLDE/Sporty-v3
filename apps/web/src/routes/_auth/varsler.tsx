import { Button } from "@sporty/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { NotificationList } from "@/components/notifications";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/varsler")({
  component: NotificationsComponent,
});

function NotificationsComponent() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const unread = useQuery(trpc.notifications.unread.queryOptions());
  const hasUnread = (unread.data?.notifications ?? 0) > 0;
  const readAll = useMutation(
    trpc.notifications.readAll.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.notifications.pathKey(),
        }),
    }),
  );

  return (
    <div className="grid grid-cols-1 gap-6 w-4xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Varsler</h1>
        {hasUnread && (
          <Button
            variant="ghost"
            disabled={readAll.isPending}
            onClick={() => readAll.mutate()}
          >
            Merk alle som lest
          </Button>
        )}
      </div>
      <NotificationList />
    </div>
  );
}
