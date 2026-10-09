import { useState, type ReactNode } from "react";
import { ArrowRight, Volume2, LoaderCircle, Square } from "lucide-react";
import { Button } from "./ui/button";
import { speak, stopAudio } from "@/lib/audio";
import { reportError, usePreferences } from "@/lib/store";
import { Link } from "react-router-dom";
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`badge ${className}`}>{children}</span>;
}
export function Empty({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h2>{title}</h2>
      <div className="muted">{children}</div>
    </div>
  );
}
export function AudioButton({
  text,
  url,
  label = "Nghe",
  compact = false,
}: {
  text: string;
  url?: string;
  label?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const sound = usePreferences((s) => s.sound);
  return (
    <Button
      variant="ghost"
      size={compact ? "icon" : "sm"}
      aria-label={busy ? "Dừng âm thanh" : label}
      title={label}
      onClick={() => {
        if (busy) {
          stopAudio();
          setBusy(false);
          return;
        }
        if (!sound) {
          reportError(
            new Error("Âm thanh đang tắt. Em bật lại trong Cài đặt nhé."),
          );
          return;
        }
        setBusy(true);
        void speak(text, url)
          .catch(reportError)
          .finally(() => setBusy(false));
      }}
    >
      {busy ? <Square size={17} /> : <Volume2 size={18} />}{" "}
      {!compact && (busy ? "Dừng" : label)}
    </Button>
  );
}
export function SectionHeading({
  title,
  to,
  label = "Xem tất cả",
}: {
  title: string;
  to?: string;
  label?: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {to && (
        <Link to={to} className="text-link">
          {label}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={24} /> Đang mở khu vườn…
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
