import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { parseGalleryReference, type GalleryReference } from "../lib/galleryReference";

type GalleryReferenceHandlers = {
  onPath: (path: string) => void;
  onPrompt?: (prompt: string) => void;
  onWidth?: (width: number) => void;
  onHeight?: (height: number) => void;
  onModel?: (model: string) => void;
};

export function useGalleryReference(handlers: GalleryReferenceHandlers): GalleryReference | null {
  const [searchParams] = useSearchParams();
  const reference = parseGalleryReference(searchParams);
  const referenceKey = searchParams.toString();
  const handlersRef = useRef(handlers);
  const appliedReferenceKeyRef = useRef<string | null>(null);

  handlersRef.current = handlers;

  useEffect(() => {
    if (!referenceKey) {
      appliedReferenceKeyRef.current = null;
      return;
    }

    if (appliedReferenceKeyRef.current === referenceKey) {
      return;
    }

    appliedReferenceKeyRef.current = referenceKey;

    const nextReference = parseGalleryReference(new URLSearchParams(referenceKey));
    if (!nextReference) {
      return;
    }

    const activeHandlers = handlersRef.current;
    activeHandlers.onPath(nextReference.path);
    if (nextReference.prompt) {
      activeHandlers.onPrompt?.(nextReference.prompt);
    }
    if (nextReference.width) {
      activeHandlers.onWidth?.(nextReference.width);
    }
    if (nextReference.height) {
      activeHandlers.onHeight?.(nextReference.height);
    }
    if (nextReference.model) {
      activeHandlers.onModel?.(nextReference.model);
    }
  }, [referenceKey]);

  return reference;
}