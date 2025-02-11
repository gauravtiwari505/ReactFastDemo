import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PdfUpload from "@/components/pdf-upload";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { FileCheck2, Gauge, Lightbulb, Upload } from "lucide-react";

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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-background z-0" />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
          <motion.h1 
            className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            AI-Powered Resume Analysis
          </motion.h1>
          <motion.p 
            className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Get instant, detailed feedback on your resume with our advanced AI analysis. 
            Improve your chances of landing your dream job.
          </motion.p>

          {/* Upload Section */}
          <motion.div 
            className="max-w-lg mx-auto mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="border-2 border-primary/20 backdrop-blur-sm bg-background/95">
              <CardContent className="pt-6">
                <PdfUpload 
                  onFileSelect={(file) => uploadMutation.mutate(file)}
                  isUploading={uploadMutation.isPending}
                />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <Gauge className="h-8 w-8 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Smart Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Get instant, AI-powered feedback on your resume's content and structure,
                  with detailed scoring for each section.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <FileCheck2 className="h-8 w-8 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Section Scoring</h3>
                <p className="text-sm text-muted-foreground">
                  Each section of your resume is individually analyzed and scored,
                  helping you identify areas for improvement.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <Lightbulb className="h-8 w-8 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Actionable Tips</h3>
                <p className="text-sm text-muted-foreground">
                  Receive practical suggestions and improvements to make your 
                  resume stand out to potential employers.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}