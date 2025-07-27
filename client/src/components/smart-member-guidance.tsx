import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, ArrowRight, Users, Download } from "lucide-react";

export function SmartMemberGuidance() {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-orange-900 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
          Member Addition Success Rate Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Success Rate Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 mb-2">0-15%</div>
              <p className="text-sm font-medium text-red-800">Random Internet Lists</p>
              <p className="text-xs text-red-600 mt-1">What you're currently using</p>
            </div>
          </div>
          
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-2">80-90%</div>
              <p className="text-sm font-medium text-blue-800">Contact Helper Tool</p>
              <p className="text-xs text-blue-600 mt-1">Your accessible contacts</p>
            </div>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">95-100%</div>
              <p className="text-sm font-medium text-green-800">Your Channel Members</p>
              <p className="text-xs text-green-600 mt-1">Guaranteed accessible</p>
            </div>
          </div>
        </div>

        {/* Action Steps */}
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h3 className="font-medium text-yellow-900 mb-3">For 80-100% Success Rate:</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-green-600">1</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">Use Channel Member Extractor</p>
                <p className="text-xs text-yellow-700">Extract members from channels you admin for 100% success</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600">2</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">Use Contact Helper Tool</p>
                <p className="text-xs text-yellow-700">Download your accessible contacts for 80-90% success</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-red-600">✗</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">Avoid Random Internet Lists</p>
                <p className="text-xs text-yellow-700">Most users are inaccessible, resulting in 0-15% success</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
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
            Extract From My Channels
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
            Get Accessible Contacts
          </Button>
        </div>

        {/* Current Status Alert */}
        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-800">
                Your current list: 8 out of 9996 members added (0.08% success)
              </p>
              <p className="text-xs text-orange-700 mt-1">
                This low success rate is typical for random internet lists. Switch to the recommended methods above for guaranteed better results.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}