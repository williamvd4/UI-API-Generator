import { ReactNode } from "react";

interface LayoutProps {
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
}

/**
 * Three-column grid layout used as the main shell.
 */
export default function Layout({ left, middle, right }: LayoutProps) {
  const hasLeft = left !== null && left !== undefined;
  return (
    <div
      className={
        hasLeft
          ? "grid grid-cols-3 gap-4 h-full p-4"
          : "grid grid-cols-[2fr_1fr] gap-4 h-full p-4"
      }
    >
      {hasLeft && <section className="flex flex-col gap-2 min-h-0">{left}</section>}
      <section className="flex flex-col gap-2 min-h-0">{middle}</section>
      <section className="flex flex-col gap-2 min-h-0">{right}</section>
    </div>
  );
}
