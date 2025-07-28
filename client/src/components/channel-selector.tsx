import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { Users, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Channel {
  id: string;
  title: string;
  username?: string;
  memberCount: number;
  isAdmin: boolean;
}

interface ChannelSelectorProps {
  selectedChannel: Channel | null;
  onChannelSelect: (channel: Channel) => void;
}

export function ChannelSelector({ selectedChannel, onChannelSelect }: ChannelSelectorProps) {
  const [telegramAccountId] = useState(1); // This would come from auth context

  const { data: channels = [], isLoading, refetch } = useQuery<Channel[]>({
    queryKey: ["/api/telegram/channels", telegramAccountId],
    enabled: !!telegramAccountId,
  });

  const handleRefresh = () => {
    refetch();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Select Target Channel
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="text-[hsl(207,90%,54%)] hover:text-[hsl(207,90%,44%)]"
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border border-gray-200 rounded-lg animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : channels && channels.length > 0 ? (
          <div className="space-y-3">
            {channels.map((channel: Channel) => (
              <div
                key={channel.id}
                onClick={() => onChannelSelect(channel)}
                className={cn(
                  "p-4 border border-gray-200 rounded-lg hover:border-[hsl(207,90%,54%)] hover:bg-blue-50 cursor-pointer transition-colors",
                  selectedChannel?.id === channel.id && "border-[hsl(207,90%,54%)] bg-blue-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-[hsl(207,90%,54%)] rounded-full flex items-center justify-center">
                      <Users className="text-white h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{channel.title}</h3>
                      {channel.username && (
                        <p className="text-sm text-gray-500">@{channel.username}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {channel.memberCount.toLocaleString()} members
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {channel.isAdmin ? (
                      <Badge 
                        variant="secondary" 
                        className="bg-[hsl(134,61%,54%)] text-white hover:bg-[hsl(134,61%,44%)]"
                      >
                        Admin
                      </Badge>
                    ) : (
                      <Badge 
                        variant="secondary" 
                        className="bg-blue-500 text-white hover:bg-blue-600"
                      >
                        Member
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No channels found</p>
            <p className="text-sm text-gray-400 mt-1">
              Connect your Telegram account to see available channels
            </p>
          </div>
        )}

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Admin Access Required</strong>
            <br />
            You can only add members to channels where you have admin privileges.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
