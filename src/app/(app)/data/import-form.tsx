"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { importData } from "./actions";

export function ImportForm({ entity }: { entity: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("entity", entity);
    startTransition(async () => {
      const outcome = await importData(formData);
      if (outcome.ok) {
        setErrors([]);
        toast.success(
          `Imported, ${outcome.created} created, ${outcome.updated} updated`,
        );
        form.reset();
        router.refresh();
      } else {
        setErrors(outcome.errors);
        toast.error(
          `Import rejected, ${outcome.errors.length} problem${outcome.errors.length === 1 ? "" : "s"}, nothing was applied`,
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="max-w-56 text-xs file:mr-2 file:rounded-md file:border file:border-input file:bg-transparent file:px-2.5 file:py-1.5 file:text-xs file:font-medium hover:file:bg-accent"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          <Upload className="size-3.5" /> {pending ? "Importing…" : "Import"}
        </Button>
      </div>
      {errors.length > 0 ? (
        <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
