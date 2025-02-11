import { Card, CardContent } from "@/components/ui/card";
import { m as motion } from "framer-motion";
import AnimatedScore from "./animated-score";

interface AnalysisSectionProps {
  name: string;
  score: number;
  content: string;
  suggestions: string[];
  index: number;
}

export default function AnalysisSection({
  name,
  score,
  content,
  suggestions,
  index,
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
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">{name}</h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: (baseDelay + 200) / 1000 }}
                className="text-muted-foreground mb-4"
              >
                {content}
              </motion.p>
            </div>
            <div>
              <AnimatedScore 
                label="Section Score"
                score={score}
                delay={baseDelay + 300}
              />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: (baseDelay + 800) / 1000 }}
          >
            <h4 className="text-sm font-medium mt-6 mb-2">Suggestions for Improvement</h4>
            <ul className="space-y-2">
              {suggestions.map((suggestion, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: (baseDelay + 1000 + i * 100) / 1000,
                  }}
                  className="text-sm text-muted-foreground flex items-start gap-2"
                >
                  <span className="text-primary mt-1">•</span>
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