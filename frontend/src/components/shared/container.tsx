import { cn } from "@/lib/utils";
import type { ElementType, ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  size?: "default" | "wide" | "narrow";
}

const sizes = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
};

export function Container({ children, className, as: Tag = "div", size = "default" }: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full px-5 sm:px-6 lg:px-8", sizes[size], className)}>
      {children}
    </Tag>
  );
}
