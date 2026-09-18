import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";

export interface ToastMessage {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  if (!toast) return null;

  const colors = {
    success: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300",
    error: "bg-red-500/20 border-red-500/30 text-red-300",
    info: "bg-blue-500/20 border-blue-500/30 text-blue-300",
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 flex-shrink-0" />,
    info: <AlertCircle className="w-5 h-5 flex-shrink-0" />,
  };

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div
        className={`flex items-center gap-3 px-5 py-3 rounded-xl border backdrop-blur-md shadow-xl max-w-sm ${colors[toast.type]}`}
      >
        {icons[toast.type]}
        <span className="text-sm font-medium flex-1">{toast.message}</span>
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 300);
          }}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
