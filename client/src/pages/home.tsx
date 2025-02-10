import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PdfUpload from "@/components/pdf-upload";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function Home() {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("resume", file);
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload successful",
        description: "Analyzing your resume...",
      });
      setLocation(`/analysis/${data.id}`);
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Resume Analysis
        </h1>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <PdfUpload 
              onFileSelect={(file) => uploadMutation.mutate(file)}
              isUploading={uploadMutation.isPending}
            />
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Quick Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Get instant feedback on your resume's content and structure
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Section Scoring</h3>
              <p className="text-sm text-muted-foreground">
                Detailed scores for each section of your resume
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Improvement Tips</h3>
              <p className="text-sm text-muted-foreground">
                Actionable suggestions to enhance your resume
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}