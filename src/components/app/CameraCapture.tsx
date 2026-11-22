import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CameraCapture({ onCapture, onClose }: { onCapture: (blob: Blob) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: 640, height: 640 } })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError("Camera not available. Allow camera access or upload a photo instead."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  function snap() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const size = Math.min(v.videoWidth, v.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 600;
    const ctx = canvas.getContext("2d")!;
    const sw = size * 0.8;
    const sh = size;
    ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, 480, 600);
    canvas.toBlob((b) => b && onCapture(b), "image/jpeg", 0.88);
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-xl bg-destructive/15 p-3 text-sm text-destructive">{error}</p>
      ) : (
        <video ref={video} autoPlay playsInline muted className="aspect-[4/5] w-full rounded-xl bg-muted object-cover" />
      )}
      <div className="flex gap-2">
        <Button type="button" onClick={snap} disabled={!!error} className="flex-1">
          <Camera /> Capture
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          <X /> Cancel
        </Button>
      </div>
    </div>
  );
}
