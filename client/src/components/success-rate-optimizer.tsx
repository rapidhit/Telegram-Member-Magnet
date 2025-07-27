import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, Users, Download } from "lucide-react";

interface SuccessRateOptimizerProps {
  currentSuccessRate: number;
  totalMembers: number;
  addedMembers: number;
}

export function SuccessRateOptimizer({ currentSuccessRate, totalMembers, addedMembers }: SuccessRateOptimizerProps) {
  if (currentSuccessRate >= 50) return null; // Only show for low success rates

  const projectedTotal = Math.round((addedMembers / currentSuccessRate) * 100);
  const wastedEffort = Math.round(((totalMembers - projectedTotal) / totalMembers) * 100);

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-orange-900 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
          Success Rate Optimizer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Performance */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-white rounded-lg border border-orange-200">
            <div className="text-2xl font-bold text-orange-600">{currentSuccessRate}%</div>
            <p className="text-xs text-orange-700">Current Success</p>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border border-orange-200">
            <div className="text-2xl font-bold text-red-600">{wastedEffort}%</div>
            <p className="text-xs text-red-700">Wasted Effort</p>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border border-orange-200">
            <div className="text-2xl font-bold text-blue-600">{addedMembers}/{totalMembers}</div>
            <p className="text-xs text-blue-700">Added/Total</p>
          </div>
        </div>

        {/* Problem Explanation */}
        <div className="p-3 bg-white rounded-lg border border-orange-200">
          <h3 className="font-medium text-orange-900 mb-2">Why is your success rate low?</h3>
          <p className="text-sm text-orange-800">
            Your member list contains mostly <strong>inaccessible users</strong> - people who are not in your network, 
            have privacy settings, or come from random internet sources. This is typical for purchased or scraped lists.
          </p>
        </div>

        {/* Solution Options */}
        <div className="space-y-3">
          <h3 className="font-medium text-orange-900">Instant Solutions for 80-100% Success:</h3>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                // Navigate to channel extractor
                const extractorTab = document.querySelector('[data-tab="extract"]') as HTMLElement;
                if (extractorTab) extractorTab.click();
              }}
            >
              <Users className="w-4 h-4 mr-2" />
              Extract Your Channels (100%)
            </Button>
            
            <Button 
              variant="outline"
              className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => {
                // Navigate to contact helper
                const contactTab = document.querySelector('[data-tab="contacts"]') as HTMLElement;
                if (contactTab) contactTab.click();
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Get Contacts (80%)
            </Button>
          </div>
        </div>

        {/* Projected Improvement */}
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <h3 className="font-medium text-green-900">Projected Improvement</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-green-800"><strong>With Channel Members:</strong></p>
              <p className="text-green-700">800-950 out of 1000 added (95% success)</p>
            </div>
            <div>
              <p className="text-green-800"><strong>With Contact Helper:</strong></p>
              <p className="text-green-700">600-800 out of 1000 added (80% success)</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}