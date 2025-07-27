import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { ChannelSelector } from "@/components/channel-selector";
import { MemberFileUpload } from "@/components/member-file-upload";
import { RateLimitConfig } from "@/components/rate-limit-config";
import { ExecutionPanel } from "@/components/execution-panel";
import { AccountInfo } from "@/components/account-info";
import { RecentActivity } from "@/components/recent-activity";
import { HelpSupport } from "@/components/help-support";
import { ContactHelper } from "@/components/contact-helper";
import { ChannelMemberExtractor } from "@/components/channel-member-extractor";
import { TelegramConnection } from "@/components/telegram-connection";

import { Send, Wifi } from "lucide-react";

export default function Dashboard() {
  const [currentStep, setCurrentStep] = useState(1); // Start at step 1 for account connection
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [uploadedMembers, setUploadedMembers] = useState<string[]>([]);
  const [rateConfig, setRateConfig] = useState({ rateLimit: 4, batchDelay: 120 });

  // Check if user has a connected Telegram account
  const { data: account, isError } = useQuery<{
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    phone: string;
    apiId?: string;
    apiHash?: string; 
    isActive: boolean;
  }>({
    queryKey: ["/api/telegram/account", 1],
    enabled: true,
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always refetch to get latest account status
  });

  const isConnected = !!account && account.isActive;
  const hasApiCredentials = !!(account?.apiId && account?.apiHash);

  // Show connection screen if not connected, inactive, missing API credentials, or error
  if (!isConnected || !hasApiCredentials || isError) {
    return (
      <div className="bg-gray-50 min-h-screen py-12">
        <TelegramConnection onConnectionSuccess={() => setCurrentStep(2)} />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[hsl(207,90%,54%)] rounded-lg flex items-center justify-center">
                <Send className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Channel Member Manager</h1>
                <p className="text-sm text-gray-500">Safely add members to your Telegram channels</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 rounded-full border border-green-200">
                <div className="w-2 h-2 bg-[hsl(134,61%,54%)] rounded-full"></div>
                <span className="text-sm font-medium text-green-700">Connected</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8 mb-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-[hsl(134,61%,54%)] rounded-full flex items-center justify-center">
                <div className="w-3 h-3 text-white">✓</div>
              </div>
              <span className="ml-2 text-sm font-medium text-[hsl(134,61%,54%)]">Connect Account</span>
            </div>
            <div className="flex-1 h-px bg-gray-300"></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 ${currentStep >= 2 ? 'bg-[hsl(207,90%,54%)]' : 'bg-gray-300'} rounded-full flex items-center justify-center`}>
                <span className="text-white text-sm font-medium">2</span>
              </div>
              <span className={`ml-2 text-sm font-medium ${currentStep >= 2 ? 'text-[hsl(207,90%,54%)]' : 'text-gray-500'}`}>Select Channel</span>
            </div>
            <div className="flex-1 h-px bg-gray-300"></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 ${currentStep >= 3 ? 'bg-[hsl(207,90%,54%)]' : 'bg-gray-300'} rounded-full flex items-center justify-center`}>
                <span className="text-white text-sm font-medium">3</span>
              </div>
              <span className={`ml-2 text-sm font-medium ${currentStep >= 3 ? 'text-[hsl(207,90%,54%)]' : 'text-gray-500'}`}>Upload Members</span>
            </div>
            <div className="flex-1 h-px bg-gray-300"></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 ${currentStep >= 4 ? 'bg-[hsl(207,90%,54%)]' : 'bg-gray-300'} rounded-full flex items-center justify-center`}>
                <span className="text-white text-sm font-medium">4</span>
              </div>
              <span className={`ml-2 text-sm font-medium ${currentStep >= 4 ? 'text-[hsl(207,90%,54%)]' : 'text-gray-500'}`}>Execute</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Panel */}
          <div className="lg:col-span-2 space-y-6">
            

            {/* Channel Selection */}
            <ChannelSelector 
              selectedChannel={selectedChannel}
              onChannelSelect={(channel) => {
                setSelectedChannel(channel);
                if (channel && currentStep < 3) setCurrentStep(3);
              }}
            />

            {/* File Upload */}
            <MemberFileUpload 
              onMembersUploaded={(members) => {
                setUploadedMembers(members);
                if (members.length > 0 && currentStep < 4) setCurrentStep(4);
              }}
            />

            {/* Rate Limiting Configuration */}
            <RateLimitConfig 
              config={rateConfig}
              onConfigChange={setRateConfig}
            />

            {/* Execution Panel */}
            <ExecutionPanel 
              selectedChannel={selectedChannel}
              memberCount={uploadedMembers.length}
              rateConfig={rateConfig}
              userIds={uploadedMembers}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <AccountInfo />
            <ChannelMemberExtractor />
            <ContactHelper />
            <RecentActivity />
            <HelpSupport />
          </div>
        </div>
      </main>
    </div>
  );
}
