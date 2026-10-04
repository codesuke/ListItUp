"use client";

import { signInWithOAuthAction } from "@/app/sign-in/actions";

export function AuthOAuthButtons({ callbackURL }: { callbackURL: string }) {
  return (
    <div className="my-6">
      <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-[0.18em] text-[#a5aaaf]">
        <span className="h-px flex-1 bg-[#31363a]" />
        <span>or continue with</span>
        <span className="h-px flex-1 bg-[#31363a]" />
      </div>

      <form action={signInWithOAuthAction} className="mt-5 grid gap-3">
        <input type="hidden" name="callbackURL" value={callbackURL} />
        <button
          type="submit"
          name="provider"
          value="google"
          className="relative flex h-12 items-center justify-center gap-3 rounded-lg border border-[#31363a] bg-[#0e1113] px-4 text-sm font-medium text-[#e6e6e6] transition duration-200 hover:border-white/30 hover:bg-[#1d2125] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4581a] active:scale-[.98]"
        >
          <svg
            className="absolute left-4 h-5 w-5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M21.35 12.27c0-.78-.07-1.53-.2-2.25H12v4.26h5.23a4.48 4.48 0 0 1-1.94 2.94v2.77h3.15c1.84-1.7 2.91-4.2 2.91-7.72Z"
            />
            <path
              fill="#34A853"
              d="M12 21.75c2.62 0 4.82-.87 6.44-2.36l-3.15-2.77c-.87.58-1.99.92-3.29.92-2.53 0-4.67-1.71-5.43-4.01H3.31v2.85A9.73 9.73 0 0 0 12 21.75Z"
            />
            <path
              fill="#FBBC05"
              d="M6.57 13.53A5.82 5.82 0 0 1 6.27 12c0-.53.1-1.04.3-1.53V7.62H3.31A9.73 9.73 0 0 0 2.25 12c0 1.57.38 3.06 1.06 4.38l3.26-2.85Z"
            />
            <path
              fill="#EA4335"
              d="M12 6.46c1.43 0 2.71.49 3.71 1.44l2.79-2.79C16.81 3.54 14.61 2.25 12 2.25a9.73 9.73 0 0 0-8.69 5.37l3.26 2.85c.76-2.3 2.9-4.01 5.43-4.01Z"
            />
          </svg>
          Continue with Google
        </button>
        <button
          type="submit"
          name="provider"
          value="github"
          className="relative flex h-12 items-center justify-center gap-3 rounded-lg border border-[#31363a] bg-[#0e1113] px-4 text-sm font-medium text-[#e6e6e6] transition duration-200 hover:border-white/30 hover:bg-[#1d2125] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4581a] active:scale-[.98]"
        >
          <svg
            className="absolute left-4 h-5 w-5 fill-current"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 2.2a9.8 9.8 0 0 0-3.1 19.1c.49.09.67-.21.67-.47v-1.72c-2.73.59-3.3-1.16-3.3-1.16-.44-1.14-1.1-1.44-1.1-1.44-.9-.61.07-.6.07-.6 1 .08 1.52 1.03 1.52 1.03.89 1.52 2.32 1.08 2.89.83.09-.64.35-1.08.64-1.32-2.18-.25-4.47-1.09-4.47-4.86 0-1.07.38-1.95 1.02-2.64-.1-.25-.44-1.25.1-2.61 0 0 .83-.27 2.7 1.01a9.3 9.3 0 0 1 4.92 0c1.87-1.28 2.7-1.01 2.7-1.01.54 1.36.2 2.36.1 2.61.64.69 1.02 1.57 1.02 2.64 0 3.78-2.29 4.6-4.48 4.85.35.3.67.88.67 1.77v2.63c0 .26.18.57.68.47A9.8 9.8 0 0 0 12 2.2Z" />
          </svg>
          Continue with GitHub
        </button>
      </form>
    </div>
  );
}
