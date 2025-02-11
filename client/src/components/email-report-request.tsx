import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const emailFormSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

type EmailFormValues = z.infer<typeof emailFormSchema>;

interface EmailReportRequestProps {
  analysisId: number;
  className?: string;
}

export default function EmailReportRequest({ analysisId, className }: EmailReportRequestProps) {
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: EmailFormValues) => {
    setIsSending(true);
    try {
      const response = await fetch(`/api/analysis/${analysisId}/send-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email }),
      });

      if (!response.ok) {
        throw new Error("Failed to send report");
      }

      toast({
        title: "Report Sent",
        description: "Check your email for the detailed analysis report",
      });

      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send the report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`p-4 border rounded-lg ${className}`}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex flex-col space-y-2">
            <h3 className="text-lg font-semibold">Get Detailed Report</h3>
            <p className="text-sm text-muted-foreground">
              Enter your email to receive a comprehensive PDF report of your resume analysis
            </p>
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Enter your email"
                      {...field}
                      disabled={isSending}
                    />
                    <Button type="submit" disabled={isSending}>
                      {isSending ? (
                        "Sending..."
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Report
                        </>
                      )}
                    </Button>
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
}
