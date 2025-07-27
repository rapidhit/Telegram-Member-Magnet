import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, MessageCircle, AlertTriangle } from "lucide-react";

export function HelpSupport() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
          <HelpCircle className="w-5 h-5 mr-2 text-blue-600" />
          Help & Support
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rate Limit Warning */}
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900 mb-2">Rate Limit Protection Active</h3>
              <p className="text-sm text-red-800 mb-3">
                Our system now prevents severe rate limits that can cause 20+ hour delays. 
                If you encounter "fail fail fail" errors, this means Telegram is blocking access 
                to those specific users.
              </p>
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-red-700">
                    <strong>Solution:</strong> Use the Contact Helper tool to download accessible contacts
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-red-700">
                    <strong>Better:</strong> Extract members from channels you admin for 100% success rates
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Best Practices</h3>
          <div className="space-y-2">
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-gray-700">
                <strong>Highest Success:</strong> Use member lists from channels you admin (90-100% success)
              </p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-gray-700">
                <strong>Good Success:</strong> Use your accessible contacts from Contact Helper (60-80% success)
              </p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-gray-700">
                <strong>Limited Success:</strong> Random usernames/IDs from internet (10-30% success)
              </p>
            </div>
          </div>
        </div>

        {/* Troubleshooting */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Common Issues</h3>
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-medium text-yellow-800 mb-1">Members Counted But Not Actually Added</h4>
              <p className="text-sm text-yellow-700">
                <strong>Fixed!</strong> Our new system only counts members that are ACTUALLY added to channels.
                Previous false counting has been eliminated.
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <h4 className="font-medium text-orange-800 mb-1">Severe Rate Limits (20+ Hours)</h4>
              <p className="text-sm text-orange-700">
                <strong>Fixed!</strong> System now stops before triggering severe rate limits.
                Use Contact Helper or channel member extraction for better results.
              </p>
            </div>
          </div>
        </div>

        {/* Contact Support */}
        <div className="border-t pt-6">
          <h3 className="font-medium text-gray-900 mb-3">Need More Help?</h3>
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <p className="font-medium text-blue-900">Contact Support</p>
              <p className="text-sm text-blue-700">
                Get advanced member collection strategies and troubleshooting
              </p>
            </div>
            <Button
              onClick={() => window.open('https://t.me/tele_magnet_bot', '_blank')}
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Contact
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
