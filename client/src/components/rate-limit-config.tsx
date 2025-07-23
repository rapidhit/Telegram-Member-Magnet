import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";

interface RateLimitConfigProps {
  config: {
    rateLimit: number;
    batchDelay: number;
  };
  onConfigChange: (config: { rateLimit: number; batchDelay: number }) => void;
}

export function RateLimitConfig({ config, onConfigChange }: RateLimitConfigProps) {
  const handleRateLimitChange = (value: string) => {
    onConfigChange({
      ...config,
      rateLimit: parseInt(value),
    });
  };

  const handleBatchDelayChange = (value: string) => {
    onConfigChange({
      ...config,
      batchDelay: parseInt(value),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          Safety Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="rate-limit" className="text-sm font-medium text-gray-700">
              Additions per Minute
            </Label>
            <Select value={config.rateLimit.toString()} onValueChange={handleRateLimitChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 per minute (Safest)</SelectItem>
                <SelectItem value="4">4 per minute (Recommended)</SelectItem>
                <SelectItem value="5">5 per minute (Moderate Risk)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-delay" className="text-sm font-medium text-gray-700">
              Delay Between Batches
            </Label>
            <Select value={config.batchDelay.toString()} onValueChange={handleBatchDelayChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="60">1 minute</SelectItem>
                <SelectItem value="120">2 minutes</SelectItem>
                <SelectItem value="300">5 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Account Safety Warning</strong>
            <br />
            Adding members too quickly may result in temporary or permanent account restrictions. 
            Use conservative settings to protect your account.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
