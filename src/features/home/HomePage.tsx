import { Link } from 'react-router';

/** Temporary minimal home; the full landing page is built in stage 6. */
export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">Брендбук из ваших правил — в PDF и архиве</h1>
      <div className="mt-8 flex gap-2">
        <Link to="/projects" className="inline-flex h-11 items-center rounded-md bg-accent px-5 font-semibold">
          Создать брендбук
        </Link>
      </div>
    </div>
  );
}
