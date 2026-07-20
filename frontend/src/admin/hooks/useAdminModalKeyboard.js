import { useEffect } from "react";

const focusable = "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function useAdminModalKeyboard(labelledBy, onClose, closeDisabled = false) {
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = document.querySelector(`[role='dialog'][aria-labelledby='${labelledBy}']`);
    const firstTarget = dialog?.querySelector("[autofocus]") || dialog?.querySelector(focusable) || dialog;
    firstTarget?.focus();
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !closeDisabled) { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const targets = [...dialog.querySelectorAll(focusable)];
      if (!targets.length) return event.preventDefault();
      const [first] = targets;
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = priorOverflow;
      previousFocus?.focus?.();
    };
  }, [closeDisabled, labelledBy, onClose]);
}
