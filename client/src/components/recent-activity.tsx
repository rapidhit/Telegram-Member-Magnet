import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, XCircle, Users } from "lucide-react";

export function RecentActivity() {
  const [telegramAccountId] = useState(1); // This would come from auth context

  const { data: activities = [] } = useQuery<Array<{
    id: number;
    action: string;
    status: string;
    channelTitle: string | null;
    createdAt: string;
  }>>({
    queryKey: ["/api/activity", telegramAccountId],
    enabled: !!telegramAccountId,
  });

  const getActivityIcon = (status: string, action: string) => {
    if (status === "success") return <CheckCircle className="w-4 h-4 text-[hsl(134,61%,54%)]" />;
    if (status === "error") return <XCircle className="w-4 h-4 text-[hsl(0,84%,60%)]" />;
    return <Users className="w-4 h-4 text-[hsl(207,90%,54%)]" />;
  };

  const getActivityBgColor = (status: string) => {
    if (status === "success") return "bg-[hsl(134,61%,54%)]";
    if (status === "error") return "bg-[hsl(0,84%,60%)]";
    return "bg-[hsl(207,90%,54%)]";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((activity: any) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`w-8 h-8 ${getActivityBgColor(activity.status)} rounded-full flex items-center justify-center flex-shrink-0`}>
                  {getActivityIcon(activity.status, activity.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.action.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </p>
                  {activity.channelTitle && (
                    <p className="text-sm text-gray-500">{activity.channelTitle}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500">No recent activity</p>
          </div>
        )}

        <Button variant="ghost" className="w-full text-[hsl(207,90%,54%)] hover:text-[hsl(207,90%,44%)]">
          View All Activity
        </Button>
      </CardContent>
    </Card>
  );
}
