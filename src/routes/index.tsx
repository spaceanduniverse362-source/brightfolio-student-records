import { createFileRoute } from "@tanstack/react-router";
import { LoginScreen } from "@/components/app/LoginScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Burka Harbu Special Secondary School" },
      { name: "description", content: "Admin, teacher and student sign in for Burka Harbu Special Secondary School results." },
      { property: "og:title", content: "Sign in — Burka Harbu Special Secondary School" },
      { property: "og:description", content: "Admin, teacher and student sign in for school results, rosters and report cards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginScreen,
});
