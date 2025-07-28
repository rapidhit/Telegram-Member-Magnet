import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Target, Zap, Users } from "lucide-react";

export function SuccessGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-green-900 flex items-center">
          <Target className="w-5 h-5 mr-2 text-green-600" />
          100% Success Rate Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Method 1: Your Channels */}
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-green-900 mb-2">Method 1: Extract From Your Channels</h3>
              <p className="text-sm text-green-800 mb-3">
                <strong>Success Rate: 95-100%</strong> | <strong>Speed: 10x faster</strong>
              </p>
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-green-700">
                    Use Channel Member Extractor on channels where you are admin
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-green-700">
                    Members from your channels are guaranteed accessible
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-green-700">
                    Fast processing with minimal rate limits
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Method 2: Contact Helper */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-3">
            <Users className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 mb-2">Method 2: Contact Helper Tool</h3>
              <p className="text-sm text-blue-800 mb-3">
                <strong>Success Rate: 70-85%</strong> | <strong>Speed: 5x faster</strong>
              </p>
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-blue-700">
                    Download accessible contacts from your Telegram account
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-blue-700">
                    Pre-verified users that can be added to channels
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-blue-700">
                    No rate limits or accessibility issues
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fast-Track Mode */}
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-start space-x-3">
            <Zap className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-purple-900 mb-2">NEW: Fast-Track Mode</h3>
              <p className="text-sm text-purple-800 mb-3">
                Our system now automatically pre-filters users for accessibility before attempting to add them.
              </p>
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-purple-700">
                    Checks first 50 users for accessibility in seconds
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-purple-700">
                    Only processes users that can actually be added
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-purple-700">
                    Eliminates wasted time on inaccessible users
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
          <h4 className="font-medium text-orange-800 mb-1">❌ What NOT to Use</h4>
          <p className="text-sm text-orange-700">
            Random username lists from the internet typically have 5-15% success rates and will result in
            mostly failed attempts. Use the methods above for guaranteed results.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}