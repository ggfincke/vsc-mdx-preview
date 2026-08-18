// examples/stress-test/src/StressHarness.jsx
// interactive high-volume React renderer for preview stress testing

import React, { useDeferredValue, useMemo, useState } from 'react';

const LOAD_LEVELS = [500, 2500, 5000, 10000];
const CARD_STYLES = [
  {
    shell: 'border-cyan-300/70 bg-cyan-50/80 text-cyan-950 dark:border-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-50',
    badge: 'bg-cyan-200 text-cyan-900 dark:bg-cyan-800 dark:text-cyan-100',
    bar: 'bg-cyan-500',
  },
  {
    shell: 'border-violet-300/70 bg-violet-50/80 text-violet-950 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-50',
    badge:
      'bg-violet-200 text-violet-900 dark:bg-violet-800 dark:text-violet-100',
    bar: 'bg-violet-500',
  },
  {
    shell: 'border-emerald-300/70 bg-emerald-50/80 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-50',
    badge:
      'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100',
    bar: 'bg-emerald-500',
  },
  {
    shell: 'border-amber-300/70 bg-amber-50/80 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50',
    badge:
      'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100',
    bar: 'bg-amber-500',
  },
  {
    shell: 'border-rose-300/70 bg-rose-50/80 text-rose-950 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-50',
    badge: 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100',
    bar: 'bg-rose-500',
  },
  {
    shell: 'border-sky-300/70 bg-sky-50/80 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-50',
    badge: 'bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-100',
    bar: 'bg-sky-500',
  },
];

function buildCells(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    label: `Shard ${String(index + 1).padStart(5, '0')}`,
    palette: index % CARD_STYLES.length,
    progress: ((index * 37) % 97) + 3,
    score: (index * 7919) % 100000,
    status: index % 11 === 0 ? 'queued' : index % 7 === 0 ? 'warm' : 'ready',
  }));
}

export default function StressHarness() {
  const [count, setCount] = useState(2500);
  const [query, setQuery] = useState('');
  const [dense, setDense] = useState(true);
  const [reversed, setReversed] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const deferredCount = useDeferredValue(count);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const cells = useMemo(() => buildCells(deferredCount), [deferredCount]);
  const visibleCells = useMemo(() => {
    const filtered = deferredQuery
      ? cells.filter(
          (cell) =>
            cell.label.toLowerCase().includes(deferredQuery) ||
            cell.status.includes(deferredQuery)
        )
      : cells;
    return reversed ? [...filtered].reverse() : filtered;
  }, [cells, deferredQuery, reversed]);

  return (
    <section className="my-8 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-xl dark:border-slate-700 dark:bg-slate-950 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-[0.24em] text-fuchsia-700 dark:text-fuchsia-300">
            Trusted-mode React load
          </p>
          <h2 className="mb-1 mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            Interactive DOM pressure grid
          </h2>
          <p className="m-0 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Every tile is a real button with nested nodes, Tailwind utilities,
            an event handler, and deterministic data. Filtering, reversing, or
            changing the load forces a large React reconciliation.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Grid load controls">
          {LOAD_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setCount(level)}
              className={`rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                count === level
                  ? 'border-fuchsia-600 bg-fuchsia-600 text-white shadow-md'
                  : 'border-slate-300 bg-white text-slate-800 hover:border-fuchsia-400 hover:bg-fuchsia-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-fuchsia-950'
              }`}
            >
              {level.toLocaleString()} cells
            </button>
          ))}
        </div>
      </div>

      <div className="my-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-inner dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[minmax(15rem,1fr)_auto_auto]">
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Filter cells
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try ready, warm, queued, or 00999"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-950 outline-none ring-fuchsia-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          />
        </label>
        <button
          type="button"
          onClick={() => setDense((value) => !value)}
          className="self-end rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {dense ? 'Use roomy cards' : 'Use dense cards'}
        </button>
        <button
          type="button"
          onClick={() => setReversed((value) => !value)}
          className="self-end rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {reversed ? 'Restore order' : 'Reverse order'}
        </button>
      </div>

      <div
        className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300"
        aria-live="polite"
      >
        <span>{visibleCells.length.toLocaleString()} visible cells</span>
        <span>{(visibleCells.length * 8).toLocaleString()}+ DOM nodes</span>
        <span>Selected: {selectedId ?? 'none'}</span>
        {deferredCount !== count ? (
          <span className="text-fuchsia-700 dark:text-fuchsia-300">
            Rendering {count.toLocaleString()} cells...
          </span>
        ) : null}
      </div>

      <div
        className={
          dense
            ? 'grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-1.5'
            : 'grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-3'
        }
      >
        {visibleCells.map((cell) => {
          const style = CARD_STYLES[cell.palette];
          const selected = cell.id === selectedId;
          return (
            <button
              key={cell.id}
              type="button"
              onClick={() => setSelectedId(cell.id)}
              aria-pressed={selected}
              className={`group min-w-0 border text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500 ${
                dense ? 'rounded-md p-2' : 'rounded-xl p-4'
              } ${style.shell} ${
                selected
                  ? 'ring-2 ring-fuchsia-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-950'
                  : ''
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs font-bold">
                  {cell.label}
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${style.badge}`}
                >
                  {cell.status}
                </span>
              </span>
              <span
                className={`mt-2 flex items-end justify-between gap-2 ${
                  dense ? 'text-xs' : 'text-sm'
                }`}
              >
                <span className="font-semibold opacity-70">score</span>
                <span className="font-mono font-black tabular-nums">
                  {cell.score.toLocaleString()}
                </span>
              </span>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <span
                  className={`block h-full rounded-full ${style.bar}`}
                  style={{ width: `${cell.progress}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
