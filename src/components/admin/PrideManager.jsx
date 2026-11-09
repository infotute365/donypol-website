"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PrideCard from "@/components/public/PrideCard";

const blank = () => ({
  name: "",
  achievement: "",
  title: "",
  description: "",
  className: "",
  achievementYear: "",
  isPublished: false,
  image: null,
});
const input =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm";
const button =
  "rounded-xl bg-[#701e35] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50";
export default function PrideManager() {
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(blank);
  const [file, setFile] = useState(null);
  const [remove, setRemove] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [version, setVersion] = useState(0);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  async function api(url, options) {
    const response = await fetch(url, { cache: "no-store", ...options });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed.");
    return body;
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      api(
        `/api/our-pride?scope=admin&page=${page}&search=${encodeURIComponent(search)}`,
        { signal: controller.signal },
      )
        .then(setResult)
        .catch((error) => {
          if (error.name !== "AbortError")
            setStatus({ error: true, text: error.message });
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, search, version]);
  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function edit(student = blank()) {
    setDraft({ ...student, achievementYear: student.achievementYear || "" });
    setFile(null);
    setRemove(false);
    setFileKey((k) => k + 1);
    setStatus(null);
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const form = new FormData();
      for (const key of [
        "name",
        "achievement",
        "title",
        "description",
        "className",
        "achievementYear",
        "isPublished",
      ])
        form.set(key, String(draft[key] ?? ""));
      form.set("removeImage", String(remove));
      if (file) form.set("file", file);
      await api(draft._id ? `/api/our-pride/${draft._id}` : "/api/our-pride", {
        method: draft._id ? "PUT" : "POST",
        body: form,
      });
      edit();
      setVersion((v) => v + 1);
      setStatus({
        text: "Achievement saved. Published entries are eligible for the latest three on the homepage.",
      });
    } catch (error) {
      setStatus({ error: true, text: error.message });
    } finally {
      setBusy(false);
    }
  }
  async function removeStudent(student) {
    if (
      !window.confirm(
        `Delete the achievement for ${student.name}? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api(`/api/our-pride/${student._id}`, { method: "DELETE" });
      if (draft._id === student._id) edit();
      setVersion((v) => v + 1);
      setStatus({ text: "Achievement deleted." });
    } catch (error) {
      setStatus({ error: true, text: error.message });
    } finally {
      setBusy(false);
    }
  }
  const preview = {
    ...draft,
    image: previewUrl ? { url: previewUrl } : remove ? null : draft.image,
  };
  return (
    <div>
      <h2 className="font-display text-3xl font-bold text-[#4f1b2b]">
        Our Pride Management
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        Manage student achievements and optional photographs.{" "}
        <Link className="underline" href="/our-pride" target="_blank">
          View public listing
        </Link>
      </p>
      {status && (
        <p
          role={status.error ? "alert" : "status"}
          className={`my-5 rounded-xl border p-4 text-sm ${status.error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}
        >
          {status.text}
        </p>
      )}
      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
        <form
          onSubmit={save}
          className="space-y-4 rounded-2xl border border-[#e4d5c1] bg-white p-5"
        >
          <h3 className="font-display text-xl font-bold">
            {draft._id ? "Edit achievement" : "Add student achievement"}
          </h3>
          <fieldset disabled={busy} className="space-y-4">
            {[
              ["name", "Student name", 120],
              ["achievement", "Achievement / original rank", 240],
              ["title", "Award / title (optional)", 240],
              ["className", "Class (optional)", 80],
            ].map(([key, label, maximum]) => (
              <label key={key} className="block text-sm font-semibold">
                {label}
                <input
                  className={`${input} mt-1`}
                  required={key === "name" || key === "achievement"}
                  maxLength={maximum}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <label className="block text-sm font-semibold">
              Achievement year (optional)
              <input
                className={`${input} mt-1`}
                type="number"
                min="1900"
                max="2200"
                value={draft.achievementYear}
                onChange={(e) =>
                  setDraft({ ...draft, achievementYear: e.target.value })
                }
              />
            </label>
            <label className="block text-sm font-semibold">
              Short description (optional)
              <textarea
                className={`${input} mt-1`}
                rows={3}
                maxLength={2000}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <label className="block text-sm font-semibold">
              {draft.image
                ? "Replace student photograph"
                : "Student photograph (optional)"}
              <input
                key={fileKey}
                className={`${input} mt-1`}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (
                    selected &&
                    (selected.size > 8 * 1024 * 1024 ||
                      ![
                        "image/jpeg",
                        "image/png",
                        "image/webp",
                        "image/gif",
                      ].includes(selected.type))
                  ) {
                    setStatus({
                      error: true,
                      text: "Choose a JPEG, PNG, WebP, or GIF no larger than 8 MB.",
                    });
                    e.target.value = "";
                    setFile(null);
                    return;
                  }
                  setFile(selected || null);
                  setRemove(false);
                }}
              />
            </label>
            <p className="text-xs text-stone-500">
              JPEG, PNG, WebP or GIF, maximum 8 MB. Initials appear when no
              photo is selected.
            </p>
            {(draft.image || file) && (
              <button
                type="button"
                className="text-sm font-bold text-red-700 underline"
                onClick={() => {
                  setFile(null);
                  setRemove(true);
                  setFileKey((k) => k + 1);
                }}
              >
                Remove photograph
              </button>
            )}
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={draft.isPublished}
                onChange={(e) =>
                  setDraft({ ...draft, isPublished: e.target.checked })
                }
              />
              Published (visible publicly)
            </label>
            <div className="flex flex-wrap gap-3">
              <button className={button}>
                {busy
                  ? "Saving…"
                  : draft.isPublished
                    ? "Save and publish"
                    : "Save hidden achievement"}
              </button>
              <button
                type="button"
                className="text-sm font-bold text-[#701e35]"
                onClick={() => edit()}
              >
                {draft._id ? "Cancel editing" : "Clear form"}
              </button>
            </div>
          </fieldset>
        </form>
        <aside>
          <h3 className="mb-3 text-sm font-bold text-[#774b2b]">
            Card preview ·{" "}
            {draft.isPublished ? "Published on save" : "Hidden on save"}
          </h3>
          <PrideCard student={preview} preview />
        </aside>
      </div>
      <div className="mt-9 rounded-2xl border border-[#e4d5c1] bg-white p-5">
        <label className="block text-sm font-bold">
          Search student records
          <input
            className={`${input} mt-2`}
            type="search"
            maxLength={120}
            placeholder="Search name, achievement, class or description"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {loading ? (
          <p role="status" className="py-5 text-sm">
            Loading achievements…
          </p>
        ) : (
          result && (
            <>
              <p className="my-4 text-sm text-stone-500">
                {result.total} records · Page {result.page} of {result.pages}
              </p>
              {!result.items.length && (
                <p className="py-5 text-sm">No achievements found.</p>
              )}
              <ul className="divide-y divide-stone-200">
                {result.items.map((student) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-4 py-4"
                    key={student._id}
                  >
                    <div className="min-w-0">
                      <p className="break-words font-bold text-[#701e35]">
                        {student.name}
                      </p>
                      <p className="break-words text-sm text-stone-600">
                        {student.achievement} · {student.title}
                      </p>
                      <span className="mt-1 inline-block rounded-full bg-[#f4e8d7] px-2 py-1 text-xs font-bold text-[#74472d]">
                        {student.isPublished ? "Published" : "Hidden"} ·{" "}
                        {student.image ? "Photo added" : "No photo"}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm font-bold">
                      <button
                        disabled={busy}
                        className="text-[#701e35]"
                        onClick={() => edit(student)}
                        aria-label={`Edit ${student.name}`}
                      >
                        Edit
                      </button>
                      {!student.seedKey ? (
                        <button
                          disabled={busy}
                          className="text-red-700"
                          onClick={() => removeStudent(student)}
                          aria-label={`Delete ${student.name}`}
                        >
                          Delete
                        </button>
                      ) : (
                        <span className="self-center text-xs font-medium text-stone-500">
                          Original school record
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center gap-4">
                <button
                  className={button}
                  disabled={result.page <= 1 || busy}
                  onClick={() => setPage(result.page - 1)}
                >
                  Previous
                </button>
                <span className="text-sm">
                  {result.page} / {result.pages}
                </span>
                <button
                  className={button}
                  disabled={result.page >= result.pages || busy}
                  onClick={() => setPage(result.page + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
