import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface AnalysisSectionProps {
  name: string;
  score: number;
  suggestions: string[];
}

export default function AnalysisSection({ 
  name, 
  score, 
  suggestions 
}: AnalysisSectionProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{name}</h3>
          <span className="font-medium">{score}%</span>
        </div>
        <Progress value={score} className="mb-4" />
        
        <h4 className="text-sm font-medium mb-2">Suggestions</h4>
        <ul className="space-y-2">
          {suggestions.map((suggestion, i) => (
            <li 
              key={i}
              className="text-sm text-muted-foreground flex items-start gap-2"
            >
              <span className="text-primary">•</span>
              {suggestion}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
