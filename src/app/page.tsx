"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type VideoDimensions = {
  width: number;
  height: number;
};

type CapturableVideo = HTMLVideoElement & {
  captureStream(): MediaStream;
};

const DEFAULT_HEADLINE = "BLACK FRIDAY 28 NËNTORI";
const DEFAULT_BODY =
  "Personalizoni shishet me logo, foto dhe shkrime sipas dëshirës.";

const CANVAS_SCALE_FALLBACK: VideoDimensions = { width: 1280, height: 720 };

const ensureMetadata = (video: HTMLVideoElement) =>
  new Promise<void>((resolve, reject) => {
    if (video.readyState >= 1) {
      resolve();
      return;
    }

    const handleLoaded = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Failed to load video metadata."));
    };

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("error", handleError);
  });

const pickMimeType = () => {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return "video/webm";
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) => {
  const words = text.split(" ");
  let line = "";
  let cursor = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, cursor);
      cursor += lineHeight;
      line = word;
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, x, cursor);
  }
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [primaryText, setPrimaryText] = useState<string>("");
  const [headlineText, setHeadlineText] = useState<string>(DEFAULT_HEADLINE);
  const [bodyText, setBodyText] = useState<string>(DEFAULT_BODY);
  const [accentColor, setAccentColor] = useState<string>("#facc15");
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [videoDimensions, setVideoDimensions] =
    useState<VideoDimensions | null>(null);

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [sourceUrl]);

  useEffect(() => {
    return () => {
      if (renderedUrl) {
        URL.revokeObjectURL(renderedUrl);
      }
    };
  }, [renderedUrl]);

  const handleVideoSelect = useCallback((file: File) => {
    if (!file.type.startsWith("video/")) {
      setErrorMessage("Zgjidhni një skedar video për transformim.");
      return;
    }

    setErrorMessage(null);
    setVideoFile(file);

    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    setSourceUrl(nextUrl);
  }, [sourceUrl]);

  const onFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const [file] = event.target.files ?? [];
      if (file) {
        handleVideoSelect(file);
      }
    },
    [handleVideoSelect],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const [file] = Array.from(event.dataTransfer.files).filter((entry) =>
        entry.type.startsWith("video/"),
      );

      if (file) {
        handleVideoSelect(file);
      } else {
        setErrorMessage("Vendosni një video MP4, MOV ose WEBM.");
      }
    },
    [handleVideoSelect],
  );

  const ensurePlaybackReady = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      throw new Error("Video element not ready.");
    }

    await ensureMetadata(video);
    await video.play().catch((error) => {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        throw new Error("Lejoni riprodhimin e videos për të vazhduar.");
      }

      throw error;
    });
    video.pause();
  }, []);

  const updateDimensions = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    await ensureMetadata(video);
    if (video.videoWidth && video.videoHeight) {
      setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
    } else {
      setVideoDimensions(CANVAS_SCALE_FALLBACK);
    }
  }, []);

  const renderVideo = useCallback(async () => {
    if (!sourceUrl) {
      setErrorMessage("Ngarkoni një video përpara se të transformoni.");
      return;
    }

    if (isRendering) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setErrorMessage("Video nuk është gati. Rifreskoni faqen.");
      return;
    }

    setIsRendering(true);
    setErrorMessage(null);

    try {
      await ensureMetadata(video);
      video.pause();
      video.currentTime = 0;

      const width = video.videoWidth || CANVAS_SCALE_FALLBACK.width;
      const height = video.videoHeight || CANVAS_SCALE_FALLBACK.height;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Shfletuesi nuk mbështet Canvas 2D.");
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const drawOverlay = () => {
        ctx.drawImage(video, 0, 0, width, height);

        ctx.save();

        const gradientHeight = height * 0.35;
        const gradient = ctx.createLinearGradient(
          0,
          height - gradientHeight,
          0,
          height,
        );
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,0.75)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height - gradientHeight, width, gradientHeight);

        if (primaryText.trim()) {
          ctx.font = `600 ${Math.round(width * 0.035)}px "Geist", sans-serif`;
          ctx.fillStyle = "rgba(0,0,0,0.45)";
          ctx.fillRect(width * 0.08, height * 0.12, width * 0.84, height * 0.08);
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(
            primaryText,
            width * 0.1,
            height * 0.16,
          );
        }

        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "center";
        ctx.font = `800 ${Math.round(width * 0.075)}px "Geist", sans-serif`;
        ctx.fillStyle = accentColor;
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = width * 0.008;
        ctx.fillText(headlineText.toUpperCase(), width / 2, height * 0.78);

        ctx.shadowColor = "transparent";
        ctx.font = `400 ${Math.round(width * 0.032)}px "Geist", sans-serif`;
        ctx.fillStyle = "#ffffff";
        wrapText(
          ctx,
          bodyText,
          width / 2,
          height * 0.85,
          width * 0.7,
          height * 0.05,
        );

        ctx.restore();
      };

      const mimeType = pickMimeType();
      const canvasStream = canvas.captureStream();
      const audioStream =
        "captureStream" in video &&
        typeof (video as CapturableVideo).captureStream === "function"
          ? (video as CapturableVideo).captureStream()
          : null;
      const tracks = [
        ...canvasStream.getVideoTracks(),
        ...(audioStream?.getAudioTracks() ?? []),
      ];

      const mediaStream = new MediaStream(tracks);
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(mediaStream, {
        mimeType,
        videoBitsPerSecond: 6_000_000,
      });

      const recordingComplete = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.start(150);

      const loop = () => {
        drawOverlay();
        animationFrameRef.current = requestAnimationFrame(loop);
      };

      const handleEnded = () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        drawOverlay();
        recorder.stop();
      };

      video.addEventListener("ended", handleEnded, { once: true });
      await video.play();
      loop();

      await recordingComplete;
      video.pause();
      video.currentTime = 0;

      const blob = new Blob(chunks, { type: mimeType });

      if (renderedUrl) {
        URL.revokeObjectURL(renderedUrl);
      }

      const downloadUrl = URL.createObjectURL(blob);
      setRenderedUrl(downloadUrl);

      video.removeEventListener("ended", handleEnded);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Diçka shkoi keq gjatë transformimit.";
      setErrorMessage(message);
    } finally {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setIsRendering(false);
    }
  }, [
    accentColor,
    bodyText,
    headlineText,
    isRendering,
    primaryText,
    renderedUrl,
    sourceUrl,
  ]);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    const video = videoRef.current;
    const handleLoadedMetadata = () => {
      setVideoDimensions({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, []);

  const aspectRatioClass = useMemo(() => {
    if (!videoDimensions) {
      return "aspect-video";
    }

    const ratio = videoDimensions.width / videoDimensions.height;
    if (Math.abs(ratio - 1) < 0.01) {
      return "aspect-square";
    }
    if (ratio < 1) {
      return "aspect-[3/4]";
    }
    if (ratio > 2) {
      return "aspect-[21/9]";
    }
    return "aspect-video";
  }, [videoDimensions]);

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950 text-white">
      <header className="border-b border-white/5 bg-neutral-950/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-white/60">
              Studio Promo Video
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              Shtoni tekst të personalizuar mbi videon tuaj
            </h1>
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-white/60">
              Ideal për fushata &ldquo;BLACK FRIDAY 28 NËNTORI&rdquo;.
            </p>
            <p className="text-sm text-white/60">
              Përditëson tekstin në kohë reale dhe eksportoni videon.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8 lg:flex-row">
        <section className="flex w-full flex-col gap-6 lg:w-[55%]">
          <label
            htmlFor="video-input"
            onDrop={onDrop}
            onDragOver={(event) => event.preventDefault()}
            className="relative flex min-h-[12rem] cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/20 bg-white/[0.04] p-10 text-center transition hover:border-white/60 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <input
              id="video-input"
              type="file"
              accept="video/*"
              className="hidden"
              onChange={onFileInputChange}
            />
            <span className="rounded-full bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.3em] text-white/70">
              Video Input
            </span>
            <div>
              <p className="text-xl font-semibold">
                {videoFile ? videoFile.name : "Tërhiqni dhe lëshoni videon tuaj"}
              </p>
              <p className="mt-2 text-sm text-white/60">
                Mbështet MP4, MOV, WEBM deri në 250 MB.
              </p>
            </div>
          </label>

          <div className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div>
              <h2 className="text-lg font-semibold">Teksti promocional</h2>
              <p className="text-sm text-white/60">
                Shkruani sloganin në mënyrë që të shfaqet &ldquo;original as i
                write&rdquo; mbi videon tuaj.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Linja Live (shfaqet sipër)
                </span>
                <input
                  type="text"
                  placeholder="Original as I write"
                  value={primaryText}
                  onChange={(event) => setPrimaryText(event.target.value)}
                  className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-base text-white outline-none transition focus:border-white/40 focus:ring-2 focus:ring-white/20"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Titulli Kryesor
                </span>
                <input
                  type="text"
                  value={headlineText}
                  onChange={(event) => setHeadlineText(event.target.value)}
                  className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-base text-white outline-none transition focus:border-white/40 focus:ring-2 focus:ring-white/20"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Teksti Mbështetës
                </span>
                <textarea
                  value={bodyText}
                  onChange={(event) => setBodyText(event.target.value)}
                  className="min-h-[7rem] rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-base text-white outline-none transition focus:border-white/40 focus:ring-2 focus:ring-white/20"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                Ngjyra e theksit
              </span>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(event) => setAccentColor(event.target.value)}
                  className="h-12 w-24 cursor-pointer rounded-xl border border-white/20 bg-transparent"
                  aria-label="Accent color"
                />
                <span className="text-sm text-white/60">
                  Përdoret për titullin kryesor mbi videon.
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <button
              type="button"
              onClick={renderVideo}
              disabled={!sourceUrl || isRendering}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-6 py-3 text-base font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
            >
              {isRendering ? "Duke eksportuar..." : "Eksporto videon me tekst"}
            </button>

            {renderedUrl && (
              <a
                href={renderedUrl}
                download={
                  videoFile
                    ? `${videoFile.name.replace(/\.[^/.]+$/, "")}-overlay.webm`
                    : "video-overlay.webm"
                }
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3 text-base font-semibold text-white transition hover:border-white/60"
              >
                Shkarko videon e transformuar
              </a>
            )}

            {errorMessage && (
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </p>
            )}
          </div>
        </section>

        <section className="relative flex w-full flex-1 flex-col gap-6 rounded-3xl border border-white/10 bg-neutral-900/50 p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Pamja paraprake</h2>
            <button
              type="button"
              onClick={() => ensurePlaybackReady().catch((error) => {
                setErrorMessage(
                  error instanceof Error
                    ? error.message
                    : "Riprodhimi i videos nuk lejohet.",
                );
              })}
              className="text-xs uppercase tracking-[0.2em] text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
            >
              Rikthe fillimin
            </button>
          </div>

          <div
            ref={previewContainerRef}
            className={`relative w-full overflow-hidden rounded-2xl bg-neutral-800 ${aspectRatioClass}`}
          >
            {sourceUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={sourceUrl}
                  controls
                  className="absolute inset-0 h-full w-full object-cover"
                  onLoadedMetadata={updateDimensions}
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col">
                  {primaryText.trim() && (
                    <div className="flex items-center justify-center px-6 py-4">
                      <div className="w-full rounded-xl bg-black/40 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white/80 backdrop-blur">
                        {primaryText}
                      </div>
                    </div>
                  )}
                  <div className="mt-auto flex flex-col items-center gap-4 px-6 pb-10 text-center">
                    <div
                      className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em]"
                      style={{ backgroundColor: `${accentColor}26`, color: accentColor }}
                    >
                      Oferta e Ditës
                    </div>
                    <p
                      className="text-3xl font-black drop-shadow-[0_12px_32px_rgba(0,0,0,0.75)] sm:text-4xl md:text-5xl"
                      style={{ color: accentColor }}
                    >
                      {headlineText.toUpperCase()}
                    </p>
                    <p className="max-w-2xl text-sm text-white/80 sm:text-base">
                      {bodyText}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/40">
                Ngarkoni një video për ta parë këtu.
              </div>
            )}
          </div>

          <p className="text-xs text-white/40">
            Eksporti kryhet në shfletues përmes Canvas + MediaRecorder. Nëse
            mungon audio, përdorni një shfletues që mbështet{" "}
            <code className="rounded bg-white/10 px-1 py-0.5">MediaRecorder</code>{" "}
            ose shtoni muzikën në redaktor tjetër.
          </p>
        </section>
      </div>
    </main>
  );
}
