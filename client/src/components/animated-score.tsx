import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface AnimatedScoreProps {
  score: number;
  label: string;
  delay?: number;
}

export default function AnimatedScore({ score, label, delay = 0 }: AnimatedScoreProps) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setValue(score);
    }, delay);

    return () => clearTimeout(timer);
  }, [score, delay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay / 1000 }}
      className="space-y-2"
    >
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{label}</span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: (delay + 500) / 1000 }}
          className="text-sm font-bold"
        >
          {value}%
        </motion.span>
      </div>
      <Progress 
        value={value} 
        className="h-2 transition-all duration-1000 ease-out"
      />
    </motion.div>
  );
}
