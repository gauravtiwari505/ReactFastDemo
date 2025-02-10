import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import AnimatedScore from "./animated-score";

interface AnalysisSectionProps {
  name: string;
  score: number;
  suggestions: string[];
  index: number;
}

export default function AnalysisSection({ 
  name, 
  score, 
  suggestions,
  index
}: AnalysisSectionProps) {
  const baseDelay = index * 200; // Stagger the animations

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: baseDelay / 1000 }}
    >
      <Card>
        <CardContent className="pt-6">
          <AnimatedScore 
            label={name}
            score={score}
            delay={baseDelay + 300}
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: (baseDelay + 800) / 1000 }}
          >
            <h4 className="text-sm font-medium mt-4 mb-2">Suggestions</h4>
            <ul className="space-y-2">
              {suggestions.map((suggestion, i) => (
                <motion.li 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ 
                    duration: 0.3, 
                    delay: (baseDelay + 1000 + i * 100) / 1000 
                  }}
                  className="text-sm text-muted-foreground flex items-start gap-2"
                >
                  <span className="text-primary">•</span>
                  {suggestion}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}