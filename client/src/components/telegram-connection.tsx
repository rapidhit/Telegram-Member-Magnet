import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Send, AlertTriangle, ExternalLink, CheckCircle } from "lucide-react";

const credentialsSchema = z.object({
  apiId: z.string().min(1, "API ID is required"),
  apiHash: z.string().min(1, "API Hash is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
});

const verificationSchema = z.object({
  code: z.string().min(4, "Verification code is required (at least 4 digits)"),
});

type CredentialsForm = z.infer<typeof credentialsSchema>;
type VerificationForm = z.infer<typeof verificationSchema>;

interface TelegramConnectionProps {
  onConnectionSuccess: () => void;
}

export function TelegramConnection({ onConnectionSuccess }: TelegramConnectionProps) {
  const [step, setStep] = useState<"credentials" | "verification">("credentials");
  const [connectionData, setConnectionData] = useState<{
    phoneCodeHash: string;
    sessionString: string;
    apiId: string;
    apiHash: string;
    phoneNumber: string;
  } | null>(null);
  const { toast } = useToast();

  const credentialsForm = useForm<CredentialsForm>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      apiId: "",
      apiHash: "",
      phoneNumber: "",
    },
  });

  const verificationForm = useForm<VerificationForm>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      code: "",
    },
  });

  const sendCodeMutation = useMutation({
    mutationFn: async (data: CredentialsForm) => {
      const response = await apiRequest("POST", "/api/telegram/send-code", data);
      return response.json();
    },
    onSuccess: (data, variables) => {
      setConnectionData({
        phoneCodeHash: data.phoneCodeHash,
        sessionString: data.sessionString,
        apiId: variables.apiId,
        apiHash: variables.apiHash,
        phoneNumber: variables.phoneNumber,
      });
      setStep("verification");
      toast({
        title: "Verification code sent",
        description: "Check your phone for the verification code",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send code",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (data: VerificationForm) => {
      if (!connectionData) throw new Error("Connection data missing");
      
      const response = await apiRequest("POST", "/api/telegram/verify", {
        userId: 1, // This would come from auth context
        code: data.code,
        ...connectionData,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account connected successfully",
        description: "Your Telegram account is now connected",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/account"] });
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/channels"] });
      onConnectionSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onCredentialsSubmit = (data: CredentialsForm) => {
    sendCodeMutation.mutate(data);
  };

  const onVerificationSubmit = (data: VerificationForm) => {
    verifyMutation.mutate(data);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-[hsl(207,90%,54%)] rounded-full flex items-center justify-center mx-auto mb-4">
          <Send className="text-white h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Connect Your Telegram Account</h1>
        <p className="text-gray-600 mt-2">
          Connect your Telegram account to start managing channel members
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            {step === "credentials" ? "Telegram API Credentials" : "Phone Verification"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === "credentials" && (
            <>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>API Credentials Required</strong>
                  <br />
                  You need to obtain API credentials from{" "}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-[hsl(207,90%,54%)]"
                    onClick={() => window.open("https://my.telegram.org/apps", "_blank")}
                  >
                    my.telegram.org/apps
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </AlertDescription>
              </Alert>

              <Form {...credentialsForm}>
                <form onSubmit={credentialsForm.handleSubmit(onCredentialsSubmit)} className="space-y-4">
                  <FormField
                    control={credentialsForm.control}
                    name="apiId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your API ID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={credentialsForm.control}
                    name="apiHash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Hash</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your API Hash" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={credentialsForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="+1234567890" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full bg-[hsl(207,90%,54%)] hover:bg-[hsl(207,90%,44%)]"
                    disabled={sendCodeMutation.isPending}
                  >
                    {sendCodeMutation.isPending ? "Sending Code..." : "Send Verification Code"}
                  </Button>
                </form>
              </Form>

              <div className="text-sm text-gray-500">
                <p className="font-medium mb-2">How to get API credentials:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Visit my.telegram.org/apps</li>
                  <li>Log in with your phone number</li>
                  <li>Create a new application</li>
                  <li>Copy the API ID and API Hash</li>
                </ol>
              </div>
            </>
          )}

          {step === "verification" && (
            <>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Verification Code Sent</strong>
                  <br />
                  A verification code has been sent to your phone number: {connectionData?.phoneNumber}
                </AlertDescription>
              </Alert>

              <Form {...verificationForm}>
                <form onSubmit={verificationForm.handleSubmit(onVerificationSubmit)} className="space-y-4">
                  <FormField
                    control={verificationForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Code</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter the 5-digit code" 
                            {...field}
                            maxLength={6}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setStep("credentials");
                        setConnectionData(null);
                        verificationForm.reset();
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-[hsl(207,90%,54%)] hover:bg-[hsl(207,90%,44%)]"
                      disabled={verifyMutation.isPending}
                    >
                      {verifyMutation.isPending ? "Verifying..." : "Connect Account"}
                    </Button>
                  </div>
                </form>
              </Form>

              <div className="text-sm text-gray-500">
                <p>If you didn't receive the code, check your phone and try again in a few minutes.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}