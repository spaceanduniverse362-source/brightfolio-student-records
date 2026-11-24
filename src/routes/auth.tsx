import { createFileRoute } from "@tanstack/react-router";
import { LoginScreen } from "@/components/app/LoginScreen";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — Burka Harbu SSS" },
      { name: "description", content: "Admin, teacher and student sign in for the Burka Harbu SSS results portal." },
      { property: "og:title", content: "Sign In — Burka Harbu SSS" },
      { property: "og:description", content: "Admin, teacher and student sign in for the school results portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginScreen,
});
