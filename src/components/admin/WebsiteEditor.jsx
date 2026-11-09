"use client";
import { useEffect, useRef, useState } from "react";
import {
  Eye,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  Save,
  UploadCloud,
  Undo2,
} from "lucide-react";
import {
  EDITOR_SECTIONS,
  PREVIEW_PAGES,
  imageFileName,
  isEditorImage,
  previewUrl,
} from "@/lib/site-editor.mjs";

const control =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-800 focus:border-[#9b6a40]";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#701e35] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#91294b] disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d7c2a6] bg-white px-3 py-2 text-sm font-semibold text-[#701e35] disabled:opacity-50";
const friendly = (text) =>
  String(text)
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (m) => m.toUpperCase());
const copy = (item) => JSON.parse(JSON.stringify(item));

function EditorField({ value, path, label, onEdit, onUpload, busy, onFocus }) {
  const id = `editor-${path.join("-")}`;
  const isSchoolLogo = path.join(".") === "pages.images.logo";
  if (Array.isArray(value))
    return (
      <fieldset className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
        <legend className="px-1 text-sm font-bold text-[#5f2739]">
          {friendly(label)} ({value.length})
        </legend>
        {value.length > 0 && (
          <button
            className="text-sm font-semibold text-[#701e35]"
            type="button"
            disabled={busy}
            onClick={() =>
              onEdit(path, [...value, copy(value[value.length - 1])])
            }
          >
            + Add item
          </button>
        )}
        {value.map((item, i) => (
          <div
            className="space-y-3 rounded-xl border border-stone-200 bg-white p-3"
            key={i}
          >
            <div className="flex justify-between text-xs text-stone-500">
              <span>Item {i + 1}</span>
              <button
                type="button"
                disabled={busy}
                className="font-semibold text-red-700"
                onClick={() =>
                  onEdit(
                    path,
                    value.filter((_, index) => i !== index),
                  )
                }
              >
                Remove
              </button>
            </div>
            <EditorField
              value={item}
              path={[...path, i]}
              label={typeof item === "string" ? `${label} ${i + 1}` : label}
              {...{ onEdit, onUpload, busy, onFocus }}
            />
          </div>
        ))}
      </fieldset>
    );
  if (value && typeof value === "object")
    return (
      <fieldset className="space-y-4">
        <legend className="mb-3 font-display text-xl font-bold text-[#532438]">
          {friendly(label)}
        </legend>
        {Object.entries(value).map(([key, item]) => (
          <EditorField
            key={key}
            value={item}
            path={[...path, key]}
            label={key}
            {...{ onEdit, onUpload, busy, onFocus }}
          />
        ))}
      </fieldset>
    );
  const image = isEditorImage(value);
  return (
    <div className="min-w-0 space-y-2" onFocus={() => onFocus(path)}>
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-stone-700"
      >
        {friendly(label)}
      </label>
      {typeof value === "string" && value.length > 110 && !image ? (
        <textarea
          id={id}
          data-field={path.join(".")}
          rows={4}
          className={control}
          disabled={busy}
          value={value}
          onChange={(e) => onEdit(path, e.target.value)}
        />
      ) : (
        <input
          id={id}
          data-field={path.join(".")}
          className={control}
          disabled={busy}
          value={value ?? ""}
          onChange={(e) => onEdit(path, e.target.value)}
        />
      )}
      {image && (
        <div className="rounded-xl border border-[#e7dac7] bg-[#fffaf2] p-3">
          <div className="flex items-start gap-3">
            <img
              src={value}
              alt={
                isSchoolLogo
                  ? "Current school logo"
                  : `Current ${friendly(label).toLowerCase()}`
              }
              className="h-20 w-24 shrink-0 rounded-lg border object-contain"
            />
            <div className="min-w-0">
              <p className="break-all text-xs font-semibold text-[#6e3d30]">
                File: {imageFileName(value)}
              </p>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#701e35]">
                <UploadCloud size={16} />
                {isSchoolLogo ? "Replace School Logo" : "Replace image"}
                <input
                  type="file"
                  className="sr-only"
                  disabled={busy}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  aria-label={
                    isSchoolLogo
                      ? "Replace School Logo"
                      : `Replace ${friendly(label).toLowerCase()}`
                  }
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(file, path);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WebsiteEditor({
  content,
  publishedContent,
  revision,
  busy,
  onEdit,
  onUpload,
  onPublish,
  onDiscard,
}) {
  const [selected, setSelected] = useState("home");
  const [focused, setFocused] = useState([]);
  const [showPreview, setShowPreview] = useState(true);
  const [route, setRoute] = useState("/");
  const [device, setDevice] = useState("desktop");
  const [draft, setDraft] = useState("");
  const [version, setVersion] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [previewState, setPreviewState] = useState("Preparing preview…");
  const [previewError, setPreviewError] = useState("");
  const [containerWidth, setContainerWidth] = useState(0);
  const container = useRef(null);
  const frame = useRef(null);
  const sessionId = useRef("");
  const sequence = useRef(0);
  const scroll = useRef(0);
  const section = EDITOR_SECTIONS.find((item) => item.id === selected);
  const dirty = JSON.stringify(content) !== JSON.stringify(publishedContent);
  const value = section.path.reduce((item, key) => item?.[key], content);
  const targetWidth =
    device === "mobile" ? 390 : device === "tablet" ? 768 : 1280;
  const scale = containerWidth ? Math.min(1, containerWidth / targetWidth) : 1;
  const src = draft ? previewUrl(route, draft, version) : "";

  useEffect(() => {
    if (!showPreview) return;
    const controller = new AbortController();
    setPreviewState("Updating draft preview…");
    setPreviewError("");
    const timer = setTimeout(async () => {
      if (!sessionId.current) sessionId.current = crypto.randomUUID();
      const current = ++sequence.current;
      try {
        const response = await fetch("/api/content/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            sessionId: sessionId.current,
            sequence: current,
          }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Unable to refresh preview.");
        if (!controller.signal.aborted) {
          setDraft(result.id);
          setVersion(current);
          setPreviewState("Loading website…");
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          setPreviewError(error.message);
          setPreviewState("Preview needs attention");
        }
      }
    }, 900);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [content, refresh, showPreview]);

  useEffect(() => {
    if (!showPreview || !container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setContainerWidth(entry.contentRect.width),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [showPreview]);
  useEffect(() => {
    const onMessage = (event) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow
      )
        return;
      if (event.data?.type === "dpvn-preview-ready") {
        if (PREVIEW_PAGES.some((p) => p.route === event.data.path))
          setRoute((old) => {
            if (old.split("?")[0] !== event.data.path) scroll.current = 0;
            return old.split("?")[0] === event.data.path
              ? old
              : event.data.path;
          });
        setPreviewState("Draft preview is up to date");
        frame.current.contentWindow.postMessage(
          { type: "dpvn-preview-restore-scroll", scrollY: scroll.current },
          window.location.origin,
        );
      }
      if (
        event.data?.type === "dpvn-preview-scroll" &&
        Number.isFinite(event.data.scrollY)
      )
        scroll.current = event.data.scrollY;
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function chooseSection(id) {
    const next = EDITOR_SECTIONS.find((item) => item.id === id);
    setSelected(id);
    setFocused([]);
    scroll.current = 0;
    setRoute(next.route);
  }
  const hero =
    content.pages.images.heroBackground || content.pages.images.schoolGate;
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold text-[#4f1b2b]">
            Website editor
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Choose a page, edit its text or photographs, and review your changes
            in the private website preview.
          </p>
        </div>
        <a
          href={section.route}
          target="_blank"
          rel="noopener noreferrer"
          className={secondary}
        >
          <ExternalLink size={16} />
          View published page
        </a>
      </div>
      <div className="my-6 flex flex-wrap items-end gap-4 rounded-2xl border border-[#e4d4bd] bg-white p-4">
        <label className="min-w-0 flex-1 text-sm font-bold text-[#6e263d]">
          Page or section to edit
          <select
            aria-label="Page or section to edit"
            className={`${control} mt-2`}
            value={selected}
            onChange={(e) => chooseSection(e.target.value)}
          >
            {EDITOR_SECTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={secondary}
          onClick={() => setShowPreview((value) => !value)}
          aria-pressed={showPreview}
        >
          <Eye size={17} />
          {showPreview ? "Hide preview" : "Show website preview"}
        </button>
      </div>
      <div
        className="mb-5 rounded-xl border border-[#e4d4bd] bg-[#fff8ec] px-4 py-3 text-sm"
        aria-live="polite"
      >
        <span className="font-bold text-[#701e35]">
          Editing: {section.label}
        </span>
        <span className="ml-2 text-stone-600">{section.route}</span>
        {focused.length > 0 && (
          <p className="mt-1 break-words text-xs text-stone-600">
            Field:{" "}
            {focused
              .map((part) =>
                typeof part === "number" ? `Item ${part + 1}` : friendly(part),
              )
              .join(" › ")}
          </p>
        )}
        <p className="mt-1 text-xs font-semibold text-[#865c30]">
          {dirty
            ? "Unsaved changes — only visible in your private preview"
            : "Showing the current published content"}{" "}
          · Revision {revision}
        </p>
      </div>
      <div
        className={`grid items-start gap-6 ${showPreview ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]" : ""}`}
      >
        <div className="min-w-0 space-y-5">
          {selected === "home" && (
            <section
              className="space-y-4 rounded-2xl border border-[#d9bf98] bg-white p-5"
              aria-labelledby="home-background-heading"
            >
              <div>
                <h3
                  id="home-background-heading"
                  className="font-display text-xl font-bold text-[#5d263a]"
                >
                  Homepage background image
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  The photograph behind the large welcome heading. Replacing
                  this banner keeps the school gate photo elsewhere unchanged.
                </p>
              </div>
              <img
                src={hero}
                alt="Current homepage background"
                className="aspect-[16/7] w-full rounded-xl border border-[#e1d0b7] object-cover"
              />
              <p className="break-all text-xs text-stone-600">
                Current file: <strong>{imageFileName(hero)}</strong>
              </p>
              <div className="flex flex-wrap gap-3">
                <label className={`${button} cursor-pointer`}>
                  <UploadCloud size={17} />
                  {busy ? "Uploading…" : "Replace homepage background"}
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    aria-label="Replace homepage background"
                    disabled={busy}
                    onFocus={() =>
                      setFocused(["pages", "images", "heroBackground"])
                    }
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        onUpload(file, ["pages", "images", "heroBackground"]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {hero !== publishedContent.pages.images.heroBackground && (
                  <button
                    type="button"
                    className={secondary}
                    disabled={busy}
                    onClick={() =>
                      onEdit(
                        ["pages", "images", "heroBackground"],
                        publishedContent.pages.images.heroBackground,
                      )
                    }
                  >
                    <Undo2 size={15} />
                    Undo background change
                  </button>
                )}
              </div>
              <p className="text-xs leading-5 text-stone-500">
                JPEG, PNG, WebP or GIF · Maximum 8 MB. Upload, check the
                preview, then publish when ready.
              </p>
            </section>
          )}
          <div className="rounded-2xl border border-[#e9dfd0] bg-white p-5">
            <EditorField
              label={section.label}
              value={
                selected === "images"
                  ? Object.fromEntries(
                      Object.entries(value).filter(
                        ([key]) => key !== "heroBackground",
                      ),
                    )
                  : value
              }
              path={section.path}
              onEdit={onEdit}
              onUpload={onUpload}
              busy={busy}
              onFocus={setFocused}
            />
          </div>
        </div>
        {showPreview && (
          <section
            className="order-first min-w-0 overflow-hidden rounded-2xl border border-[#d9c5aa] bg-[#efe7db] xl:sticky xl:top-6 xl:order-none"
            aria-label="Website draft preview"
          >
            <div className="space-y-3 border-b border-[#dac7ad] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 font-display text-xl font-bold text-[#5b263a]">
                  <Eye size={19} />
                  Website preview
                </h3>
                <div
                  className="flex gap-1"
                  role="group"
                  aria-label="Preview screen size"
                >
                  {[
                    ["desktop", Monitor, "Desktop"],
                    ["tablet", Tablet, "Tablet"],
                    ["mobile", Smartphone, "Mobile"],
                  ].map(([key, Icon, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`rounded-lg p-2 ${device === key ? "bg-[#701e35] text-white" : "text-stone-600 hover:bg-stone-100"}`}
                      aria-label={`${label} preview`}
                      aria-pressed={device === key}
                      onClick={() => setDevice(key)}
                    >
                      <Icon size={18} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Preview page"
                  className={`${control} min-w-0 flex-1`}
                  value={route.split("?")[0]}
                  onChange={(e) => {
                    setRoute(e.target.value);
                    scroll.current = 0;
                  }}
                >
                  {PREVIEW_PAGES.map((page) => (
                    <option key={page.route} value={page.route}>
                      {page.label} · {page.route}
                    </option>
                  ))}
                </select>
                <button
                  className={secondary}
                  type="button"
                  aria-label="Refresh website preview"
                  onClick={() => setRefresh((value) => value + 1)}
                >
                  <RefreshCw size={16} />
                </button>
                {src && (
                  <a
                    className={secondary}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open full website preview"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
              <p className="text-xs text-stone-500" role="status">
                {previewState} · {targetWidth}px {device}
              </p>
              <p className="text-xs leading-5 text-[#865c30]">
                Private draft. Visitors see changes only after you publish.
              </p>
            </div>
            {previewError && (
              <div
                role="alert"
                className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {previewError}
              </div>
            )}
            <div
              ref={container}
              className="relative min-w-0 overflow-hidden p-0"
              style={{ height: 760 * scale }}
            >
              {src ? (
                <iframe
                  ref={frame}
                  title="Live website draft preview"
                  src={src}
                  referrerPolicy="same-origin"
                  className="absolute left-1/2 top-0 border-0 bg-white"
                  style={{
                    width: targetWidth,
                    height: 760,
                    transform: `translateX(-50%) scale(${scale})`,
                    transformOrigin: "top center",
                  }}
                />
              ) : (
                <p className="p-6 text-center text-sm text-stone-600">
                  {previewError
                    ? "Use refresh to try the preview again."
                    : "Preparing your website preview…"}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
      <div className="sticky bottom-3 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d9c5aa] bg-[#fffcf5]/95 p-4 shadow-lg backdrop-blur-md">
        <span className="text-sm font-semibold text-[#6e263d]">
          {dirty ? "Your draft is ready to review" : "No unpublished changes"}
        </span>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || !dirty}
            className={secondary}
            onClick={() => {
              if (window.confirm("Discard your unpublished website edits?"))
                onDiscard();
            }}
          >
            <Undo2 size={16} />
            Discard changes
          </button>
          <button
            type="button"
            disabled={busy || !dirty}
            className={button}
            onClick={onPublish}
          >
            <Save size={17} />
            {busy ? "Saving…" : "Publish website changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
