'use client';

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-block rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700">
      Print
    </button>
  );
}
