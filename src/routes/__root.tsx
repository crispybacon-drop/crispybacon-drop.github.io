import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Baseline — Tennis Progress Tracker" },
      {
        name: "description",
        content:
          "Log tennis matches and training sessions, track scores by surface, and follow long-term progress with custom trackers.",
      },
      { name: "author", content: "Baseline" },
      { property: "og:title", content: "Baseline — Tennis Progress Tracker" },
      {
        property: "og:description",
        content: "Your tennis diary: matches, training, and custom trackers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Baseline — Tennis Progress Tracker" },
      { name: "description", content: "Track your tennis training sessions, matches, and progress. Your own game statistics. Kept private." },
      { property: "og:description", content: "Track your tennis training sessions, matches, and progress. Your own game statistics. Kept private." },
      { name: "twitter:description", content: "Track your tennis training sessions, matches, and progress. Your own game statistics. Kept private." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/992939d5-3d2a-419e-a2a9-4ac14e9cf16e/id-preview-06c8cf6a--14332394-7f2d-4a48-9bfc-c3c3ffe5add9.lovable.app-1777730493924.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/992939d5-3d2a-419e-a2a9-4ac14e9cf16e/id-preview-06c8cf6a--14332394-7f2d-4a48-9bfc-c3c3ffe5add9.lovable.app-1777730493924.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Rajdhani:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('tennis.theme.v1');var m=t==='light'?'light':'dark';var h=document.documentElement;h.classList.remove('light','dark');h.classList.add(m);h.style.colorScheme=m;}catch(e){}`,
          }}
        />
      </head>
      <body className="bg-background text-foreground" suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
