"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearAllCache, isCacheDisabled, setCacheDisabled } from "@/lib/cache";

type CacheMenuProps = {
  direction?: "up" | "down";
};

export default function CacheMenu({ direction = "up" }: CacheMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisabled(isCacheDisabled());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      clearAllCache();
      router.refresh();
    } finally {
      setIsSyncing(false);
      setOpen(false);
    }
  };

  const handleClear = () => {
    clearAllCache();
    setOpen(false);
  };

  const handleToggleDisable = () => {
    const next = !disabled;
    setCacheDisabled(next);
    setDisabled(next);
    setOpen(false);
  };

  const positionClasses =
    direction === "up"
      ? "bottom-full mb-2 left-0"
      : "top-full mt-2 left-0";

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="nav-link w-full text-left text-stone-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
      >
        <span className="text-base leading-none">⚙️</span>
        <span>Cache</span>
        {disabled && (
          <span className="ml-auto text-[10px] font-mono text-stone-400 bg-stone-100 rounded px-1.5 py-0.5">
            off
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute ${positionClasses} z-50 w-48 bg-white border border-stone-200 rounded-lg shadow-lg py-1`}
        >
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-600 hover:bg-teal-50 hover:text-teal-700 transition-colors disabled:opacity-50"
          >
            <span className={`text-sm${isSyncing ? " animate-spin" : ""}`}>🔄</span>
            <span>{isSyncing ? "Syncing…" : "Sync data"}</span>
          </button>
          <button
            onClick={handleClear}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-600 hover:bg-amber-50 hover:text-amber-700 transition-colors"
          >
            <span className="text-sm">🗑️</span>
            <span>Clear cache</span>
          </button>
          <div className="border-t border-stone-100 my-1" />
          <button
            onClick={handleToggleDisable}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <span className="text-sm">{disabled ? "✅" : "⛔"}</span>
            <span>{disabled ? "Enable cache" : "Disable cache"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
