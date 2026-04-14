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
  return (
    <div className="grid grid-cols-3 gap-4 h-full p-4">
      <section className="flex flex-col gap-2 min-h-0">{left}</section>
      <section className="flex flex-col gap-2 min-h-0">{middle}</section>
      <section className="flex flex-col gap-2 min-h-0">{right}</section>
    </div>
  );
}
