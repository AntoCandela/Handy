import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";

type ModelStatus =
  | "ready"
  | "loading"
  | "downloading"
  | "verifying"
  | "error"
  | "unloaded"
  | "none";

interface ModelStatusButtonProps {
  status: ModelStatus;
  displayText: string;
  isDropdownOpen: boolean;
  /** Ready, and transcribing in the background. */
  busy?: boolean;
  onClick: () => void;
  className?: string;
}

const ModelStatusButton: React.FC<ModelStatusButtonProps> = ({
  status,
  displayText,
  isDropdownOpen,
  busy = false,
  onClick,
  className = "",
}) => {
  const { t } = useTranslation();
  const getStatusColor = (status: ModelStatus): string => {
    switch (status) {
      case "ready":
        return busy
          ? "bg-moss animate-pulse motion-reduce:animate-none"
          : "bg-moss";
      case "loading":
        return "bg-warning animate-pulse";
      case "downloading":
        return "bg-logo-primary animate-pulse";
      case "verifying":
        return "bg-background-ui animate-pulse";
      case "error":
        return "bg-error";
      case "unloaded":
        return "bg-ink-3";
      case "none":
        return "bg-error";
      default:
        return "bg-ink-3";
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      aria-expanded={isDropdownOpen}
      onClick={onClick}
      className={`flex items-center gap-2 hover:text-text transition-colors ${className}`}
      title={t("modelSelector.switchModel", { model: displayText })}
    >
      <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
      <span className="max-w-44 truncate text-start">{displayText}</span>
      <svg
        className={`w-3 h-3 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </Button>
  );
};

export default ModelStatusButton;
