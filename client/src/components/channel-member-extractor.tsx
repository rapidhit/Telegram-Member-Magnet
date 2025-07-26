import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Download, Users, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChannelMemberExtractor() {
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [extractLimit, setExtractLimit] = useState<number>(2000);
  const [extractedMembers, setExtractedMembers] = useState<string[]>([]);
  const { toast } = useToast();

  // Get available channels (ALL channels for extraction, not just admin ones)
  const { data: channels, isLoading: channelsLoading, refetch: refetchChannels } = useQuery({
    queryKey: ["/api/telegram/all-channels", 1],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/telegram/all-channels/1");
      return response.json();
    },
  });

  const extractMembersMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChannel) throw new Error("Please select a channel first");
      
      const response = await apiRequest("GET", `/api/telegram/channel-members/1/${selectedChannel}?limit=${extractLimit}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to extract members");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setExtractedMembers(data.members || []);
      const stats = data.stats || {};
      toast({
        title: "Members extracted successfully",
        description: `Found ${data.count || 0} unique members (${stats.usernameFormat || 0} with @usernames, ${stats.numericFormat || 0} numeric IDs)`,
      });
    },
    onError: (error: any) => {
      console.error("Member extraction error:", error);
      
      if (error.message?.includes('Rate limited')) {
        toast({
          title: "Rate Limited",
          description: "Telegram has temporarily limited requests. Please wait a few minutes and try again.",
          variant: "destructive",
        });
      } else if (error.message?.includes('permissions')) {
        toast({
          title: "Permission Error",
          description: "Cannot access members of this channel. You may not have sufficient permissions.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to extract members",
          description: error.message || "Unknown error occurred",
          variant: "destructive",
        });
      }
    },
  });

  const downloadMembers = () => {
    if (extractedMembers.length === 0) return;

    const content = extractedMembers.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const selectedChannelName = channels?.find((c: any) => c.id === selectedChannel)?.title || selectedChannel;
    a.download = `${selectedChannelName}_members.txt`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download started",
      description: `${selectedChannelName}_members.txt saved to your device`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Channel Member Extractor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Extract member usernames from channels you're part of. This tool will fetch members in chunks to get complete member lists.
            <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
              <p className="text-sm text-green-800">
                <strong>Enhanced Extraction:</strong> The tool now fetches members in chunks to get as many members as possible from each channel, up to your specified limit.
              </p>
            </div>
            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>All Your Channels:</strong> Now shows ALL channels you're part of (👑 = admin, 👤 = member). You can extract members from any channel you belong to.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="channel-select">Select Channel</Label>
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger id="channel-select">
                <SelectValue placeholder="Choose a channel to extract members from" />
              </SelectTrigger>
              <SelectContent>
                {channelsLoading ? (
                  <SelectItem value="loading" disabled>Loading channels...</SelectItem>
                ) : channels?.length > 0 ? (
                  channels.map((channel: any) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.title} ({channel.memberCount?.toLocaleString() || 'Unknown'} members) {channel.isAdmin ? '👑' : '👤'}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No channels available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="extract-limit">Member Limit</Label>
            <Input
              id="extract-limit"
              type="number"
              value={extractLimit}
              onChange={(e) => setExtractLimit(parseInt(e.target.value) || 2000)}
              min={100}
              max={5000}
              placeholder="Number of members to extract"
            />
            <p className="text-xs text-gray-500 mt-1">
              How many members to extract (100-5000). Higher numbers may take longer but will get more complete member lists.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => refetchChannels()}
            disabled={channelsLoading}
            variant="ghost"
            size="sm"
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", channelsLoading && "animate-spin")} />
            Refresh Channels
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => extractMembersMutation.mutate()}
            disabled={extractMembersMutation.isPending || !selectedChannel}
            variant="outline"
            className="flex-1"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${extractMembersMutation.isPending ? 'animate-spin' : ''}`} />
            Extract Members
          </Button>
          
          <Button
            onClick={downloadMembers}
            disabled={extractedMembers.length === 0}
            className="bg-[hsl(134,61%,54%)] hover:bg-[hsl(134,61%,44%)]"
          >
            <Download className="w-4 h-4 mr-2" />
            Download List
          </Button>
        </div>

        {extractedMembers.length > 0 && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Extracted Members</h4>
              <div className="text-right">
                <span className="text-sm text-gray-500">{extractedMembers.length} unique members</span>
                <div className="text-xs text-gray-400">
                  {extractedMembers.filter(m => m.startsWith('@')).length} @usernames, {' '}
                  {extractedMembers.filter(m => !m.startsWith('@')).length} numeric IDs
                </div>
              </div>
            </div>
            <div className="max-h-32 overflow-y-auto text-sm text-gray-600 space-y-1">
              {extractedMembers.slice(0, 10).map((member, index) => (
                <div key={index} className="font-mono">
                  {member}
                </div>
              ))}
              {extractedMembers.length > 10 && (
                <div className="text-gray-400 italic">
                  ... and {extractedMembers.length - 10} more
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Download the full list to use in your member addition file
            </p>
          </div>
        )}

        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
          <p className="font-medium text-blue-800 mb-1">How it works:</p>
          <ol className="text-blue-700 space-y-1 ml-4 list-decimal">
            <li>Select any channel you're a member of</li>
            <li>Set how many members you want to extract</li>
            <li>Click "Extract Members" to get the list</li>
            <li>Download the file and upload it to the Member Upload tool</li>
            <li>Start adding members with high success rates!</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}