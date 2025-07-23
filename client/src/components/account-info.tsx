import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

export function AccountInfo() {
  const [telegramAccountId] = useState(1); // This would come from auth context

  const { data: account } = useQuery<{
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    phone: string;
    isActive: boolean;
  }>({
    queryKey: ["/api/telegram/account", 1], // This would be current user ID from auth
    enabled: true,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          Account Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-gray-400 font-medium text-lg">
              {account?.firstName?.[0] || "U"}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {account ? `${account.firstName || ""} ${account.lastName || ""}`.trim() : "Loading..."}
            </p>
            <p className="text-sm text-gray-500">
              {account?.username ? `@${account.username}` : "No username"}
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Phone:</span>
            <span className="font-medium">{account?.phone || "Loading..."}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Account Status:</span>
            <span className="text-[hsl(134,61%,54%)] font-medium">
              {account?.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full border-red-300 text-red-700 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect Account
        </Button>
      </CardContent>
    </Card>
  );
}
