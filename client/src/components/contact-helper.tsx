import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCw, Users } from "lucide-react";

export function ContactHelper() {
  const [contacts, setContacts] = useState<string[]>([]);
  const { toast } = useToast();

  const getContactsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/telegram/contacts/1");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch contacts");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setContacts(data.contacts || []);
      toast({
        title: "Contacts retrieved successfully",
        description: `Found ${data.count || 0} accessible users`,
      });
    },
    onError: (error: any) => {
      console.error("Contact fetch error:", error);
      
      if (error.message?.includes('Rate limited')) {
        toast({
          title: "Rate Limited",
          description: "Telegram has temporarily limited requests. Please wait a few minutes and try again.",
          variant: "destructive",
        });
      } else if (error.message?.includes('disconnected')) {
        toast({
          title: "Connection Issue",
          description: "Telegram account may be disconnected. Try reconnecting your account.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to get contacts",
          description: error.message || "Unknown error occurred",
          variant: "destructive",
        });
      }
    },
  });

  const downloadContacts = () => {
    if (contacts.length === 0) return;
    
    const content = contacts.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'accessible_contacts.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "File downloaded",
      description: "accessible_contacts.txt saved to your device",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Contact Helper
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Get a list of users you can successfully add to channels. This includes your contacts, 
            users from shared groups, and users you've messaged before.
            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> If you're rate limited, manually collect usernames (@username) 
                from channel member lists for best results. This avoids API limits.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button
            onClick={() => getContactsMutation.mutate()}
            disabled={getContactsMutation.isPending}
            variant="outline"
            className="flex-1"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${getContactsMutation.isPending ? 'animate-spin' : ''}`} />
            Get Accessible Users
          </Button>
          
          <Button
            onClick={downloadContacts}
            disabled={contacts.length === 0}
            className="bg-[hsl(134,61%,54%)] hover:bg-[hsl(134,61%,44%)]"
          >
            <Download className="w-4 h-4 mr-2" />
            Download List
          </Button>
        </div>

        {contacts.length > 0 && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Accessible Users</h4>
              <span className="text-sm text-gray-500">{contacts.length} total</span>
            </div>
            <div className="max-h-32 overflow-y-auto text-sm text-gray-600 space-y-1">
              {contacts.slice(0, 10).map((contact, index) => (
                <div key={index} className="font-mono">
                  {contact}
                </div>
              ))}
              {contacts.length > 10 && (
                <div className="text-gray-400 italic">
                  ... and {contacts.length - 10} more
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Download the full list to use in your member addition file
            </p>
          </div>
        )}

        {/* Manual collection guide if contacts helper fails */}
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm">
          <p className="font-medium text-yellow-800 mb-2">Alternative: Manual Collection</p>
          <p className="text-yellow-700 mb-2">
            If the automatic contact helper is rate limited, you can manually collect usernames:
          </p>
          <ol className="text-yellow-700 space-y-1 ml-4 list-decimal">
            <li>Go to any Telegram channel</li>
            <li>Click on member count to view members</li>
            <li>Copy usernames that start with @ (like @john_doe)</li>
            <li>Create a text file with one username per line</li>
            <li>Upload the file using the member upload tool above</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}