"use client";
import Image from "next/image";
import { useState } from "react";
import { ImageOff, ChevronLeft, ChevronRight } from "lucide-react";
import { postImages, safeImageUrl } from "@/lib/media";
export function PostMedia({
  media,
  className = "",
}: {
  media: unknown;
  className?: string;
}) {
  const images = postImages(media),
    [index, setIndex] = useState(0),
    [failed, setFailed] = useState<string[]>([]);
  const current = Math.min(index, Math.max(0, images.length - 1)),
    src = images[current];
  return (
    <div className={"post-media " + className}>
      {src && !failed.includes(src) ? (
        <Image
          unoptimized
          src={src}
          alt={`Ảnh bài viết ${current + 1}`}
          fill
          sizes="(max-width: 700px) 90vw, 40vw"
          referrerPolicy="no-referrer"
          onError={() => setFailed((f) => [...f, src])}
        />
      ) : (
        <div className="post-image-empty">
          <ImageOff size={30} />
          <span>
            {src ? "Ảnh tạm không khả dụng" : "Bài viết chưa có hình ảnh"}
          </span>
        </div>
      )}
      {images.length > 1 && (
        <>
          <button
            type="button"
            className="photo-prev"
            aria-label="Ảnh trước"
            onClick={() =>
              setIndex((current - 1 + images.length) % images.length)
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="photo-next"
            aria-label="Ảnh tiếp theo"
            onClick={() => setIndex((current + 1) % images.length)}
          >
            <ChevronRight size={18} />
          </button>
          <span className="photo-counter">
            {current + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  );
}
export function FacebookAvatar({
  src,
  name,
  className = "",
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = safeImageUrl(src);
  return (
    <span className={"facebook-avatar " + className}>
      {url && !failed ? (
        <Image
          unoptimized
          src={url}
          alt={name}
          fill
          sizes="60px"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        name
          .split(" ")
          .slice(-2)
          .map((s) => s[0])
          .join("")
      )}
    </span>
  );
}
