import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Info, CheckCircle, AlertCircle } from "lucide-react";

interface MemberFileUploadProps {
  onMembersUploaded: (userIds: string[]) => void;
}

export function MemberFileUpload({ onMembersUploaded }: MemberFileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [validationData, setValidationData] = useState<any>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("memberFile", file);
      const response = await apiRequest("POST", "/api/members/upload", formData);
      return response.json();
    },
    onSuccess: (data) => {
      // Set the uploaded data immediately
      setUploadedData(data);
      onMembersUploaded(data.userIds);
      
      toast({
        title: "File uploaded successfully",
        description: `${data.count} users loaded. Click 'Validate Users' to check accessibility before starting.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    uploadMutation.mutate(file);
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    setUploadedData(null);
    setValidationData(null);
    onMembersUploaded([]);
  };

  const validateMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const response = await apiRequest("POST", `/api/telegram/validate-users/1`, {
        userIds
      });
      return response.json();
    },
    onSuccess: (validation) => {
      setValidationData(validation);
      const updatedData = {
        ...uploadedData,
        accessibleCount: validation.accessible.length,
        inaccessibleCount: validation.inaccessible.length,
        successRate: validation.successRate
      };
      setUploadedData(updatedData);
      onMembersUploaded(validation.accessible); // Update with accessible users only
      
      if (validation.accessible.length === 0) {
        toast({
          title: "No accessible users found",
          description: "None of the users can be added. Try using usernames instead of IDs.",
          variant: "destructive",
        });
      } else if (validation.inaccessible.length > 0) {
        toast({
          title: "Validation complete",
          description: `${validation.accessible.length} accessible, ${validation.inaccessible.length} inaccessible (${validation.successRate}% success rate)`,
        });
      } else {
        toast({
          title: "All users accessible",
          description: `${validation.accessible.length} users ready for addition (100% success rate)`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Validation failed",
        description: error.message || "Could not validate users. They will be attempted during addition.",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          Upload Member List
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FileUpload
          selectedFile={selectedFile}
          onFileSelect={handleFileSelect}
          onFileRemove={handleFileRemove}
        />

        {uploadMutation.isPending && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(207,90%,54%)] mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Processing file...</p>
          </div>
        )}

        {uploadedData && (
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-[hsl(207,90%,54%)]">📄</div>
                <div>
                  <p className="font-medium text-gray-900">{uploadedData.filename}</p>
                  <p className="text-sm text-gray-500">
                    {uploadedData.count.toLocaleString()} user IDs detected
                  </p>
                </div>
              </div>
              
              {/* Validate Button */}
              {!validationData && (
                <Button
                  onClick={() => validateMutation.mutate(uploadedData.userIds)}
                  disabled={validateMutation.isPending}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  {validateMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span>Validating...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Validate Users</span>
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {uploadedData.accessibleCount !== undefined && (
              <div className="border-t pt-3">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-2 bg-green-50 rounded">
                    <div className="text-lg font-semibold text-green-700">
                      {uploadedData.accessibleCount}
                    </div>
                    <div className="text-xs text-green-600">Accessible</div>
                  </div>
                  <div className="p-2 bg-red-50 rounded">
                    <div className="text-lg font-semibold text-red-700">
                      {uploadedData.inaccessibleCount}
                    </div>
                    <div className="text-xs text-red-600">Inaccessible</div>
                  </div>
                  <div className="p-2 bg-blue-50 rounded">
                    <div className="text-lg font-semibold text-blue-700">
                      {uploadedData.successRate}%
                    </div>
                    <div className="text-xs text-blue-600">Success Rate</div>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2 text-center">
                  Only accessible users will be processed for addition
                </p>
              </div>
            )}
          </div>
        )}

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>File Format Requirements:</strong>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• One user identifier per line</li>
              <li>• Numeric IDs (e.g., 123456789)</li>
              <li>• Usernames with @ (e.g., @john_doe)</li>
              <li>• Usernames without @ (e.g., john_doe)</li>
              <li>• No additional characters or formatting</li>
              <li>• Maximum 10,000 users per file</li>
            </ul>
            <div className="mt-3 space-y-2">
              <div className="p-2 bg-green-50 rounded border border-green-200">
                <p className="text-sm text-green-800">
                  <strong>✅ RECOMMENDED: Use Usernames</strong>
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Usernames (@username) have the highest success rate because they're publicly resolvable. 
                  Get usernames from channel member lists, user profiles, or by searching in Telegram.
                </p>
              </div>
              
              <div className="p-2 bg-red-50 rounded border border-red-200">
                <p className="text-sm text-red-800">
                  <strong>⚠️ LIMITED SUCCESS: Numeric User IDs</strong>
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Numeric IDs (123456789) only work for users in your contacts, shared groups, or previous conversations. 
                  Random IDs from external sources typically fail.
                </p>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
