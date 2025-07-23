import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Play, Eye, Pause } from "lucide-react";

interface ExecutionPanelProps {
  selectedChannel: any;
  memberCount: number;
  rateConfig: {
    rateLimit: number;
    batchDelay: number;
  };
  userIds: string[];
}

export function ExecutionPanel({ 
  selectedChannel, 
  memberCount, 
  rateConfig, 
  userIds 
}: ExecutionPanelProps) {
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const { toast } = useToast();

  const createJobMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChannel || userIds.length === 0) {
        throw new Error("Missing required data");
      }

      const response = await apiRequest("POST", "/api/jobs/create", {
        telegramAccountId: 1, // This would come from auth context
        channelId: selectedChannel.id,
        totalMembers: userIds.length,
        memberList: userIds,
        rateLimit: rateConfig.rateLimit,
        batchDelay: rateConfig.batchDelay,
      });
      return response.json();
    },
    onSuccess: (job) => {
      setActiveJobId(job.id);
      startJobMutation.mutate(job.id);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const startJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/start`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Job started",
        description: "Member addition process has begun",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: currentJob } = useQuery<{
    id: number;
    status: string;
    addedMembers: number;
    failedMembers: number;
    totalMembers: number;
  }>({
    queryKey: ["/api/jobs", activeJobId],
    enabled: !!activeJobId,
    refetchInterval: activeJobId ? 5000 : false, // Poll every 5 seconds when job is active
  });

  const estimatedTimeMinutes = memberCount > 0 ? Math.ceil(memberCount / rateConfig.rateLimit) : 0;
  const estimatedHours = Math.floor(estimatedTimeMinutes / 60);
  const remainingMinutes = estimatedTimeMinutes % 60;

  const canStart = selectedChannel && memberCount > 0 && !currentJob?.status?.includes("running");
  const isProcessing = currentJob?.status === "running" || createJobMutation.isPending || startJobMutation.isPending;

  const progressPercentage = currentJob 
    ? ((currentJob.addedMembers + currentJob.failedMembers) / currentJob.totalMembers) * 100 
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Execute Member Addition
          </CardTitle>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button
              onClick={() => createJobMutation.mutate()}
              disabled={!canStart || isProcessing}
              className="bg-[hsl(134,61%,54%)] hover:bg-[hsl(134,61%,44%)]"
            >
              <Play className="w-4 h-4 mr-2" />
              {isProcessing ? "Starting..." : "Start Addition"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Operation Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Target Channel</p>
            <p className="font-medium text-gray-900">
              {selectedChannel?.title || "No channel selected"}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Members to Add</p>
            <p className="font-medium text-gray-900">
              {memberCount.toLocaleString()} users
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Estimated Time</p>
            <p className="font-medium text-gray-900">
              {estimatedHours > 0 ? `${estimatedHours}h ` : ""}
              {remainingMinutes}m
            </p>
          </div>
        </div>

        {/* Progress Section */}
        {currentJob && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Progress</h3>
              <div className="flex items-center space-x-2">
                <Badge variant={currentJob.status === "running" ? "default" : "secondary"}>
                  {currentJob.status}
                </Badge>
                {currentJob.status === "running" && (
                  <Button variant="outline" size="sm">
                    <Pause className="w-4 h-4 mr-1" />
                    Pause
                  </Button>
                )}
              </div>
            </div>

            <Progress value={progressPercentage} className="w-full" />

            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-[hsl(134,61%,54%)]">
                  {currentJob.addedMembers || 0}
                </p>
                <p className="text-sm text-gray-600">Added</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[hsl(0,84%,60%)]">
                  {currentJob.failedMembers || 0}
                </p>
                <p className="text-sm text-gray-600">Failed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-600">
                  {currentJob.totalMembers - (currentJob.addedMembers + currentJob.failedMembers)}
                </p>
                <p className="text-sm text-gray-600">Remaining</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[hsl(207,90%,54%)]">
                  {rateConfig.rateLimit}/min
                </p>
                <p className="text-sm text-gray-600">Current Rate</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
