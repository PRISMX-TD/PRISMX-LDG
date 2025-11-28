import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingActionButtonProps {
  onClick: () => void;
}

export function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className="fixed bottom-20 right-8 w-14 h-14 rounded-full shadow-lg z-50 md:bottom-24 md:right-12 md:w-16 md:h-16"
      data-testid="button-fab"
    >
      <Plus className="w-6 h-6 md:w-7 md:h-7" />
      <span className="sr-only">记一笔</span>
    </Button>
  );
}
