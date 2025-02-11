import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import AnalysisSection from "@/components/analysis-section";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Loader2, ChevronRight } from "lucide-react";
import type { Analysis } from "@shared/schema";
import { m as motion } from "framer-motion";
import GaugeChart from "@/components/gauge-chart";
import RadarScoreChart from "@/components/radar-score-chart";

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
          <p className="text-muted-foreground mb-4">
            The requested analysis could not be found.
          </p>
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-6"
        >
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-4xl font-bold">Analysis Results</h1>
        </motion.div>

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
            {/* Overview Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <h2 className="text-xl font-semibold mb-4">Overview</h2>
                  <p className="text-muted-foreground mb-6">
                    {analysis.results?.overview}
                  </p>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Strengths */}
                    <div>
                      <h3 className="font-medium mb-2 text-green-600">Key Strengths</h3>
                      <ul className="space-y-2">
                        {analysis.results?.strengths.map((strength, index) => (
                          <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start gap-2"
                          >
                            <ChevronRight className="h-4 w-4 text-green-600 mt-1" />
                            <span>{strength}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>

                    {/* Areas for Improvement */}
                    <div>
                      <h3 className="font-medium mb-2 text-orange-600">Areas for Improvement</h3>
                      <ul className="space-y-2">
                        {analysis.results?.weaknesses.map((weakness, index) => (
                          <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start gap-2"
                          >
                            <ChevronRight className="h-4 w-4 text-orange-600 mt-1" />
                            <span>{weakness}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Score Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="grid md:grid-cols-2 gap-6 mb-6"
            >
              {/* Overall Score Gauge */}
              <Card>
                <CardHeader>
                  <CardTitle>Overall Score</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <GaugeChart score={analysis.results?.overallScore || 0} />
                </CardContent>
              </Card>

              {/* Section Scores Radar */}
              <Card>
                <CardHeader>
                  <CardTitle>Section Scores</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadarScoreChart 
                    data={analysis.results?.sections.map(section => ({
                      name: section.name,
                      score: section.score
                    })) || []}
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Detailed Section Analysis */}
            <div className="space-y-6">
              {analysis.results?.sections.map((section, index) => (
                <AnalysisSection
                  key={section.name}
                  name={section.name}
                  score={section.score}
                  content={section.content}
                  suggestions={section.suggestions}
                  index={index}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}