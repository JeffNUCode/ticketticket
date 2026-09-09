import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "press inline-flex items-center justify-center gap-2 rounded-full font-display text-sm font-bold disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-2 border-ink bg-zap text-black shadow-pop-sm hover:bg-white",
        gold: "border-2 border-ink bg-zap text-black shadow-pop-sm hover:bg-white",
        pink: "border-2 border-ink bg-bubblegum text-black shadow-pop-sm hover:bg-white",
        aqua: "border-2 border-ink bg-aqua text-black shadow-pop-sm hover:bg-white",
        secondary: "border border-white/15 bg-white/5 text-white hover:bg-white/10",
        ghost: "text-white/70 hover:text-white",
        outline: "border-2 border-ink bg-transparent text-white hover:bg-white/5",
      },
      size: {
        default: "h-11 min-h-11 px-5 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 min-h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";
