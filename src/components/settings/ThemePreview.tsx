import React from "react";
import {
  themes,
  type ThemeId,
  type AccentId,
} from "@/lib/appearance/definitions";
import { previewVariables } from "@/lib/appearance/resolve";
import "./AppearanceSettings.css";

export function ThemePreview({
  preset,
  accent,
}: {
  preset: ThemeId;
  accent: AccentId;
}) {
  return (
    <span
      className="appearance-preview"
      aria-hidden="true"
      style={previewVariables(themes[preset], accent)}
    >
      <span className="preview-sidebar">
        <i />
        <i />
        <i />
      </span>
      <span className="preview-content">
        <i className="preview-heading" />
        <span className="preview-row">
          <i />
          <b />
        </span>
        <span className="preview-row">
          <i />
          <b />
        </span>
      </span>
      <span className="preview-overlay">
        <i />
        <span />
        <b />
      </span>
    </span>
  );
}
