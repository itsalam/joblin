import { motion } from "framer-motion";
import { ComponentProps, FC, SVGProps } from "react";
import { CIRCLE_STROKE_WIDTH } from "./helpers";

export const LinearGradient: FC<
  Partial<SVGProps<SVGLinearGradientElement>> & { steps: string[] }
> = (props) => {
  const { steps, ...otherProps } = props;
  return (
    <linearGradient
      x1="0"
      y1="0"
      x2="28"
      y2="28"
      gradientUnits="userSpaceOnUse"
      {...otherProps}
    >
      {steps.map((stopColor, i, arr) => (
        <stop
          offset={i / (Math.max(arr.length, 2) - 1)}
          key={i}
          style={{ stopColor }}
        />
      ))}
    </linearGradient>
  );
};

export const Circle: FC<ComponentProps<typeof motion.circle>> = (props) => {
  return (
    <motion.circle
      cx="12"
      cy="12"
      r="12"
      stroke="currentColor"
      fill="transparent"
      strokeWidth={CIRCLE_STROKE_WIDTH}
      {...props}
    />
  );
};

export const Line: FC<ComponentProps<typeof motion.line>> = (props) => {
  return (
    <motion.line
      x1="0"
      y1="24"
      x2="0"
      y2="0"
      stroke="currentColor"
      strokeWidth="4"
      {...props}
    />
  );
};
