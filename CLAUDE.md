# ArchMind EA Platform — Frontend (ea-platform-ui)

React/TypeScript SPA for the ArchMind Enterprise Architecture platform. Deployed via Cloud Run, default branch `master`. Sibling backend repo: `meganta/ea-platform` (branch `main`) — see that repo's `CLAUDE.md` for backend architecture, module status, and the shared working-style/policy notes (communication style, non-negotiable rules, standing policies) that apply equally here and aren't repeated in full below.

## Standing policy (agreed mid-session, applies to every new page/feature)

Every new page or feature includes, as standard: **unit tests, a help tip (or tips) explaining the feature in plain language, responsive design, and AR/EN support.** Not an afterthought bolted on later — part of building the thing.

## Architecture conventions

- **No shared `useApi()` hook.** Each page defines its own local `useApi()` closure. **Always wrap its returned object in `useMemo(() => ({...}), [deps])`** — an unmemoized return value causes a new object every render, which cascades into any `useCallback`/`useEffect` depending on it re-firing on every render (a real, previously-shipped bug: unwanted full re-fetches on every keystroke). Dependency array is `[]` if the closure only reads `localStorage`; it must include `token` if the closure reads a token from `useAuth()` directly.
- **Routing:** `react-router-dom` v7. Its package `exports` field is ESM-only and **not resolvable by Create React App's built-in Jest config** — when writing a test that needs `useNavigate`/`useSearchParams`/`Link`, mock the whole module: `jest.mock('react-router-dom', () => ({...}), { virtual: true })`. Don't try to render inside a real `<MemoryRouter>` in tests.
- **Labels need `htmlFor`/`id`, always.** The `form-group`/`form-label`/`form-input` pattern used throughout does not auto-associate a label with its input — this has been found and fixed as a real accessibility gap on 4+ pages already (LoginPage, RegisterPage, RepositoryPage's AssetModal, others). Add the pair explicitly on every new form field.
- **CSS: never mix the `border` shorthand with a specific side property (`borderBottom`, etc.) in the same style object.** `border: 'none'` resets all four sides; combined with a separate `borderBottom` on the same object, React's style diffing across renders can unpredictably clobber the intended side (found and fixed platform-wide, 9 pages, mostly tab-strip active-indicators). Use `borderTop/borderLeft/borderRight: 'none'` explicitly instead of the shorthand when you also need a specific `borderBottom`.
- **Responsive:** app shell (mobile sidebar), the `stat-grid-3/4/5/6` utility classes (`src/styles.css`) for any row of equal-width cards, table `overflowX: 'auto'` wrappers, and 3 side-panel patterns are already handled platform-wide. Follow those existing patterns for new UI rather than inventing new ones — inline styles can't respond to media queries, so anything that needs to reflow at a breakpoint belongs in a CSS class, not inline.
- **i18n:** `src/contexts/LangContext.tsx`'s `TRANSLATIONS` dict + `useLang()`'s `t()`/`isAR` + `dir={isAR ? 'rtl' : 'ltr'}` on the page root is the established pattern (see `StrategyPage.tsx`'s core workflow for a complete example). Given the government-platform accuracy stakes, prioritize correctness of the Arabic text itself over speed — don't guess at translations for domain terminology.
- **Persistent storage in artifacts** (if ever building a standalone artifact rather than a page in this app): no `localStorage`/`sessionStorage` — use the `window.storage` key-value API instead. Not applicable to this app's own pages, which do use `localStorage` directly for the auth token.

## Testing conventions

- `CI=true npx react-scripts test --watchAll=false` to run the suite (no separate Jest config needed — CRA's built-in one is used as-is).
- Mock `useLang`/`useAuth`/`useBranding` directly via `jest.mock()` on the context module rather than wrapping in real providers.
- `mockFetch` route-matching helper pattern: sort route patterns by string length descending (most-specific-first) before matching via `.includes()` — but watch the edge case where one route is a URL *prefix* and another is a *suffix* of the same longer URL (neither contains the other, so length-sorting alone doesn't disambiguate); use the full unambiguous path in that case.
- Watch for **duplicate button/text** between a page's tab strip and its own Dashboard "Quick Actions" shortcuts, or between a sidebar list item and its own auto-selected detail panel — disambiguate with `getAllByText(...)[0]` or a `waitFor` + length check rather than a bare `getByText` that will throw on multiple matches.
- **Always await the detail view actually rendering** after clicking into a list item before interacting with its tabs — `open()`-style handlers are async, and a subsequent click can race ahead of the fetch. "Fetch was called" is not sufficient; wait for real rendered content (e.g. a tab-strip element unique to the loaded detail view).
- Check whether text is gated by `t()` (renders as the raw key string under a test mock returning `(key) => key`) vs hardcoded literal English before writing an assertion against it.
- Wrap manually-dispatched DOM events (e.g. simulating an `<img onError>`) in `act(...)`.
- Click actual checkbox/radio `<input>` elements directly in tests rather than their wrapping `<label>` text — label-wrapped-input clicks don't always reliably propagate in jsdom.
- Mock `window.HTMLElement.prototype.scrollIntoView` globally if the page under test auto-scrolls anything (jsdom doesn't implement it).

## Current state (condensed, not a changelog)

- **19 pages**, all with unit test coverage (214 tests total) — though several pages' coverage is intentionally partial: `GovernancePage` (only the list view, not the 5-step wizard or 7-tab report view), `SettingsPage` (2 of 11 sub-tabs: Users, Governance Settings), `CopilotPage` (no live chat-send/SSE-streaming or voice-recording tests — those need `ReadableStream`/`MediaRecorder`/`getUserMedia` mocking not yet built).
- **Responsive UI:** foundational work done (app shell, stat grids, tables, 3 side panels); a full per-page sweep of remaining internal layouts has not been done.
- **AR/EN translation:** only `StrategyPage`'s core workflow (list/detail/tabs/Goals sub-tab) is translated. 8 other pages (`ConnectorHubPage`, `EaPlanningPage`, `EaViewsPage`, `MetaModelPage`, `AccessGovernancePage`, `CopilotPage`, `GlossaryPage`, `SharedViewPage`) have zero Arabic support — hardcoded English only.
- **New backend modules with no frontend yet:** Digital Innovation & Technology Advisory (Tech Radar + Tenant Context Profile API exists), EA Notifications (notification pipeline API exists — no bell icon, notification center, or admin UI built).

Ask Mohamed for current priority before assuming what to build next — it has changed mid-session more than once and a stale local sense of "the plan" is worse than asking.
