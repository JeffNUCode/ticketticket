"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-2xl border-t-2 border-ink bg-neutral-950 p-5 pb-8",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-6",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border-2 sm:shadow-pop",
          )}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25 sm:hidden" />
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="font-display text-xl font-bold text-white">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="press grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
