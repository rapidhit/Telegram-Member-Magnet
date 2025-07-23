import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileUpload } from "@/components/ui/file-upload";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Info } from "lucide-react";

interface MemberFileUploadProps {
  onMembersUploaded: (userIds: string[]) => void;
}

export function MemberFileUpload({ onMembersUploaded }: MemberFileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedData, setUploadedData] = useState<any>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("memberFile", file);
      const response = await apiRequest("POST", "/api/members/upload", formData);
      return response.json();
    },
    onSuccess: (data) => {
      setUploadedData(data);
      onMembersUploaded(data.userIds);
      toast({
        title: "File uploaded successfully",
        description: `Found ${data.count} valid user IDs`,
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
    onMembersUploaded([]);
  };

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
          <div className="p-4 bg-gray-50 rounded-lg">
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
            </div>
          </div>
        )}

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>File Format Requirements:</strong>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• One user ID per line</li>
              <li>• Numeric IDs (e.g., 123456789) or @usernames</li>
              <li>• No additional characters or formatting</li>
              <li>• Maximum 10,000 users per file</li>
            </ul>
            <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Only users who have interacted with your account or are publicly accessible can be added to channels. Use user IDs from your contact list or members of your existing channels for best results.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
