import { redirect } from "next/navigation";

// redirect to /dashboard using nextjs correctly way
export default function Home() {
  redirect("/dashboard");
}
