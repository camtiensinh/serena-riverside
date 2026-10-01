"use client";
import Image from "next/image";
import { useState } from "react";
import { postImages } from "@/lib/media";
export default function PostCollage({ media }: { media: unknown }) {
  const images = postImages(media, Infinity),
    [failed, setFailed] = useState<string[]>([]);
  const available = images.filter((src) => !failed.includes(src));
  return (
    <div className={`award-collage photos-${Math.min(available.length, 5)}`}>
      {!available.length && (
        <div className="photo-unavailable">Bài viết không có hình ảnh</div>
      )}
      {available.slice(0, 5).map((src, i) => (
        <div className="collage-cell" key={src}>
          <Image
            src={src}
            alt={`Ảnh bài viết ${i + 1}`}
            fill
            unoptimized
            sizes="40vw"
            referrerPolicy="no-referrer"
            onError={() =>
              setFailed((v) => (v.includes(src) ? v : [...v, src]))
            }
          />
          {i === 4 && available.length > 5 && (
            <span className="photo-more">+{available.length - 5}</span>
          )}
        </div>
      ))}
    </div>
  );
}
