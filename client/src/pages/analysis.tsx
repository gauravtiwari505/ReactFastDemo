import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import AnalysisSection from "@/components/analysis-section";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Analysis } from "@shared/schema";

export default function Analysis() {
  const { id } = useParams();

  const { data: analysis, isLoading } = useQuery<Analysis>({
    queryKey: [`/api/analysis/${id}`],
    refetchInterval: (data) => {
      return data?.status === "processing" ? 1000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Analysis Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested analysis could not be found.</p>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-4xl font-bold">Analysis Results</h1>
        </div>

        {analysis.status === "processing" ? (
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Analyzing Resume...</h2>
              <Progress value={40} className="mb-2" />
              <p className="text-sm text-muted-foreground">
                This usually takes a few seconds
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Overall Score</h2>
                  <span className="text-2xl font-bold">
                    {analysis.results?.overallScore}%
                  </span>
                </div>
                <Progress 
                  value={analysis.results?.overallScore} 
                  className="h-3"
                />
              </CardContent>
            </Card>

            <div className="space-y-6">
              {analysis.results?.sections.map((section) => (
                <AnalysisSection
                  key={section.name}
                  name={section.name}
                  score={section.score}
                  suggestions={section.suggestions}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}